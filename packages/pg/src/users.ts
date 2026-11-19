import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { ProfileRef, UserState, Viewer } from "@timcontrol/shared";
import type { Tx } from "./client";
import { listProfiles } from "./profiles";
import { invites, projectMembers, users } from "./schema";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  state: UserState;
  appwriteUserId: string | null;
  globalProfileId: string;
}

const pick = (u: typeof users.$inferSelect): UserRow => ({
  id: u.id,
  name: u.name,
  email: u.email,
  state: u.state as UserState,
  appwriteUserId: u.appwriteUserId,
  globalProfileId: u.globalProfileId,
});

export async function countUsers(tx: Tx): Promise<number> {
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
  return r?.n ?? 0;
}

export async function userByAppwriteId(tx: Tx, appwriteUserId: string): Promise<UserRow | null> {
  const [u] = await tx.select().from(users).where(eq(users.appwriteUserId, appwriteUserId));
  return u ? pick(u) : null;
}

export async function userByEmail(tx: Tx, email: string): Promise<UserRow | null> {
  const [u] = await tx.select().from(users).where(sql`lower(${users.email}) = lower(${email})`);
  return u ? pick(u) : null;
}

export async function getUser(tx: Tx, id: string): Promise<UserRow | null> {
  const [u] = await tx.select().from(users).where(eq(users.id, id));
  return u ? pick(u) : null;
}

export async function listUsers(tx: Tx): Promise<UserRow[]> {
  return (await tx.select().from(users).orderBy(asc(users.name))).map(pick);
}

export async function insertUser(
  tx: Tx,
  input: { name: string; email: string; globalProfileId: string; state: UserState; appwriteUserId?: string | null },
): Promise<string> {
  const [u] = await tx
    .insert(users)
    .values({ name: input.name, email: input.email.toLowerCase(), globalProfileId: input.globalProfileId, state: input.state, appwriteUserId: input.appwriteUserId ?? null })
    .returning({ id: users.id });
  return u!.id;
}

export async function updateUser(tx: Tx, id: string, input: Partial<Pick<UserRow, "name" | "state" | "globalProfileId" | "appwriteUserId">>): Promise<void> {
  await tx.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, id));
}

/** Monta quem está usando o sistema: perfil global e perfis específicos por projeto. */
export async function loadViewer(tx: Tx, userId: string): Promise<Viewer | null> {
  const u = await getUser(tx, userId);
  if (!u) return null;
  const all = await listProfiles(tx);
  const byId = new Map<string, ProfileRef>(all.map((p) => [p.id, p]));
  const globalProfile = byId.get(u.globalProfileId);
  if (!globalProfile) return null;
  const pm = await tx.select().from(projectMembers).where(eq(projectMembers.userId, userId));
  const projectProfiles: Record<string, ProfileRef> = {};
  for (const m of pm) {
    const p = byId.get(m.profileId);
    if (p) projectProfiles[m.projectId] = p;
  }
  return { userId: u.id, state: u.state, globalProfile, projectProfiles };
}

// ---------- convites ----------

export async function createInvite(tx: Tx, input: { userId: string; tokenHash: string; invitedBy: string | null; expiresAt: Date }): Promise<void> {
  // um convite novo invalida os anteriores da mesma pessoa
  await tx.delete(invites).where(and(eq(invites.userId, input.userId), isNull(invites.acceptedAt)));
  await tx.insert(invites).values(input);
}

export async function inviteByTokenHash(tx: Tx, tokenHash: string) {
  const [r] = await tx
    .select({ invite: invites, user: users })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.userId))
    .where(eq(invites.tokenHash, tokenHash));
  return r ? { id: r.invite.id, expiresAt: r.invite.expiresAt, acceptedAt: r.invite.acceptedAt, user: pick(r.user) } : null;
}

export async function markInviteAccepted(tx: Tx, inviteId: string): Promise<void> {
  await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inviteId));
}

export async function pendingInvite(tx: Tx, userId: string) {
  const [r] = await tx.select().from(invites).where(and(eq(invites.userId, userId), isNull(invites.acceptedAt)));
  return r ?? null;
}
