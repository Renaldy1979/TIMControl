import { asc, eq, sql } from "drizzle-orm";
import { DEFAULT_ALL_PROJECTS, DEFAULT_GRANTS, SYSTEM_PROFILES, type Grants, type PermissionKey, type ProfileRef, type Scope, type SystemProfile } from "@timcontrol/shared";
import type { Tx } from "./client";
import { profilePermissions, profiles, projectMembers, users } from "./schema";

const SYSTEM_NAMES: Record<SystemProfile, string> = { gestor: "Gestor", membro: "Membro", visitante: "Visitante" };

/** Lista os perfis com a matriz de cada um. */
export async function listProfiles(tx: Tx): Promise<ProfileRef[]> {
  const rows = await tx.select().from(profiles).orderBy(sql`case ${profiles.systemKey} when 'gestor' then 0 when 'membro' then 1 when 'visitante' then 2 else 3 end`, asc(profiles.name));
  const perms = await tx.select().from(profilePermissions);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    systemKey: (p.systemKey as SystemProfile | null) ?? null,
    allProjects: p.allProjects,
    grants: Object.fromEntries(perms.filter((x) => x.profileId === p.id).map((x) => [x.permission, x.scope])) as Grants,
  }));
}

export async function getProfile(tx: Tx, id: string): Promise<ProfileRef | null> {
  return (await listProfiles(tx)).find((p) => p.id === id) ?? null;
}

export async function profileBySystemKey(tx: Tx, key: SystemProfile): Promise<ProfileRef | null> {
  return (await listProfiles(tx)).find((p) => p.systemKey === key) ?? null;
}

/** Cria os três perfis do sistema com a matriz padrão, se ainda não existem. Idempotente. */
export async function ensureSystemProfiles(tx: Tx): Promise<void> {
  for (const key of SYSTEM_PROFILES) {
    const [existing] = await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.systemKey, key));
    if (existing) continue;
    const [p] = await tx.insert(profiles).values({ name: SYSTEM_NAMES[key], systemKey: key, allProjects: DEFAULT_ALL_PROJECTS[key] }).returning({ id: profiles.id });
    await writeGrants(tx, p!.id, DEFAULT_GRANTS[key]);
  }
}

export async function writeGrants(tx: Tx, profileId: string, grants: Grants): Promise<void> {
  await tx.delete(profilePermissions).where(eq(profilePermissions.profileId, profileId));
  const rows = (Object.entries(grants) as [PermissionKey, Scope][]).map(([permission, scope]) => ({ profileId, permission, scope }));
  if (rows.length) await tx.insert(profilePermissions).values(rows);
}

export async function createProfile(tx: Tx, input: { name: string; allProjects: boolean; grants: Grants }): Promise<string> {
  const [p] = await tx.insert(profiles).values({ name: input.name, allProjects: input.allProjects }).returning({ id: profiles.id });
  await writeGrants(tx, p!.id, input.grants);
  return p!.id;
}

export async function updateProfile(tx: Tx, id: string, input: { name?: string; allProjects?: boolean }): Promise<void> {
  await tx.update(profiles).set(input).where(eq(profiles.id, id));
}

/** Perfil em uso (por alguém, globalmente ou num projeto) não pode ser apagado. */
export async function profileInUse(tx: Tx, id: string): Promise<boolean> {
  const [a] = await tx.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.globalProfileId, id));
  const [b] = await tx.select({ n: sql<number>`count(*)::int` }).from(projectMembers).where(eq(projectMembers.profileId, id));
  return (a?.n ?? 0) + (b?.n ?? 0) > 0;
}

export async function deleteProfile(tx: Tx, id: string): Promise<void> {
  await tx.delete(profiles).where(eq(profiles.id, id));
}
