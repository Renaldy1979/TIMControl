"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  addCardHistory, audit, cardAudience, columnPositions, expandAssignees, notify, createLabel, deleteCard, deleteLabel, getCard, groupIdsOf, insertCard,
  listGroups, listLabels, listUsers, renumberColumn, setCardAssignees, setCardLabels, updateCardFields, updateLabel,
  type CardDetail, type Tx,
} from "@timcontrol/pg";
import { changedFields, dropPosition, isOwnCard, type CardSnapshot } from "@timcontrol/domain";
import { can, CARD_STATUSES, cardSchema, labelSchema, type CardStatus, type PermissionKey } from "@timcontrol/shared";
import { asActor, requireActor, requirePermission, type Actor } from "../actor";
import { ForbiddenError, isUniqueViolation, UserError } from "../errors";
import { fd, firstIssue, type FormState } from "../form";

/** Ações do Kanban (Lote 2). Permissão conferida aqui (can) e de novo no banco (RLS). */

const uuid = z.string().uuid();

function failure(e: unknown, scope: string): FormState {
  if (e instanceof UserError) return { error: e.message };
  if (e instanceof ForbiddenError) return { error: "Você não tem permissão para isso." };
  if (isUniqueViolation(e)) return { error: "Já existe um cadastro com esse nome." };
  console.error(`[${scope}]`, (e as Error).name);
  return { error: "Não foi possível salvar agora. Tente de novo." };
}

const isRedirect = (e: unknown) => typeof (e as { digest?: unknown })?.digest === "string" && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT");

/** Valores do formulário do card → objeto validado. */
function readCard(form: FormData) {
  const raw = {
    projectId: fd(form, "projeto"),
    title: fd(form, "titulo"),
    description: fd(form, "descricao"),
    status: fd(form, "status") || "todo",
    priority: fd(form, "prioridade") || "normal",
    dueDate: fd(form, "prazo"),
    assignees: form.getAll("responsaveis").map(String),
    labelIds: form.getAll("etiquetas").map(String),
    externalRef: fd(form, "referencia"),
  };
  const p = cardSchema.safeParse(raw);
  if (!p.success) throw new UserError(firstIssue(p.error));
  return p.data;
}

/** Valores para devolver ao formulário quando dá erro (a pessoa não perde o que digitou). */
const echo = (form: FormData): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = out[k] ? `${out[k]},${v}` : v;
  return out;
};

/** Responsáveis precisam ser pessoas ativas ou grupos ativos. */
async function checkPeople(tx: Tx, assignees: string[]) {
  const users = new Set((await listUsers(tx)).filter((u) => u.state === "active").map((u) => u.id));
  const groups = new Set((await listGroups(tx)).filter((g) => g.active).map((g) => g.id));
  for (const a of assignees) {
    const [k, id] = a.split(":");
    if (k === "u" ? !users.has(id!) : !groups.has(id!)) throw new UserError("Um dos responsáveis não está mais disponível. Confira a lista.");
  }
}

async function checkLabels(tx: Tx, labelIds: string[]) {
  if (labelIds.length) {
    const known = new Set((await listLabels(tx)).map((l) => l.id));
    if (labelIds.some((l) => !known.has(l))) throw new UserError("Uma das etiquetas não existe mais.");
  }
}

async function endOfColumn(tx: Tx, projectId: string, status: CardStatus): Promise<number> {
  const col = await columnPositions(tx, projectId, status);
  return (col.at(-1)?.position ?? 0) + 1024;
}

const snapshot = (c: CardDetail): CardSnapshot => ({
  title: c.title,
  description: c.description,
  priority: c.priority,
  dueDate: c.dueDate,
  projectId: c.projectId,
  externalRef: c.externalRef,
  assignees: c.assignees.map((a) => `${a.kind === "user" ? "u" : "g"}:${a.id}`),
  labelIds: c.labels.map((l) => l.id),
});

async function ownership(tx: Tx, actor: Actor, card: CardDetail) {
  const groupIds = await groupIdsOf(tx, actor.user.id);
  return isOwnCard(card, actor.user.id, groupIds);
}

const need = (actor: Actor, key: PermissionKey, projectId: string, own = false) => requirePermission(actor, key, { projectId, own });

function revalidateKanban(cardId?: string) {
  revalidatePath("/quadro");
  revalidatePath("/minhas");
  revalidatePath("/pedi");
  revalidatePath("/");
  if (cardId) revalidatePath(`/cards/${cardId}`);
}

// ---------- cards ----------

export async function createCardAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  let id = "";
  try {
    const c = readCard(form);
    need(actor, "kanban.create", c.projectId);
    if (c.status !== "todo") need(actor, "kanban.move", c.projectId, true);
    id = await asActor(actor, async (tx) => {
      await checkPeople(tx, c.assignees);
      await checkLabels(tx, c.labelIds);
      const newId = await insertCard(tx, actor.user.id, {
        projectId: c.projectId,
        title: c.title,
        description: c.description,
        status: c.status,
        position: await endOfColumn(tx, c.projectId, c.status),
        priority: c.priority,
        dueDate: c.dueDate,
        externalRef: c.externalRef,
      });
      await setCardAssignees(tx, newId, c.assignees);
      await setCardLabels(tx, newId, c.labelIds);
      await addCardHistory(tx, newId, actor.user.id, "created", { status: c.status });
      await notify(tx, actor.user.id, newId, "assigned", await expandAssignees(tx, c.assignees));
      return newId;
    });
    revalidateKanban(id);
  } catch (e) {
    return { ...failure(e, "card.create"), values: echo(form) };
  }
  redirect(`/cards/${id}?ok=criado`);
}

export async function updateCardAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(fd(form, "id"));
    const c = readCard(form);
    await asActor(actor, async (tx) => {
      const before = await getCard(tx, id);
      if (!before) throw new UserError("Card não encontrado.");
      const own = await ownership(tx, actor, before);
      need(actor, "kanban.edit", before.projectId, own);
      if (c.projectId !== before.projectId) need(actor, "kanban.create", c.projectId);
      const moving = c.status !== before.status;
      if (moving) need(actor, "kanban.move", c.projectId, own);
      await checkPeople(tx, c.assignees);
      await checkLabels(tx, c.labelIds);
      const after: CardSnapshot = {
        title: c.title,
        description: c.description,
        priority: c.priority,
        dueDate: c.dueDate,
        projectId: c.projectId,
        externalRef: c.externalRef,
        assignees: c.assignees,
        labelIds: c.labelIds,
      };
      const fields = changedFields(snapshot(before), after);
      const relocate = moving || c.projectId !== before.projectId;
      const ok = await updateCardFields(tx, id, {
        projectId: after.projectId,
        title: after.title,
        description: after.description,
        priority: after.priority,
        dueDate: after.dueDate,
        externalRef: after.externalRef,
        ...(relocate ? { status: c.status, position: await endOfColumn(tx, c.projectId, c.status) } : {}),
        ...(moving ? { completedAt: c.status === "done" ? new Date() : null } : {}),
      });
      if (!ok) throw new ForbiddenError("kanban.edit");
      await setCardAssignees(tx, id, c.assignees);
      await setCardLabels(tx, id, c.labelIds);
      if (fields.length) await addCardHistory(tx, id, actor.user.id, "edited", { fields });
      if (moving) await addCardHistory(tx, id, actor.user.id, "moved", { from: before.status, to: c.status });
      // Avisos: quem passou a ser responsável e, se mudou de coluna, quem acompanha o card.
      const beforeRefs = new Set(snapshot(before).assignees);
      const added = c.assignees.filter((a) => !beforeRefs.has(a));
      const newPeople = added.length ? await expandAssignees(tx, added) : [];
      const already = new Set(await expandAssignees(tx, [...beforeRefs]));
      await notify(tx, actor.user.id, id, "assigned", newPeople.filter((u) => !already.has(u)));
      if (moving) await notify(tx, actor.user.id, id, "moved", await cardAudience(tx, id), { from: before.status, to: c.status });
    });
    revalidateKanban(id);
    return { ok: "Card salvo." };
  } catch (e) {
    return { ...failure(e, "card.update"), values: echo(form) };
  }
}

export type MoveResult = { ok: true } | { ok: false; error: string };

/** Arrastar e soltar: coluna de destino e o card que fica logo abaixo (ou nenhum = fim da coluna). */
export async function moveCardAction(input: { id: string; status: string; beforeId: string | null }): Promise<MoveResult> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(input.id);
    const status = z.enum(CARD_STATUSES).parse(input.status);
    const beforeId = input.beforeId ? uuid.parse(input.beforeId) : null;
    await asActor(actor, async (tx) => {
      const card = await getCard(tx, id);
      if (!card) throw new UserError("Card não encontrado.");
      need(actor, "kanban.move", card.projectId, await ownership(tx, actor, card));
      let pos = dropPosition(await columnPositions(tx, card.projectId, status), id, beforeId);
      if (pos === null) {
        await renumberColumn(tx, card.projectId, status);
        pos = dropPosition(await columnPositions(tx, card.projectId, status), id, beforeId) ?? (await endOfColumn(tx, card.projectId, status));
      }
      const moving = status !== card.status;
      const ok = await updateCardFields(tx, id, { status, position: pos, ...(moving ? { completedAt: status === "done" ? new Date() : null } : {}) });
      if (!ok) throw new ForbiddenError("kanban.move");
      if (moving) {
        await addCardHistory(tx, id, actor.user.id, "moved", { from: card.status, to: status });
        await notify(tx, actor.user.id, id, "moved", await cardAudience(tx, id), { from: card.status, to: status });
      }
    });
    revalidateKanban(id);
    return { ok: true };
  } catch (e) {
    const f = failure(e, "card.move");
    return { ok: false, error: f.error === "Você não tem permissão para isso." ? "Você não pode mover este card." : (f.error ?? "Não foi possível mover.") };
  }
}

/** Mover pela lista de colunas (sem arrastar): acessível por teclado e no celular. */
export async function moveCardFormAction(_: FormState, form: FormData): Promise<FormState> {
  const r = await moveCardAction({ id: fd(form, "id"), status: fd(form, "status"), beforeId: null });
  return r.ok ? { ok: "Card movido." } : { error: r.error };
}

export async function deleteCardAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  let back = "/quadro";
  try {
    const id = uuid.parse(fd(form, "id"));
    await asActor(actor, async (tx) => {
      const card = await getCard(tx, id);
      if (!card) throw new UserError("Card não encontrado.");
      need(actor, "kanban.delete", card.projectId, await ownership(tx, actor, card));
      if (!(await deleteCard(tx, id))) throw new ForbiddenError("kanban.delete");
      await audit(tx, actor.user.id, "card.deleted", "card", id, { projectId: card.projectId });
      back = `/quadro?projeto=${card.projectId}`;
    });
    revalidateKanban();
  } catch (e) {
    if (isRedirect(e)) throw e;
    return failure(e, "card.delete");
  }
  redirect(back);
}

// ---------- etiquetas (Configurações) ----------

async function labelGuard(run: (actor: Actor) => Promise<void>): Promise<FormState> {
  const actor = await requireActor();
  try {
    if (!can(actor.viewer, "admin.projects")) throw new ForbiddenError("admin.projects");
    await run(actor);
    revalidatePath("/configuracoes/etiquetas");
    revalidateKanban();
    return { ok: "Salvo." };
  } catch (e) {
    return failure(e, "label");
  }
}

const readLabel = (form: FormData) => {
  const p = labelSchema.safeParse({ name: fd(form, "nome"), color: fd(form, "cor") });
  if (!p.success) throw new UserError(firstIssue(p.error));
  return p.data;
};

export async function createLabelAction(_: FormState, form: FormData): Promise<FormState> {
  return labelGuard(async (actor) => {
    const l = readLabel(form);
    await asActor(actor, async (tx) => {
      const id = await createLabel(tx, l);
      await audit(tx, actor.user.id, "label.created", "label", id);
    });
  });
}

export async function updateLabelAction(_: FormState, form: FormData): Promise<FormState> {
  return labelGuard(async (actor) => {
    const id = uuid.parse(fd(form, "id"));
    const l = readLabel(form);
    await asActor(actor, (tx) => updateLabel(tx, id, l));
  });
}

export async function deleteLabelAction(_: FormState, form: FormData): Promise<FormState> {
  return labelGuard(async (actor) => {
    const id = uuid.parse(fd(form, "id"));
    await asActor(actor, async (tx) => {
      await deleteLabel(tx, id);
      await audit(tx, actor.user.id, "label.deleted", "label", id);
    });
  });
}
