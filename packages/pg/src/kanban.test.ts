import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSistema, withUser } from "./context";
import { dbAvailable, freshDb, type TestDbs } from "./testing";
import { profileBySystemKey, writeGrants } from "./profiles";
import { insertUser } from "./users";
import { listProjects, setProjectMember } from "./projects";
import { createGroup, setGroupMembers } from "./groups";
import { seedInitialData } from "./seed";
import {
  addCardHistory, cardHistoryOf, createLabel, deleteCard, getCard, insertCard, listCards, listLabels, setCardAssignees, setCardLabels, updateCardFields,
  type CardWrite,
} from "./cards";
import { sql } from "drizzle-orm";

const hasDb = await dbAvailable();

const base = (projectId: string, over: Partial<CardWrite> = {}): CardWrite => ({
  projectId, type: "task", title: "Analisar lentidão", description: "", status: "todo", position: 1024, priority: "normal", dueDate: null,
  requesterId: null, requestedAt: null, externalRef: "", ...over,
});

describe.skipIf(!hasDb)("Kanban + RLS (Lote 2)", () => {
  let db: TestDbs;
  const u = { gestor: "", membro: "", membro2: "", visitante: "", fabrica: "" };
  const p = { tv: "", wcx: "", ecom: "" };
  let accenture = "";
  let cardDoMembro2 = "";

  beforeAll(async () => {
    db = await freshDb();
    await withSistema(async (tx) => {
      await seedInitialData(tx);
      const g = (await profileBySystemKey(tx, "gestor"))!.id;
      const m = (await profileBySystemKey(tx, "membro"))!.id;
      const v = (await profileBySystemKey(tx, "visitante"))!.id;
      u.gestor = await insertUser(tx, { name: "Gestor", email: "g@x.com", globalProfileId: g, state: "active" });
      u.membro = await insertUser(tx, { name: "Membro", email: "m@x.com", globalProfileId: m, state: "active" });
      u.membro2 = await insertUser(tx, { name: "Membro 2", email: "m2@x.com", globalProfileId: m, state: "active" });
      u.visitante = await insertUser(tx, { name: "Visitante", email: "v@x.com", globalProfileId: v, state: "active" });
      u.fabrica = await insertUser(tx, { name: "Fábrica", email: "f@x.com", globalProfileId: v, state: "active" });
      const all = await listProjects(tx);
      p.tv = all.find((x) => x.code === "TV")!.id;
      p.wcx = all.find((x) => x.code === "WCX")!.id;
      p.ecom = all.find((x) => x.code === "ECOM")!.id;
      await setProjectMember(tx, p.tv, u.visitante, v); // Visitante só vê TV, sem criar
      await setProjectMember(tx, p.wcx, u.fabrica, m); // Fábrica é Membro no WCX
      accenture = await createGroup(tx, { name: "Accenture X", description: "" });
      await setGroupMembers(tx, accenture, [u.fabrica]);
    }, db.app);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("etiquetas iniciais existem e só o Gestor cadastra", async () => {
    expect((await withUser(u.membro, (tx) => listLabels(tx), db.app)).length).toBeGreaterThanOrEqual(5);
    await expect(withUser(u.membro, (tx) => createLabel(tx, { name: "Nova", color: "#000000" }), db.app)).rejects.toThrow();
    await withUser(u.gestor, (tx) => createLabel(tx, { name: "Nova", color: "#000000" }), db.app);
  });

  it("Membro cria card com responsáveis, etiquetas e histórico", async () => {
    const id = await withUser(u.membro, async (tx) => {
      const id = await insertCard(tx, u.membro, base(p.tv, { type: "request", requesterId: u.membro }));
      await setCardAssignees(tx, id, [`u:${u.membro2}`, `g:${accenture}`]);
      const [l] = await listLabels(tx);
      await setCardLabels(tx, id, [l!.id]);
      await addCardHistory(tx, id, u.membro, "created", { status: "todo" });
      return id;
    }, db.app);
    const c = await withUser(u.membro, (tx) => getCard(tx, id), db.app);
    expect(c?.assignees.map((a) => a.kind)).toEqual(["user", "group"]);
    expect(c?.labels).toHaveLength(1);
    expect(await withUser(u.membro, (tx) => cardHistoryOf(tx, id), db.app)).toHaveLength(1);
  });

  it("não dá para criar card em nome de outra pessoa", async () => {
    await expect(withUser(u.membro, (tx) => insertCard(tx, u.gestor, base(p.tv)), db.app)).rejects.toThrow();
  });

  it("Visitante vê os cards só do projeto liberado e não cria", async () => {
    await withUser(u.membro, (tx) => insertCard(tx, u.membro, base(p.ecom, { title: "Card do Ecommerce" })), db.app);
    const seen = await withUser(u.visitante, (tx) => listCards(tx), db.app);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((c) => c.projectId === p.tv)).toBe(true);
    await expect(withUser(u.visitante, (tx) => insertCard(tx, u.visitante, base(p.tv)), db.app)).rejects.toThrow();
  });

  it("Membro edita e move só os seus (criou ou é responsável)", async () => {
    cardDoMembro2 = await withUser(u.membro2, (tx) => insertCard(tx, u.membro2, base(p.tv, { title: "Do Membro 2" })), db.app);
    // O RLS esconde a linha da alteração: nada muda, sem erro.
    expect(await withUser(u.membro, (tx) => updateCardFields(tx, cardDoMembro2, { status: "doing" }), db.app)).toBe(false);
    expect(await withUser(u.membro2, (tx) => updateCardFields(tx, cardDoMembro2, { status: "doing" }), db.app)).toBe(true);
    // Responsável passa a poder mover.
    await withUser(u.membro2, (tx) => setCardAssignees(tx, cardDoMembro2, [`u:${u.membro}`]), db.app);
    expect(await withUser(u.membro, (tx) => updateCardFields(tx, cardDoMembro2, { status: "review" }), db.app)).toBe(true);
  });

  it("responsável por grupo conta como 'seu'", async () => {
    const id = await withUser(u.fabrica, (tx) => insertCard(tx, u.fabrica, base(p.wcx, { title: "Da fábrica" })), db.app);
    const outro = await withUser(u.gestor, async (tx) => {
      const id = await insertCard(tx, u.gestor, base(p.wcx, { title: "Pedido à Accenture" }));
      await setCardAssignees(tx, id, [`g:${accenture}`]);
      return id;
    }, db.app);
    expect(await withUser(u.fabrica, (tx) => updateCardFields(tx, outro, { status: "doing" }), db.app)).toBe(true);
    expect(id).toBeTruthy();
    // A fábrica não vê TIM Vendas.
    expect(await withUser(u.fabrica, (tx) => getCard(tx, cardDoMembro2), db.app)).toBeNull();
  });

  it("Membro não exclui (padrão); Gestor exclui; com 'os seus' o Membro exclui só os seus", async () => {
    expect(await withUser(u.membro, (tx) => deleteCard(tx, cardDoMembro2), db.app)).toBe(false);
    const membro = await withSistema((tx) => profileBySystemKey(tx, "membro"), db.app);
    await withUser(u.gestor, (tx) => writeGrants(tx, membro!.id, { ...membro!.grants, "kanban.delete": "own" }), db.app);
    const meu = await withUser(u.membro, (tx) => insertCard(tx, u.membro, base(p.tv, { title: "Meu para excluir" })), db.app);
    const alheio = await withUser(u.gestor, (tx) => insertCard(tx, u.gestor, base(p.tv, { title: "Do Gestor" })), db.app);
    expect(await withUser(u.membro, (tx) => deleteCard(tx, alheio), db.app)).toBe(false);
    expect(await withUser(u.membro, (tx) => deleteCard(tx, meu), db.app)).toBe(true);
    expect(await withUser(u.gestor, (tx) => deleteCard(tx, alheio), db.app)).toBe(true);
  });

  it("filtros: minhas atividades, pedi a outros, atrasados e busca", async () => {
    const minhas = await withUser(u.fabrica, (tx) => listCards(tx, { assignedTo: u.fabrica }), db.app);
    expect(minhas.map((c) => c.title)).toContain("Pedido à Accenture");
    const pedi = await withUser(u.membro, (tx) => listCards(tx, { requestedBy: u.membro }), db.app);
    expect(pedi.every((c) => c.type === "request")).toBe(true);
    expect(pedi.length).toBe(1);
    await withUser(u.gestor, (tx) => insertCard(tx, u.gestor, base(p.tv, { title: "Vencido", dueDate: "2026-01-01" })), db.app);
    const atrasados = await withUser(u.gestor, (tx) => listCards(tx, { due: { kind: "overdue", today: "2026-11-19" } }), db.app);
    expect(atrasados.map((c) => c.title)).toEqual(["Vencido"]);
    const busca = await withUser(u.gestor, (tx) => listCards(tx, { q: "acc" }), db.app);
    expect(busca.map((c) => c.title)).toEqual(["Pedido à Accenture"]);
  });

  it("reuniões/WarRooms foram retiradas: sem tabelas e sem coluna no card", async () => {
    const r = await withSistema((tx) => tx.execute(sql`select to_regclass('meetings') as m, to_regclass('meeting_participants') as mp, (select count(*) from information_schema.columns where table_name = 'cards' and column_name = 'meeting_id')::int as col, (select count(*) from profile_permissions where permission like 'meetings.%')::int as perms`), db.app);
    expect(r[0]).toEqual({ m: null, mp: null, col: 0, perms: 0 });
  });
});
