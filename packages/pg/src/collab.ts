import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import type { Tx } from "./client";
import { attachments, cardAssignees, cards, checklistItems, commentMentions, comments, groupMembers, notifications, projects, users } from "./schema";

/**
 * Colaboração no card (Lote 3): checklist, comentários, anexos e notificações.
 * Tudo roda dentro de `withUser`; o RLS (drizzle/0009_colaboracao_rls.sql) recorta o que a pessoa vê e pode alterar.
 */

// ---------- checklist ----------

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  position: number;
  doneByName: string | null;
  doneAt: Date | null;
}

export async function listChecklist(tx: Tx, cardId: string): Promise<ChecklistItem[]> {
  return tx
    .select({ id: checklistItems.id, text: checklistItems.text, done: checklistItems.done, position: checklistItems.position, doneByName: users.name, doneAt: checklistItems.doneAt })
    .from(checklistItems)
    .leftJoin(users, eq(users.id, checklistItems.doneBy))
    .where(eq(checklistItems.cardId, cardId))
    .orderBy(asc(checklistItems.position), asc(checklistItems.createdAt));
}

export async function addChecklistItem(tx: Tx, cardId: string, createdBy: string, text: string): Promise<string> {
  const [last] = await tx
    .select({ position: checklistItems.position })
    .from(checklistItems)
    .where(eq(checklistItems.cardId, cardId))
    .orderBy(desc(checklistItems.position))
    .limit(1);
  const [row] = await tx
    .insert(checklistItems)
    .values({ cardId, createdBy, text, position: (last?.position ?? 0) + 1024 })
    .returning({ id: checklistItems.id });
  return row!.id;
}

export async function getChecklistItem(tx: Tx, id: string) {
  const [row] = await tx.select({ id: checklistItems.id, cardId: checklistItems.cardId, text: checklistItems.text, done: checklistItems.done }).from(checklistItems).where(eq(checklistItems.id, id));
  return row ?? null;
}

export async function setChecklistItemDone(tx: Tx, id: string, done: boolean, by: string): Promise<boolean> {
  const r = await tx
    .update(checklistItems)
    .set({ done, doneBy: done ? by : null, doneAt: done ? new Date() : null })
    .where(eq(checklistItems.id, id))
    .returning({ id: checklistItems.id });
  return r.length > 0;
}

export async function deleteChecklistItem(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.delete(checklistItems).where(eq(checklistItems.id, id)).returning({ id: checklistItems.id });
  return r.length > 0;
}

/** Progresso do checklist de vários cards (para o quadro). */
export async function checklistCounts(tx: Tx, cardIds: string[]): Promise<Map<string, { done: number; total: number }>> {
  const out = new Map<string, { done: number; total: number }>();
  if (!cardIds.length) return out;
  const rows = await tx
    .select({ cardId: checklistItems.cardId, total: count(), done: sql<number>`count(*) filter (where ${checklistItems.done})::int` })
    .from(checklistItems)
    .where(inArray(checklistItems.cardId, cardIds))
    .groupBy(checklistItems.cardId);
  for (const r of rows) out.set(r.cardId, { done: Number(r.done), total: Number(r.total) });
  return out;
}

// ---------- comentários ----------

export interface CommentView {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  mentions: { id: string; name: string }[];
}

export async function listComments(tx: Tx, cardId: string): Promise<CommentView[]> {
  const rows = await tx
    .select({ id: comments.id, authorId: comments.authorId, authorName: sql<string>`coalesce(${users.name}, '—')`, body: comments.body, createdAt: comments.createdAt, editedAt: comments.editedAt })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.cardId, cardId))
    .orderBy(asc(comments.createdAt));
  if (!rows.length) return [];
  const ment = await tx
    .select({ commentId: commentMentions.commentId, id: users.id, name: users.name })
    .from(commentMentions)
    .innerJoin(users, eq(users.id, commentMentions.userId))
    .where(inArray(commentMentions.commentId, rows.map((r) => r.id)));
  return rows.map((r) => ({ ...r, mentions: ment.filter((m) => m.commentId === r.id).map(({ id, name }) => ({ id, name })) }));
}

export async function getComment(tx: Tx, id: string) {
  const [row] = await tx.select({ id: comments.id, cardId: comments.cardId, authorId: comments.authorId }).from(comments).where(eq(comments.id, id));
  return row ?? null;
}

export async function insertComment(tx: Tx, cardId: string, authorId: string, body: string, mentionIds: string[]): Promise<string> {
  const [row] = await tx.insert(comments).values({ cardId, authorId, body }).returning({ id: comments.id });
  const unique = [...new Set(mentionIds)];
  if (unique.length) await tx.insert(commentMentions).values(unique.map((userId) => ({ commentId: row!.id, userId })));
  return row!.id;
}

export async function updateComment(tx: Tx, id: string, body: string): Promise<boolean> {
  const r = await tx.update(comments).set({ body, editedAt: new Date() }).where(eq(comments.id, id)).returning({ id: comments.id });
  return r.length > 0;
}

export async function deleteComment(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.delete(comments).where(eq(comments.id, id)).returning({ id: comments.id });
  return r.length > 0;
}

// ---------- anexos ----------

export interface AttachmentView {
  id: string;
  fileId: string;
  cardId: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: Date;
}

const attachmentCols = {
  id: attachments.id,
  fileId: attachments.fileId,
  cardId: attachments.cardId,
  name: attachments.name,
  mimeType: attachments.mimeType,
  size: attachments.size,
  uploadedBy: attachments.uploadedBy,
  uploadedByName: sql<string>`coalesce(${users.name}, '—')`,
  createdAt: attachments.createdAt,
};

export async function listAttachments(tx: Tx, cardId: string): Promise<AttachmentView[]> {
  return tx.select(attachmentCols).from(attachments).leftJoin(users, eq(users.id, attachments.uploadedBy)).where(eq(attachments.cardId, cardId)).orderBy(desc(attachments.createdAt));
}

export async function getAttachment(tx: Tx, id: string): Promise<AttachmentView | null> {
  const [row] = await tx.select(attachmentCols).from(attachments).leftJoin(users, eq(users.id, attachments.uploadedBy)).where(eq(attachments.id, id));
  return row ?? null;
}

export async function insertAttachment(tx: Tx, v: { cardId: string; fileId: string; name: string; mimeType: string; size: number; uploadedBy: string }): Promise<string> {
  const [row] = await tx.insert(attachments).values(v).returning({ id: attachments.id });
  return row!.id;
}

export async function deleteAttachment(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.delete(attachments).where(eq(attachments.id, id)).returning({ id: attachments.id });
  return r.length > 0;
}

// ---------- notificações ----------

export type NotificationKind = "assigned" | "mentioned" | "commented" | "moved";

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  cardId: string;
  cardTitle: string;
  projectName: string;
  projectColor: string;
  actorName: string | null;
  details: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

/** Pessoas por trás de uma lista de responsáveis (`u:<id>` / `g:<id>`): as diretas e os membros dos grupos. */
export async function expandAssignees(tx: Tx, refs: string[]): Promise<string[]> {
  const userIds = refs.filter((r) => r.startsWith("u:")).map((r) => r.slice(2));
  const groupIds = refs.filter((r) => r.startsWith("g:")).map((r) => r.slice(2));
  const members = groupIds.length ? await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(inArray(groupMembers.groupId, groupIds)) : [];
  return [...new Set([...userIds, ...members.map((m) => m.userId)])];
}

/** Quem acompanha o card: quem o criou e os responsáveis (diretos e pelos grupos). */
export async function cardAudience(tx: Tx, cardId: string): Promise<string[]> {
  const [card] = await tx.select({ createdBy: cards.createdBy }).from(cards).where(eq(cards.id, cardId));
  if (!card) return [];
  const asg = await tx.select({ userId: cardAssignees.userId, groupId: cardAssignees.groupId }).from(cardAssignees).where(eq(cardAssignees.cardId, cardId));
  const people = await expandAssignees(tx, asg.map((a) => (a.userId ? `u:${a.userId}` : `g:${a.groupId}`)));
  return [...new Set([card.createdBy, ...people])];
}

/** Grava avisos para várias pessoas; quem agiu nunca é avisado e só pessoas ativas recebem. */
export async function notify(tx: Tx, actorId: string, cardId: string, kind: NotificationKind, userIds: string[], details: Record<string, unknown> = {}): Promise<number> {
  const targets = [...new Set(userIds)].filter((u) => u !== actorId);
  if (!targets.length) return 0;
  const active = await tx.select({ id: users.id }).from(users).where(and(inArray(users.id, targets), eq(users.state, "active")));
  if (!active.length) return 0;
  await tx.insert(notifications).values(active.map((u) => ({ userId: u.id, kind, cardId, actorId, details })));
  return active.length;
}

export async function listNotifications(tx: Tx, userId: string, limit = 100): Promise<NotificationView[]> {
  const actor = sql<string | null>`(select u.name from ${users} u where u.id = ${notifications.actorId})`;
  const rows = await tx
    .select({
      id: notifications.id,
      kind: notifications.kind,
      cardId: notifications.cardId,
      cardTitle: cards.title,
      projectName: projects.name,
      projectColor: projects.color,
      actorName: actor,
      details: notifications.details,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .innerJoin(cards, eq(cards.id, notifications.cardId))
    .innerJoin(projects, eq(projects.id, cards.projectId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows as NotificationView[];
}

export async function unreadCount(tx: Tx, userId: string): Promise<number> {
  const [r] = await tx
    .select({ n: count() })
    .from(notifications)
    .innerJoin(cards, eq(cards.id, notifications.cardId))
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(r?.n ?? 0);
}

/** Marca como lidas (todas, ou só as de um card / uma notificação). Devolve o card da notificação, se pedida. */
export async function markNotificationsRead(tx: Tx, userId: string, opts: { id?: string; cardId?: string } = {}): Promise<string | null> {
  const where = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (opts.id) where.push(eq(notifications.id, opts.id));
  if (opts.cardId) where.push(eq(notifications.cardId, opts.cardId));
  await tx.update(notifications).set({ readAt: new Date() }).where(and(...where));
  if (!opts.id) return null;
  const [n] = await tx.select({ cardId: notifications.cardId }).from(notifications).where(and(eq(notifications.id, opts.id), eq(notifications.userId, userId)));
  return n?.cardId ?? null;
}

// ---------- painel do Início ----------

export interface DashboardCounts {
  mine: number;
  overdue: number;
  week: number;
  doneWeek: number;
}

/** Contadores do Início, sempre dentro dos projetos que a pessoa vê. `today` = dia de hoje em São Paulo (aaaa-mm-dd). */
export async function dashboardCounts(tx: Tx, projectIds: string[], userId: string, today: string): Promise<DashboardCounts> {
  if (!projectIds.length) return { mine: 0, overdue: 0, week: 0, doneWeek: 0 };
  const inProjects = inArray(cards.projectId, projectIds);
  const open = ne(cards.status, "done");
  const mineSql = sql`exists (select 1 from ${cardAssignees} a where a.card_id = ${cards.id} and (a.user_id = ${userId} or a.group_id in (select gm.group_id from ${groupMembers} gm where gm.user_id = ${userId})))`;
  const [r] = await tx
    .select({
      mine: sql<number>`count(*) filter (where ${open} and ${mineSql})::int`,
      overdue: sql<number>`count(*) filter (where ${open} and ${lt(cards.dueDate, today)})::int`,
      week: sql<number>`count(*) filter (where ${open} and ${gte(cards.dueDate, today)} and ${cards.dueDate} <= (${today}::date + 7))::int`,
      doneWeek: sql<number>`count(*) filter (where ${cards.status} = 'done' and ${cards.completedAt} >= now() - interval '7 days')::int`,
    })
    .from(cards)
    .where(inProjects);
  return { mine: Number(r?.mine ?? 0), overdue: Number(r?.overdue ?? 0), week: Number(r?.week ?? 0), doneWeek: Number(r?.doneWeek ?? 0) };
}
