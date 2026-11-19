import { describe, expect, it } from "vitest";
import { can, canSeeProject, DEFAULT_ALL_PROJECTS, DEFAULT_GRANTS, profileFor, type ProfileRef, type Viewer } from "./permissions";
import { cardSchema, projectSchema } from "./schemas";

const prof = (systemKey: "gestor" | "membro" | "visitante"): ProfileRef => ({
  id: systemKey,
  name: systemKey,
  systemKey,
  allProjects: DEFAULT_ALL_PROJECTS[systemKey],
  grants: DEFAULT_GRANTS[systemKey],
});
const viewer = (g: ProfileRef, projectProfiles: Record<string, ProfileRef> = {}, state: Viewer["state"] = "active"): Viewer => ({
  userId: "u1",
  state,
  globalProfile: g,
  projectProfiles,
});

describe("permissões", () => {
  it("Gestor pode tudo em qualquer projeto, mesmo com grants vazios no banco", () => {
    const v = viewer({ ...prof("gestor"), grants: {} });
    expect(can(v, "admin.users")).toBe(true);
    expect(can(v, "kanban.delete", { projectId: "p1" })).toBe(true);
  });

  it("Membro vê todos os projetos e edita só os próprios cards", () => {
    const v = viewer(prof("membro"));
    expect(canSeeProject(v, "p1")).toBe(true);
    expect(can(v, "kanban.edit", { projectId: "p1", own: false })).toBe(false);
    expect(can(v, "kanban.edit", { projectId: "p1", own: true })).toBe(true);
    expect(can(v, "kanban.delete", { projectId: "p1", own: true })).toBe(false);
    expect(can(v, "admin.users")).toBe(false);
  });

  it("Visitante só vê projetos liberados para ele", () => {
    const v = viewer(prof("visitante"), { p2: prof("visitante") });
    expect(canSeeProject(v, "p1")).toBe(false);
    expect(canSeeProject(v, "p2")).toBe(true);
    expect(can(v, "kanban.create", { projectId: "p2" })).toBe(false);
  });

  it("pessoa da fábrica: Visitante global e Membro no projeto liberado", () => {
    const v = viewer(prof("visitante"), { p1: prof("membro") });
    expect(profileFor(v, "p1")?.systemKey).toBe("membro");
    expect(can(v, "kanban.move", { projectId: "p1", own: true })).toBe(true);
    expect(canSeeProject(v, "p3")).toBe(false);
  });

  it("convidado ou desativado não pode nada", () => {
    expect(can(viewer(prof("gestor"), {}, "invited"), "admin.users")).toBe(false);
    expect(canSeeProject(viewer(prof("membro"), {}, "disabled"), "p1")).toBe(false);
  });
});

describe("projeto", () => {
  it("sigla vira maiúscula e valida", () => {
    expect(projectSchema.parse({ name: "TIM Vendas", code: "tv", color: "#7C5CFC" }).code).toBe("TV");
    expect(projectSchema.safeParse({ name: "X", code: "t", color: "#7C5CFC" }).success).toBe(false);
  });
});

describe("card", () => {
  const base = { projectId: "8c1f2a9e-1b2c-4d3e-8f40-123456789abc", title: "Analisar logs", dueDate: "" };
  it("sempre precisa de um responsável (pessoa ou grupo)", () => {
    expect(cardSchema.safeParse({ ...base, assignees: [] }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, assignees: ["g:8c1f2a9e-1b2c-4d3e-8f40-123456789abd"] }).success).toBe(true);
  });
});
