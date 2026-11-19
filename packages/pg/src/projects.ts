import { and, asc, eq } from "drizzle-orm";
import type { Tower } from "@timcontrol/shared";
import type { Tx } from "./client";
import { projectMembers, projects } from "./schema";

export interface ProjectRow {
  id: string;
  name: string;
  code: string;
  tower: Tower;
  color: string;
  active: boolean;
}

/** Só o que o RLS deixa a pessoa ver (Gestor vê todos; Visitante só os liberados). */
export async function listProjects(tx: Tx): Promise<ProjectRow[]> {
  const rows = await tx.select().from(projects).orderBy(asc(projects.name));
  return rows.map((p) => ({ id: p.id, name: p.name, code: p.code, tower: p.tower as Tower, color: p.color, active: p.active }));
}

export async function createProject(tx: Tx, input: Omit<ProjectRow, "id" | "active">): Promise<string> {
  const [p] = await tx.insert(projects).values(input).returning({ id: projects.id });
  return p!.id;
}

export async function updateProject(tx: Tx, id: string, input: Partial<Omit<ProjectRow, "id">>): Promise<void> {
  await tx.update(projects).set(input).where(eq(projects.id, id));
}

export async function listProjectMembers(tx: Tx, projectId?: string) {
  const q = tx.select().from(projectMembers);
  return projectId ? q.where(eq(projectMembers.projectId, projectId)) : q;
}

export async function setProjectMember(tx: Tx, projectId: string, userId: string, profileId: string): Promise<void> {
  await tx
    .insert(projectMembers)
    .values({ projectId, userId, profileId })
    .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { profileId } });
}

export async function removeProjectMember(tx: Tx, projectId: string, userId: string): Promise<void> {
  await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}
