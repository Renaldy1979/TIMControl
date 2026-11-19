import { asc, eq } from "drizzle-orm";
import type { Tx } from "./client";
import { groupMembers, groups } from "./schema";

export interface GroupRow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  memberIds: string[];
}

export async function listGroups(tx: Tx): Promise<GroupRow[]> {
  const rows = await tx.select().from(groups).orderBy(asc(groups.name));
  const members = await tx.select().from(groupMembers);
  return rows.map((g) => ({ id: g.id, name: g.name, description: g.description, active: g.active, memberIds: members.filter((m) => m.groupId === g.id).map((m) => m.userId) }));
}

export async function createGroup(tx: Tx, input: { name: string; description: string }): Promise<string> {
  const [g] = await tx.insert(groups).values(input).returning({ id: groups.id });
  return g!.id;
}

export async function updateGroup(tx: Tx, id: string, input: Partial<{ name: string; description: string; active: boolean }>): Promise<void> {
  await tx.update(groups).set(input).where(eq(groups.id, id));
}

/** Troca a lista de membros do grupo de uma vez. */
export async function setGroupMembers(tx: Tx, groupId: string, userIds: string[]): Promise<void> {
  await tx.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
  const unique = [...new Set(userIds)];
  if (unique.length) await tx.insert(groupMembers).values(unique.map((userId) => ({ groupId, userId })));
}
