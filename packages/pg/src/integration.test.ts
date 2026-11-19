import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { withSistema, withUser } from "./context";
import { dbAvailable, freshDb, type TestDbs } from "./testing";
import { listProfiles, profileBySystemKey, writeGrants } from "./profiles";
import { insertUser, loadViewer, listUsers } from "./users";
import { createProject, listProjects, setProjectMember } from "./projects";
import { createGroup, listGroups, setGroupMembers } from "./groups";
import { seedInitialData } from "./seed";
import { audit } from "./audit";
import * as s from "./schema";

const hasDb = await dbAvailable();

describe.skipIf(!hasDb)("Postgres + RLS (Lote 1)", () => {
  let db: TestDbs;
  const ids = { gestor: "", membro: "", visitante: "", fabrica: "", convidado: "", desativado: "" };
  const proj = { tv: "", wcx: "", ecom: "" };

  beforeAll(async () => {
    db = await freshDb();
    await withSistema(async (tx) => {
      await seedInitialData(tx);
      const g = (await profileBySystemKey(tx, "gestor"))!.id;
      const m = (await profileBySystemKey(tx, "membro"))!.id;
      const v = (await profileBySystemKey(tx, "visitante"))!.id;
      ids.gestor = await insertUser(tx, { name: "Renaldy", email: "gestor@exemplo.com", globalProfileId: g, state: "active", appwriteUserId: "aw-g" });
      ids.membro = await insertUser(tx, { name: "Membro", email: "membro@exemplo.com", globalProfileId: m, state: "active" });
      ids.visitante = await insertUser(tx, { name: "Visitante", email: "visit@exemplo.com", globalProfileId: v, state: "active" });
      ids.fabrica = await insertUser(tx, { name: "Fábrica", email: "fab@exemplo.com", globalProfileId: v, state: "active" });
      ids.convidado = await insertUser(tx, { name: "Convidado", email: "conv@exemplo.com", globalProfileId: m, state: "invited" });
      ids.desativado = await insertUser(tx, { name: "Desativado", email: "off@exemplo.com", globalProfileId: g, state: "disabled" });
      const all = await listProjects(tx);
      proj.tv = all.find((p) => p.code === "TV")!.id;
      proj.wcx = all.find((p) => p.code === "WCX")!.id;
      proj.ecom = all.find((p) => p.code === "ECOM")!.id;
      await setProjectMember(tx, proj.tv, ids.visitante, v);
      await setProjectMember(tx, proj.wcx, ids.fabrica, m);
    }, db.app);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("seed cria 3 perfis, 3 projetos e 3 grupos, e é idempotente", async () => {
    await withSistema((tx) => seedInitialData(tx), db.app);
    const counts = await withSistema(async (tx) => ({
      profiles: (await listProfiles(tx)).length,
      projects: (await listProjects(tx)).length,
      groups: (await listGroups(tx)).length,
    }), db.app);
    expect(counts).toEqual({ profiles: 3, projects: 3, groups: 3 });
  });

  it("sem contexto, o papel da aplicação não vê nada", async () => {
    const rows = await db.app.select().from(s.users);
    expect(rows).toHaveLength(0);
  });

  it("Gestor e Membro veem os 3 projetos", async () => {
    expect(await withUser(ids.gestor, (tx) => listProjects(tx), db.app)).toHaveLength(3);
    expect(await withUser(ids.membro, (tx) => listProjects(tx), db.app)).toHaveLength(3);
  });

  it("Visitante só vê o projeto liberado", async () => {
    const ps = await withUser(ids.visitante, (tx) => listProjects(tx), db.app);
    expect(ps.map((p) => p.code)).toEqual(["TV"]);
  });

  it("pessoa da fábrica vê só o projeto em que é Membro e tem perfil Membro nele", async () => {
    const ps = await withUser(ids.fabrica, (tx) => listProjects(tx), db.app);
    expect(ps.map((p) => p.code)).toEqual(["WCX"]);
    const v = await withUser(ids.fabrica, (tx) => loadViewer(tx, ids.fabrica), db.app);
    expect(v?.projectProfiles[proj.wcx]?.systemKey).toBe("membro");
  });

  it("convidado e desativado (mesmo Gestor) não veem nada", async () => {
    expect(await withUser(ids.convidado, (tx) => listProjects(tx), db.app)).toHaveLength(0);
    expect(await withUser(ids.desativado, (tx) => listProjects(tx), db.app)).toHaveLength(0);
    expect(await withUser(ids.desativado, (tx) => listUsers(tx), db.app)).toHaveLength(0);
  });

  it("Membro não altera projetos nem perfis; Gestor altera", async () => {
    await expect(withUser(ids.membro, (tx) => createProject(tx, { name: "Novo", code: "NV", color: "#7C5CFC" }), db.app)).rejects.toThrow();
    const membro = await withSistema((tx) => profileBySystemKey(tx, "membro"), db.app);
    await expect(withUser(ids.membro, (tx) => writeGrants(tx, membro!.id, { "admin.users": "all" }), db.app)).rejects.toThrow();
    await withUser(ids.membro, (tx) => writeGrants(tx, membro!.id, {}), db.app);
    // o DELETE do Membro não passa pelo RLS: a matriz continua igual
    const after = await withSistema((tx) => profileBySystemKey(tx, "membro"), db.app);
    expect(Object.keys(after!.grants).length).toBeGreaterThan(0);

    const id = await withUser(ids.gestor, (tx) => createProject(tx, { name: "Portal B2B", code: "B2B", color: "#0EA5E9" }), db.app);
    expect(id).toMatch(/[0-9a-f-]{36}/);
  });

  it("projeto novo aparece para o Membro e não para o Visitante", async () => {
    expect((await withUser(ids.membro, (tx) => listProjects(tx), db.app)).map((p) => p.code)).toContain("B2B");
    expect((await withUser(ids.visitante, (tx) => listProjects(tx), db.app)).map((p) => p.code)).not.toContain("B2B");
  });

  it("grupos: Gestor cria e define membros; todos os ativos leem", async () => {
    const gid = await withUser(ids.gestor, async (tx) => {
      const id = await createGroup(tx, { name: "Sustentação", description: "" });
      await setGroupMembers(tx, id, [ids.membro, ids.fabrica, ids.membro]);
      return id;
    }, db.app);
    const gs = await withUser(ids.visitante, (tx) => listGroups(tx), db.app);
    expect(gs.find((g) => g.id === gid)?.memberIds.sort()).toEqual([ids.membro, ids.fabrica].sort());
  });

  it("auditoria: grava em nome próprio, não em nome de outro; só o Gestor lê", async () => {
    await withUser(ids.membro, (tx) => audit(tx, ids.membro, "teste", "user", ids.membro), db.app);
    await expect(withUser(ids.membro, (tx) => audit(tx, ids.gestor, "falso", "user", null), db.app)).rejects.toThrow();
    expect(await withUser(ids.membro, (tx) => tx.select().from(s.auditLog), db.app)).toHaveLength(0);
    const rows = await withUser(ids.gestor, (tx) => tx.select().from(s.auditLog).where(eq(s.auditLog.action, "teste")), db.app);
    expect(rows).toHaveLength(1);
  });
});
