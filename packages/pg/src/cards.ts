import { and, asc, desc, eq, exists, gte, ilike, inArray, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { CardStatus, CardType, Priority } from "@timcontrol/shared";
import type { Tx } from "./client";
import { cardAssignees, cardHistory, cardLabels, cards, groupMembers, groups, labels, projects, users } from "./schema";

/**
 * Cards do Kanban (Lote 2). Tudo roda dentro de `withUser`: o RLS já recorta o que a pessoa vê e pode alterar.
 * As consultas aqui só aplicam os filtros da tela.
 */

export interface AssigneeRef {
  kind: "user" | "group";
  id: string;
  name: string;
}

export interface LabelRef {
  id: string;
  name: string;
  color: string;
}

export interface CardSummary {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  projectCode: string;
  type: CardType;
  title: string;
  status: CardStatus;
  position: number;
  priority: Priority;
  dueDate: string | null;
  createdBy: string;
  requesterId: string | null;
  requesterName: string | null;
  updatedAt: Date;
  assignees: AssigneeRef[];
  labels: LabelRef[];
}

export interface CardDetail extends CardSummary {
  description: string;
  requestedAt: string | null;
  externalRef: string;
  createdByName: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CardFilter {
  projectIds?: string[];
  type?: CardType;
  status?: CardStatus;
  priority?: Priority;
  labelId?: string;
  /** `u:<id>` ou `g:<id>`. */
  assignee?: string;
  /** Responsável é a pessoa, direto ou por um grupo dela. */
  assignedTo?: string;
  /** Solicitações pedidas por esta pessoa. */
  requestedBy?: string;
  /** Prazo: atrasados (antes de hoje e não concluídos) ou nos próximos 7 dias. */
  due?: { kind: "overdue" | "week"; today: string };
  q?: string;
  includeDone?: boolean;
}

const assignedToUser = (userId: string): SQL =>
  exists(
    sql`(select 1 from ${cardAssignees} a where a.card_id = ${cards.id} and (a.user_id = ${userId} or a.group_id in (select gm.group_id from ${groupMembers} gm where gm.user_id = ${userId})))`,
  );

export async function listCards(tx: Tx, f: CardFilter = {}, order: "board" | "due" | "priority" | "updated" = "board"): Promise<CardSummary[]> {
  const where: SQL[] = [];
  if (f.projectIds) {
    if (!f.projectIds.length) return [];
    where.push(inArray(cards.projectId, f.projectIds));
  }
  if (f.type) where.push(eq(cards.type, f.type));
  if (f.status) where.push(eq(cards.status, f.status));
  if (f.priority) where.push(eq(cards.priority, f.priority));
  if (f.includeDone === false) where.push(ne(cards.status, "done"));
  if (f.labelId) where.push(exists(sql`(select 1 from ${cardLabels} cl where cl.card_id = ${cards.id} and cl.label_id = ${f.labelId})`));
  if (f.assignee) {
    const [kind, id] = f.assignee.split(":");
    if (kind === "u") where.push(exists(sql`(select 1 from ${cardAssignees} a where a.card_id = ${cards.id} and a.user_id = ${id})`));
    else where.push(exists(sql`(select 1 from ${cardAssignees} a where a.card_id = ${cards.id} and a.group_id = ${id})`));
  }
  if (f.assignedTo) where.push(assignedToUser(f.assignedTo));
  if (f.requestedBy) where.push(and(eq(cards.type, "request"), eq(cards.requesterId, f.requestedBy))!);
  if (f.due?.kind === "overdue") where.push(and(lt(cards.dueDate, f.due.today), ne(cards.status, "done"))!);
  if (f.due?.kind === "week") {
    const end = sql`(${f.due.today}::date + 7)`;
    where.push(and(gte(cards.dueDate, f.due.today), lte(cards.dueDate, end), ne(cards.status, "done"))!);
  }
  if (f.q?.trim()) {
    const term = `%${f.q.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(cards.title, term), ilike(cards.externalRef, term), ilike(cards.description, term))!);
  }

  const orderBy =
    order === "due"
      ? [sql`${cards.dueDate} asc nulls last`, desc(sql`array_position(array['low','normal','high','urgent'], ${cards.priority})`)]
      : order === "priority"
        ? [desc(sql`array_position(array['low','normal','high','urgent'], ${cards.priority})`), sql`${cards.dueDate} asc nulls last`]
        : order === "updated"
          ? [desc(cards.updatedAt)]
          : [asc(cards.position), asc(cards.createdAt)];

  const rows = await tx
    .select({
      id: cards.id,
      projectId: cards.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      projectCode: projects.code,
      type: cards.type,
      title: cards.title,
      status: cards.status,
      position: cards.position,
      priority: cards.priority,
      dueDate: cards.dueDate,
      createdBy: cards.createdBy,
      requesterId: cards.requesterId,
      requesterName: users.name,
      updatedAt: cards.updatedAt,
    })
    .from(cards)
    .innerJoin(projects, eq(projects.id, cards.projectId))
    .leftJoin(users, eq(users.id, cards.requesterId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(...orderBy)
    .limit(1000);

  return attach(tx, rows as Omit<CardSummary, "assignees" | "labels">[]);
}

async function attach<T extends { id: string }>(tx: Tx, rows: T[]): Promise<(T & { assignees: AssigneeRef[]; labels: LabelRef[] })[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const asg = await tx
    .select({ cardId: cardAssignees.cardId, userId: cardAssignees.userId, groupId: cardAssignees.groupId, userName: users.name, groupName: groups.name })
    .from(cardAssignees)
    .leftJoin(users, eq(users.id, cardAssignees.userId))
    .leftJoin(groups, eq(groups.id, cardAssignees.groupId))
    .where(inArray(cardAssignees.cardId, ids));
  const lbl = await tx
    .select({ cardId: cardLabels.cardId, id: labels.id, name: labels.name, color: labels.color })
    .from(cardLabels)
    .innerJoin(labels, eq(labels.id, cardLabels.labelId))
    .where(inArray(cardLabels.cardId, ids))
    .orderBy(asc(labels.name));
  return rows.map((r) => ({
    ...r,
    assignees: asg
      .filter((a) => a.cardId === r.id)
      .map((a): AssigneeRef => (a.userId ? { kind: "user", id: a.userId, name: a.userName ?? "" } : { kind: "group", id: a.groupId!, name: a.groupName ?? "" }))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "pt-BR") : a.kind === "user" ? -1 : 1)),
    labels: lbl.filter((l) => l.cardId === r.id).map(({ id, name, color }) => ({ id, name, color })),
  }));
}

export async function getCard(tx: Tx, id: string): Promise<CardDetail | null> {
  const creator = sql<string>`(select u.name from ${users} u where u.id = ${cards.createdBy})`;
  const [row] = await tx
    .select({
      id: cards.id,
      projectId: cards.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      projectCode: projects.code,
      type: cards.type,
      title: cards.title,
      description: cards.description,
      status: cards.status,
      position: cards.position,
      priority: cards.priority,
      dueDate: cards.dueDate,
      createdBy: cards.createdBy,
      createdByName: creator,
      requesterId: cards.requesterId,
      requesterName: users.name,
      requestedAt: cards.requestedAt,
      externalRef: cards.externalRef,
      completedAt: cards.completedAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
    })
    .from(cards)
    .innerJoin(projects, eq(projects.id, cards.projectId))
    .leftJoin(users, eq(users.id, cards.requesterId))
    .where(eq(cards.id, id));
  if (!row) return null;
  const [full] = await attach(tx, [row as Omit<CardDetail, "assignees" | "labels">]);
  return full as CardDetail;
}

export interface CardWrite {
  projectId: string;
  type: CardType;
  title: string;
  description: string;
  status: CardStatus;
  position: number;
  priority: Priority;
  dueDate: string | null;
  requesterId: string | null;
  requestedAt: string | null;
  externalRef: string;
}

export async function insertCard(tx: Tx, createdBy: string, input: CardWrite): Promise<string> {
  const [c] = await tx
    .insert(cards)
    .values({ ...input, createdBy, completedAt: input.status === "done" ? new Date() : null })
    .returning({ id: cards.id });
  return c!.id;
}

export async function updateCardFields(tx: Tx, id: string, patch: Partial<CardWrite> & { completedAt?: Date | null }): Promise<boolean> {
  const r = await tx
    .update(cards)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(cards.id, id))
    .returning({ id: cards.id });
  return r.length > 0;
}

export async function deleteCard(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.delete(cards).where(eq(cards.id, id)).returning({ id: cards.id });
  return r.length > 0;
}

/** Troca os responsáveis de uma vez (`u:<id>` / `g:<id>`). */
export async function setCardAssignees(tx: Tx, cardId: string, refs: string[]): Promise<void> {
  await tx.delete(cardAssignees).where(eq(cardAssignees.cardId, cardId));
  const unique = [...new Set(refs)];
  if (!unique.length) return;
  await tx.insert(cardAssignees).values(
    unique.map((r) => {
      const [kind, id] = r.split(":");
      return kind === "u" ? { cardId, userId: id!, groupId: null } : { cardId, userId: null, groupId: id! };
    }),
  );
}

export async function setCardLabels(tx: Tx, cardId: string, labelIds: string[]): Promise<void> {
  await tx.delete(cardLabels).where(eq(cardLabels.cardId, cardId));
  const unique = [...new Set(labelIds)];
  if (unique.length) await tx.insert(cardLabels).values(unique.map((labelId) => ({ cardId, labelId })));
}

/** Posições dos cards de uma coluna, em ordem (para calcular onde entra um card arrastado). */
export async function columnPositions(tx: Tx, projectId: string, status: CardStatus): Promise<{ id: string; position: number }[]> {
  return tx
    .select({ id: cards.id, position: cards.position })
    .from(cards)
    .where(and(eq(cards.projectId, projectId), eq(cards.status, status)))
    .orderBy(asc(cards.position), asc(cards.createdAt));
}

/** Renumera uma coluna (1, 2, 3...) quando as posições ficam próximas demais. */
export async function renumberColumn(tx: Tx, projectId: string, status: CardStatus): Promise<void> {
  const rows = await columnPositions(tx, projectId, status);
  for (const [i, r] of rows.entries()) await tx.update(cards).set({ position: (i + 1) * 1024 }).where(eq(cards.id, r.id));
}

export async function addCardHistory(tx: Tx, cardId: string, actorUserId: string, action: string, details: Record<string, unknown> = {}): Promise<void> {
  await tx.insert(cardHistory).values({ cardId, actorUserId, action, details });
}

export interface HistoryEntry {
  id: number;
  action: string;
  details: Record<string, unknown>;
  actorName: string | null;
  createdAt: Date;
}

export async function cardHistoryOf(tx: Tx, cardId: string): Promise<HistoryEntry[]> {
  return tx
    .select({ id: cardHistory.id, action: cardHistory.action, details: cardHistory.details, actorName: users.name, createdAt: cardHistory.createdAt })
    .from(cardHistory)
    .leftJoin(users, eq(users.id, cardHistory.actorUserId))
    .where(eq(cardHistory.cardId, cardId))
    .orderBy(desc(cardHistory.createdAt), desc(cardHistory.id));
}

/** Grupos de que a pessoa faz parte (para saber se um card é "dela" por grupo). */
export async function groupIdsOf(tx: Tx, userId: string): Promise<string[]> {
  const rows = await tx.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
  return rows.map((r) => r.id);
}

// ---------- etiquetas ----------

export async function listLabels(tx: Tx): Promise<LabelRef[]> {
  return tx.select({ id: labels.id, name: labels.name, color: labels.color }).from(labels).orderBy(asc(labels.name));
}

export async function createLabel(tx: Tx, input: { name: string; color: string }): Promise<string> {
  const [l] = await tx.insert(labels).values(input).returning({ id: labels.id });
  return l!.id;
}

export async function updateLabel(tx: Tx, id: string, input: { name: string; color: string }): Promise<void> {
  await tx.update(labels).set(input).where(eq(labels.id, id));
}

export async function deleteLabel(tx: Tx, id: string): Promise<void> {
  await tx.delete(labels).where(eq(labels.id, id));
}
