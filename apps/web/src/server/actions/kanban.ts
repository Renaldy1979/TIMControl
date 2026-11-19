"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  addCardHistory, audit, columnPositions, createLabel, deleteCard, deleteLabel, deleteMeeting, getCard, getMeeting, groupIdsOf, insertCard, insertMeeting,
  listGroups, listLabels, listUsers, renumberColumn, setCardAssignees, setCardLabels, setMeetingParticipants, updateCardFields, updateLabel, updateMeeting,
  type CardDetail, type Tx,
} from "@timcontrol/pg";
import { changedFields, dropPosition, isOwnCard, todayInSaoPaulo, type CardSnapshot } from "@timcontrol/domain";
import { can, CARD_STATUSES, cardSchema, labelSchema, meetingSchema, type CardStatus, type PermissionKey } from "@timcontrol/shared";
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
    type: fd(form, "tipo"),
    title: fd(form, "titulo"),
    description: fd(form, "descricao"),
    status: fd(form, "status") || "todo",
    priority: fd(form, "prioridade") || "normal",
    dueDate: fd(form, "prazo"),
    assignees: form.getAll("responsaveis").map(String),
    labelIds: form.getAll("etiquetas").map(String),
    requesterId: fd(form, "solicitante") || null,
    requestedAt: fd(form, "pedidoEm"),
    externalRef: fd(form, "referencia"),
    meetingId: fd(form, "reuniao") || null,
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

/** Responsáveis precisam ser pessoas ativas ou grupos ativos; solicitante, pessoa ativa. */
async function checkPeople(tx: Tx, assignees: string[], requesterId: string | null) {
  const users = new Set((await listUsers(tx)).filter((u) => u.state === "active").map((u) => u.id));
  const groups = new Set((await listGroups(tx)).filter((g) => g.active).map((g) => g.id));
  for (const a of assignees) {
    const [k, id] = a.split(":");
    if (k === "u" ? !users.has(id!) : !groups.has(id!)) throw new UserError("Um dos responsáveis não está mais disponível. Confira a lista.");
  }
  if (requesterId && !users.has(requesterId)) throw new UserError("Escolha um solicitante válido.");
}

async function checkLabelsAndMeeting(tx: Tx, labelIds: string[], meetingId: string | null, projectId: string) {
  if (labelIds.length) {
    const known = new Set((await listLabels(tx)).map((l) => l.id));
    if (labelIds.some((l) => !known.has(l))) throw new UserError("Uma das etiquetas não existe mais.");
  }
  if (meetingId) {
    const m = await getMeeting(tx, meetingId);
    if (!m) throw new UserError("Reunião de origem não encontrada.");
    if (m.projectId !== projectId) throw new UserError("A reunião de origem é de outro projeto.");
  }
}

async function endOfColumn(tx: Tx, projectId: string, status: CardStatus): Promise<number> {
  const col = await columnPositions(tx, projectId, status);
  return (col.at(-1)?.position ?? 0) + 1024;
}

const snapshot = (c: CardDetail): CardSnapshot => ({
  title: c.title,
  description: c.description,
  type: c.type,
  priority: c.priority,
  dueDate: c.dueDate,
  projectId: c.projectId,
  requesterId: c.requesterId,
  requestedAt: c.requestedAt,
  externalRef: c.externalRef,
  meetingId: c.meetingId,
  assignees: c.assignees.map((a) => `${a.kind === "user" ? "u" : "g"}:${a.id}`),
  labelIds: c.labels.map((l) => l.id),
});

async function ownership(tx: Tx, actor: Actor, card: CardDetail) {
  const groupIds = await groupIdsOf(tx, actor.user.id);
  return isOwnCard(card, actor.user.id, groupIds);
}

const need = (actor: Actor, key: PermissionKey, projectId: string, own = false) => requirePermission(actor, key, { projectId, own });

function revalidateKanban(cardId?: string, meetingId?: string | null) {
  revalidatePath("/quadro");
  revalidatePath("/minhas");
  revalidatePath("/pedi");
  revalidatePath("/");
  if (cardId) revalidatePath(`/cards/${cardId}`);
  if (meetingId) revalidatePath(`/reunioes/${meetingId}`);
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
      await checkPeople(tx, c.assignees, c.requesterId);
      await checkLabelsAndMeeting(tx, c.labelIds, c.meetingId, c.projectId);
      const isRequest = c.type === "request";
      const newId = await insertCard(tx, actor.user.id, {
        projectId: c.projectId,
        type: c.type,
        title: c.title,
        description: c.description,
        status: c.status,
        position: await endOfColumn(tx, c.projectId, c.status),
        priority: c.priority,
        dueDate: c.dueDate,
        requesterId: isRequest ? (c.requesterId ?? actor.user.id) : null,
        requestedAt: isRequest ? (c.requestedAt ?? todayInSaoPaulo()) : null,
        externalRef: c.externalRef,
        meetingId: c.meetingId,
      });
      await setCardAssignees(tx, newId, c.assignees);
      await setCardLabels(tx, newId, c.labelIds);
      await addCardHistory(tx, newId, actor.user.id, "created", { status: c.status });
      return newId;
    });
    revalidateKanban(id, c.meetingId);
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
    const meetingId = await asActor(actor, async (tx) => {
      const before = await getCard(tx, id);
      if (!before) throw new UserError("Card não encontrado.");
      const own = await ownership(tx, actor, before);
      need(actor, "kanban.edit", before.projectId, own);
      if (c.projectId !== before.projectId) need(actor, "kanban.create", c.projectId);
      const moving = c.status !== before.status;
      if (moving) need(actor, "kanban.move", c.projectId, own);
      await checkPeople(tx, c.assignees, c.requesterId);
      await checkLabelsAndMeeting(tx, c.labelIds, c.meetingId, c.projectId);
      const isRequest = c.type === "request";
      const after: CardSnapshot = {
        title: c.title,
        description: c.description,
        type: c.type,
        priority: c.priority,
        dueDate: c.dueDate,
        projectId: c.projectId,
        requesterId: isRequest ? (c.requesterId ?? before.requesterId ?? actor.user.id) : null,
        requestedAt: isRequest ? (c.requestedAt ?? before.requestedAt ?? todayInSaoPaulo()) : null,
        externalRef: c.externalRef,
        meetingId: c.meetingId,
        assignees: c.assignees,
        labelIds: c.labelIds,
      };
      const fields = changedFields(snapshot(before), after);
      const relocate = moving || c.projectId !== before.projectId;
      const ok = await updateCardFields(tx, id, {
        projectId: after.projectId,
        type: c.type,
        title: after.title,
        description: after.description,
        priority: after.priority,
        dueDate: after.dueDate,
        requesterId: after.requesterId,
        requestedAt: after.requestedAt,
        externalRef: after.externalRef,
        meetingId: after.meetingId,
        ...(relocate ? { status: c.status, position: await endOfColumn(tx, c.projectId, c.status) } : {}),
        ...(moving ? { completedAt: c.status === "done" ? new Date() : null } : {}),
      });
      if (!ok) throw new ForbiddenError("kanban.edit");
      await setCardAssignees(tx, id, c.assignees);
      await setCardLabels(tx, id, c.labelIds);
      if (fields.length) await addCardHistory(tx, id, actor.user.id, "edited", { fields });
      if (moving) await addCardHistory(tx, id, actor.user.id, "moved", { from: before.status, to: c.status });
      return before.meetingId ?? c.meetingId;
    });
    revalidateKanban(id, meetingId);
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
      if (moving) await addCardHistory(tx, id, actor.user.id, "moved", { from: card.status, to: status });
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

// ---------- reuniões e WarRooms ----------

function readMeeting(form: FormData) {
  const p = meetingSchema.safeParse({
    projectId: fd(form, "projeto"),
    kind: fd(form, "tipo"),
    title: fd(form, "titulo"),
    heldOn: fd(form, "data"),
    notes: fd(form, "anotacoes"),
    participantIds: form.getAll("participantes").map(String),
  });
  if (!p.success) throw new UserError(firstIssue(p.error));
  return p.data;
}

async function checkParticipants(tx: Tx, ids: string[]) {
  const active = new Set((await listUsers(tx)).filter((u) => u.state === "active").map((u) => u.id));
  if (ids.some((i) => !active.has(i))) throw new UserError("Um dos participantes não está mais disponível.");
}

export async function createMeetingAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  let id = "";
  try {
    const m = readMeeting(form);
    need(actor, "meetings.create", m.projectId);
    id = await asActor(actor, async (tx) => {
      await checkParticipants(tx, m.participantIds);
      const newId = await insertMeeting(tx, actor.user.id, { projectId: m.projectId, kind: m.kind, title: m.title, heldOn: m.heldOn, notes: m.notes });
      await setMeetingParticipants(tx, newId, m.participantIds);
      return newId;
    });
    revalidatePath("/reunioes");
  } catch (e) {
    return { ...failure(e, "meeting.create"), values: echo(form) };
  }
  redirect(`/reunioes/${id}`);
}

export async function updateMeetingAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(fd(form, "id"));
    const m = readMeeting(form);
    await asActor(actor, async (tx) => {
      const before = await getMeeting(tx, id);
      if (!before) throw new UserError("Reunião não encontrada.");
      const own = before.createdBy === actor.user.id || before.participants.some((p) => p.id === actor.user.id);
      need(actor, "meetings.edit", before.projectId, own);
      if (m.projectId !== before.projectId) {
        if (before.totalCards > 0) throw new UserError("Esta reunião já tem cards; ela não pode mudar de projeto.");
        need(actor, "meetings.create", m.projectId);
      }
      await checkParticipants(tx, m.participantIds);
      if (!(await updateMeeting(tx, id, { projectId: m.projectId, kind: m.kind, title: m.title, heldOn: m.heldOn, notes: m.notes }))) throw new ForbiddenError("meetings.edit");
      await setMeetingParticipants(tx, id, m.participantIds);
    });
    revalidatePath("/reunioes");
    revalidatePath(`/reunioes/${id}`);
    return { ok: "Reunião salva." };
  } catch (e) {
    return { ...failure(e, "meeting.update"), values: echo(form) };
  }
}

export async function deleteMeetingAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(fd(form, "id"));
    await asActor(actor, async (tx) => {
      const m = await getMeeting(tx, id);
      if (!m) throw new UserError("Reunião não encontrada.");
      const own = m.createdBy === actor.user.id || m.participants.some((p) => p.id === actor.user.id);
      need(actor, "meetings.delete", m.projectId, own);
      if (!(await deleteMeeting(tx, id))) throw new ForbiddenError("meetings.delete");
      await audit(tx, actor.user.id, "meeting.deleted", "meeting", id, { projectId: m.projectId, cards: m.totalCards });
    });
    revalidatePath("/reunioes");
    revalidateKanban();
  } catch (e) {
    return failure(e, "meeting.delete");
  }
  redirect("/reunioes");
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
