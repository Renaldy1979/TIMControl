import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSistema, withUser } from "./context";
import { dbAvailable, freshDb, type TestDbs } from "./testing";
import { profileBySystemKey } from "./profiles";
import { insertUser } from "./users";
import { listProjects, setProjectMember } from "./projects";
import { createGroup, setGroupMembers } from "./groups";
import { seedInitialData } from "./seed";
import { getCard, insertCard, setCardAssignees, updateCardFields, type CardWrite } from "./cards";
import {
  addChecklistItem, cardAudience, dashboardCounts, deleteAttachment, deleteComment, insertAttachment, insertComment, listAttachments, listChecklist, listComments,
  listNotifications, markNotificationsRead, notify, setChecklistItemDone, unreadCount, updateComment,
} from "./collab";

const hasDb = await dbAvailable();

const base = (projectId: string, over: Partial<CardWrite> = {}): CardWrite => ({
  projectId, title: "Analisar lentidão", description: "", status: "todo", position: 1024, priority: "normal", dueDate: null, externalRef: "", ...over,
});

describe.skipIf(!hasDb)("Colaboração + RLS (Lote 3)", () => {
  let db: TestDbs;
  const u = { gestor: "", membro: "", membro2: "", visitante: "", fabrica: "" };
  const p = { tv: "", wcx: "" };
  let accenture = "";
  let card = ""; // TIM Vendas, criado pelo Membro 2, responsável o Membro
  let cardWcx = ""; // WhatsApp CX, responsável o grupo Accenture

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
      await setProjectMember(tx, p.tv, u.visitante, v); // Visitante só vê TV, sem comentar nem mover
      await setProjectMember(tx, p.wcx, u.fabrica, m); // Fábrica é Membro no WCX
      accenture = await createGroup(tx, { name: "Accenture X", description: "" });
      await setGroupMembers(tx, accenture, [u.fabrica]);
    }, db.app);
    card = await withUser(u.membro2, async (tx) => {
      const id = await insertCard(tx, u.membro2, base(p.tv, { dueDate: "2026-01-01" }));
      await setCardAssignees(tx, id, [`u:${u.membro}`]);
      return id;
    }, db.app);
    cardWcx = await withUser(u.gestor, async (tx) => {
      const id = await insertCard(tx, u.gestor, base(p.wcx, { title: "Pedido à Accenture" }));
      await setCardAssignees(tx, id, [`g:${accenture}`]);
      return id;
    }, db.app);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("checklist: responsável cria e marca; Visitante só lê; o quadro mostra o progresso", async () => {
    const item = await withUser(u.membro, (tx) => addChecklistItem(tx, card, u.membro, "Coletar logs"), db.app);
    await withUser(u.membro, (tx) => addChecklistItem(tx, card, u.membro, "Abrir chamado"), db.app);
    expect(await withUser(u.membro, (tx) => setChecklistItemDone(tx, item, true, u.membro), db.app)).toBe(true);
    await expect(withUser(u.visitante, (tx) => addChecklistItem(tx, card, u.visitante, "x"), db.app)).rejects.toThrow();
    expect(await withUser(u.visitante, (tx) => setChecklistItemDone(tx, item, false, u.visitante), db.app)).toBe(false);
    const items = await withUser(u.visitante, (tx) => listChecklist(tx, card), db.app);
    expect(items.map((i) => [i.text, i.done, i.doneByName])).toEqual([["Coletar logs", true, "Membro"], ["Abrir chamado", false, null]]);
    const c = await withUser(u.visitante, (tx) => getCard(tx, card), db.app);
    expect(c?.checklist).toEqual({ done: 1, total: 2 });
    // A fábrica não vê TIM Vendas: nem o checklist.
    expect(await withUser(u.fabrica, (tx) => listChecklist(tx, card), db.app)).toHaveLength(0);
  });

  it("comentários: Membro comenta e menciona; Visitante não comenta; só o autor edita; o Gestor apaga", async () => {
    const id = await withUser(u.membro, (tx) => insertComment(tx, card, u.membro, "Coletei os logs.", [u.membro2]), db.app);
    await expect(withUser(u.visitante, (tx) => insertComment(tx, card, u.visitante, "Oi", []), db.app)).rejects.toThrow();
    await expect(withUser(u.membro, (tx) => insertComment(tx, card, u.membro2, "Em nome de outro", []), db.app)).rejects.toThrow();
    expect(await withUser(u.membro2, (tx) => updateComment(tx, id, "editado"), db.app)).toBe(false);
    expect(await withUser(u.membro, (tx) => updateComment(tx, id, "Coletei os logs de ontem."), db.app)).toBe(true);
    const list = await withUser(u.visitante, (tx) => listComments(tx, card), db.app);
    expect(list[0]).toMatchObject({ body: "Coletei os logs de ontem.", authorName: "Membro", mentions: [{ id: u.membro2, name: "Membro 2" }] });
    expect(list[0]!.editedAt).not.toBeNull();
    expect(await withUser(u.membro2, (tx) => deleteComment(tx, id), db.app)).toBe(false);
    expect(await withUser(u.gestor, (tx) => deleteComment(tx, id), db.app)).toBe(true);
  });

  it("anexos: quem trabalha no card envia; Visitante lê mas não envia; quem enviou apaga", async () => {
    const row = { cardId: card, fileId: "f-1", name: "print.png", mimeType: "image/png", size: 1234 };
    const id = await withUser(u.membro, (tx) => insertAttachment(tx, { ...row, uploadedBy: u.membro }), db.app);
    await expect(withUser(u.visitante, (tx) => insertAttachment(tx, { ...row, fileId: "f-2", uploadedBy: u.visitante }), db.app)).rejects.toThrow();
    expect((await withUser(u.visitante, (tx) => listAttachments(tx, card), db.app)).map((a) => a.uploadedByName)).toEqual(["Membro"]);
    expect(await withUser(u.fabrica, (tx) => listAttachments(tx, card), db.app)).toHaveLength(0);
    expect(await withUser(u.visitante, (tx) => deleteAttachment(tx, id), db.app)).toBe(false);
    expect(await withUser(u.membro, (tx) => deleteAttachment(tx, id), db.app)).toBe(true);
  });

  it("notificações: só a destinatária lê, só enquanto vê o card, e ninguém grava em nome de outro", async () => {
    // Quem acompanha o card do WCX: o Gestor (criou) e a fábrica (pelo grupo).
    expect((await withUser(u.gestor, (tx) => cardAudience(tx, cardWcx), db.app)).sort()).toEqual([u.gestor, u.fabrica].sort());
    const n = await withUser(u.gestor, (tx) => notify(tx, u.gestor, cardWcx, "assigned", [u.fabrica, u.gestor]), db.app);
    expect(n).toBe(1); // quem agiu não é avisado
    expect(await withUser(u.fabrica, (tx) => unreadCount(tx, u.fabrica), db.app)).toBe(1);
    const [aviso] = await withUser(u.fabrica, (tx) => listNotifications(tx, u.fabrica), db.app);
    expect(aviso).toMatchObject({ kind: "assigned", cardTitle: "Pedido à Accenture", actorName: "Gestor" });
    // Outra pessoa não vê nem marca o aviso da fábrica.
    expect(await withUser(u.membro, (tx) => listNotifications(tx, u.fabrica), db.app)).toHaveLength(0);
    await withUser(u.membro, (tx) => markNotificationsRead(tx, u.fabrica), db.app);
    expect(await withUser(u.fabrica, (tx) => unreadCount(tx, u.fabrica), db.app)).toBe(1);
    // Não dá para gravar aviso em nome de outra pessoa.
    await expect(withUser(u.membro, (tx) => notify(tx, u.gestor, card, "moved", [u.membro2]), db.app)).rejects.toThrow();
    // Aviso de um card que a fábrica não vê fica invisível para ela.
    await withUser(u.membro, (tx) => notify(tx, u.membro, card, "mentioned", [u.fabrica]), db.app);
    expect(await withUser(u.fabrica, (tx) => unreadCount(tx, u.fabrica), db.app)).toBe(1);
    expect(await withUser(u.fabrica, (tx) => markNotificationsRead(tx, u.fabrica, { id: aviso!.id }), db.app)).toBe(cardWcx);
    expect(await withUser(u.fabrica, (tx) => unreadCount(tx, u.fabrica), db.app)).toBe(0);
  });

  it("contadores do Início ficam dentro dos projetos que a pessoa vê", async () => {
    await withUser(u.membro, (tx) => updateCardFields(tx, card, { status: "doing" }), db.app);
    const membro = await withUser(u.membro, (tx) => dashboardCounts(tx, [p.tv, p.wcx], u.membro, "2026-11-19"), db.app);
    expect(membro).toMatchObject({ mine: 1, overdue: 1 });
    const fabrica = await withUser(u.fabrica, (tx) => dashboardCounts(tx, [p.tv, p.wcx], u.fabrica, "2026-11-19"), db.app);
    expect(fabrica).toMatchObject({ mine: 1, overdue: 0 });
  });
});
