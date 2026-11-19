"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addChecklistItem, audit, cardAudience, deleteAttachment, deleteChecklistItem, deleteComment, getAttachment, getCard, getChecklistItem, getComment, groupIdsOf,
  insertAttachment, insertComment, listUsers, markNotificationsRead, notify, setChecklistItemDone, updateComment, type CardDetail, type Tx,
} from "@timcontrol/pg";
import { isOwnCard } from "@timcontrol/domain";
import { attachmentProblem, cardRights, checklistItemSchema, commentSchema, type CardRights } from "@timcontrol/shared";
import { asActor, requireActor, type Actor } from "../actor";
import { ForbiddenError, UserError } from "../errors";
import { fd, firstIssue, type FormState } from "../form";
import { removeFile, uploadFile } from "../storage";

/** Ações da colaboração no card (Lote 3). Permissão conferida aqui (cardRights) e de novo no banco (RLS). */

const uuid = z.string().uuid();

function failure(e: unknown, scope: string): FormState {
  if (e instanceof UserError) return { error: e.message };
  if (e instanceof ForbiddenError) return { error: "Você não tem permissão para isso." };
  console.error(`[${scope}]`, (e as Error).name);
  return { error: "Não foi possível salvar agora. Tente de novo." };
}

async function cardFor(tx: Tx, actor: Actor, cardId: string): Promise<{ card: CardDetail; rights: CardRights }> {
  const card = await getCard(tx, cardId);
  if (!card) throw new UserError("Card não encontrado.");
  const own = isOwnCard(card, actor.user.id, await groupIdsOf(tx, actor.user.id));
  return { card, rights: cardRights(actor.viewer, card, own) };
}

const refresh = (cardId: string) => {
  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/quadro");
};

// ---------- comentários ----------

export async function addCommentAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const cardId = uuid.parse(fd(form, "cardId"));
    const p = commentSchema.safeParse({ body: fd(form, "texto"), mentionIds: form.getAll("mencionar").map(String) });
    if (!p.success) throw new UserError(firstIssue(p.error));
    await asActor(actor, async (tx) => {
      const { rights } = await cardFor(tx, actor, cardId);
      if (!rights.comment) throw new ForbiddenError("kanban.comment");
      const active = new Set((await listUsers(tx)).filter((u) => u.state === "active").map((u) => u.id));
      const mentions = p.data.mentionIds.filter((m) => active.has(m) && m !== actor.user.id);
      await insertComment(tx, cardId, actor.user.id, p.data.body, mentions);
      // Mencionados recebem "mencionou você"; quem acompanha o card recebe "comentou".
      await notify(tx, actor.user.id, cardId, "mentioned", mentions);
      const taken = new Set(mentions);
      await notify(tx, actor.user.id, cardId, "commented", (await cardAudience(tx, cardId)).filter((u) => !taken.has(u)));
    });
    refresh(cardId);
    return { ok: "Comentário publicado." };
  } catch (e) {
    return { ...failure(e, "comment.add"), values: { texto: fd(form, "texto") } };
  }
}

export async function updateCommentAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(fd(form, "id"));
    const p = commentSchema.pick({ body: true }).safeParse({ body: fd(form, "texto") });
    if (!p.success) throw new UserError(firstIssue(p.error));
    const cardId = await asActor(actor, async (tx) => {
      const c = await getComment(tx, id);
      if (!c) throw new UserError("Comentário não encontrado.");
      if (c.authorId !== actor.user.id) throw new ForbiddenError("comment.edit");
      if (!(await updateComment(tx, id, p.data.body))) throw new ForbiddenError("comment.edit");
      return c.cardId;
    });
    refresh(cardId);
    return { ok: "Comentário salvo." };
  } catch (e) {
    return failure(e, "comment.update");
  }
}

export async function deleteCommentAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(fd(form, "id"));
    const cardId = await asActor(actor, async (tx) => {
      const c = await getComment(tx, id);
      if (!c) throw new UserError("Comentário não encontrado.");
      const gestor = actor.viewer.globalProfile.systemKey === "gestor";
      if (c.authorId !== actor.user.id && !gestor) throw new ForbiddenError("comment.delete");
      if (!(await deleteComment(tx, id))) throw new ForbiddenError("comment.delete");
      if (c.authorId !== actor.user.id) await audit(tx, actor.user.id, "comment.deleted", "comment", id, { cardId: c.cardId });
      return c.cardId;
    });
    refresh(cardId);
    return { ok: "Comentário apagado." };
  } catch (e) {
    return failure(e, "comment.delete");
  }
}

// ---------- checklist ----------

export async function addChecklistItemAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const cardId = uuid.parse(fd(form, "cardId"));
    const p = checklistItemSchema.safeParse({ text: fd(form, "texto") });
    if (!p.success) throw new UserError(firstIssue(p.error));
    await asActor(actor, async (tx) => {
      const { rights } = await cardFor(tx, actor, cardId);
      if (!rights.work) throw new ForbiddenError("checklist.add");
      await addChecklistItem(tx, cardId, actor.user.id, p.data.text);
    });
    refresh(cardId);
    return {};
  } catch (e) {
    return { ...failure(e, "checklist.add"), values: { texto: fd(form, "texto") } };
  }
}

/** Marca/desmarca e apaga itens. `op` = "marcar" | "desmarcar" | "apagar". */
export async function checklistItemAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(fd(form, "id"));
    const op = z.enum(["marcar", "desmarcar", "apagar"]).parse(fd(form, "op"));
    const cardId = await asActor(actor, async (tx) => {
      const item = await getChecklistItem(tx, id);
      if (!item) throw new UserError("Item não encontrado.");
      const { rights } = await cardFor(tx, actor, item.cardId);
      if (!rights.work) throw new ForbiddenError("checklist.edit");
      const ok = op === "apagar" ? await deleteChecklistItem(tx, id) : await setChecklistItemDone(tx, id, op === "marcar", actor.user.id);
      if (!ok) throw new ForbiddenError("checklist.edit");
      return item.cardId;
    });
    refresh(cardId);
    return {};
  } catch (e) {
    return failure(e, "checklist.edit");
  }
}

// ---------- anexos ----------

export async function uploadAttachmentAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  let fileId: string | null = null;
  try {
    const cardId = uuid.parse(fd(form, "cardId"));
    const file = form.get("arquivo");
    if (!(file instanceof File)) throw new UserError("Escolha um arquivo.");
    const problem = attachmentProblem(file.name, file.size);
    if (problem) throw new UserError(problem);
    await asActor(actor, async (tx) => {
      const { rights } = await cardFor(tx, actor, cardId);
      if (!rights.work) throw new ForbiddenError("attachment.add");
      fileId = await uploadFile(file);
      const id = await insertAttachment(tx, { cardId, fileId, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, uploadedBy: actor.user.id });
      // Sem o nome do arquivo no log: pode ter dado de cliente.
      await audit(tx, actor.user.id, "attachment.uploaded", "attachment", id, { cardId, size: file.size });
    });
    refresh(cardId);
    return { ok: "Anexo enviado." };
  } catch (e) {
    if (fileId) await removeFile(fileId).catch(() => undefined);
    return failure(e, "attachment.upload");
  }
}

export async function deleteAttachmentAction(_: FormState, form: FormData): Promise<FormState> {
  const actor = await requireActor();
  try {
    const id = uuid.parse(fd(form, "id"));
    const a = await asActor(actor, async (tx) => {
      const att = await getAttachment(tx, id);
      if (!att) throw new UserError("Anexo não encontrado.");
      const { rights } = await cardFor(tx, actor, att.cardId);
      const allowed = (att.uploadedBy === actor.user.id && rights.work) || rights.editStructure;
      if (!allowed || !(await deleteAttachment(tx, id))) throw new ForbiddenError("attachment.delete");
      await audit(tx, actor.user.id, "attachment.deleted", "attachment", id, { cardId: att.cardId });
      return att;
    });
    await removeFile(a.fileId);
    refresh(a.cardId);
    return { ok: "Anexo apagado." };
  } catch (e) {
    return failure(e, "attachment.delete");
  }
}

// ---------- notificações ----------

export async function markAllReadAction(): Promise<void> {
  const actor = await requireActor();
  await asActor(actor, (tx) => markNotificationsRead(tx, actor.user.id));
  revalidatePath("/", "layout");
}
