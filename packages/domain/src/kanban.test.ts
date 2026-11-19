import { describe, expect, it } from "vitest";
import { changedFields, describeHistory, dropPosition, dueState, formatDateBR, formatDateTimeBR, isOwnCard, positionBetween, todayInSaoPaulo, type CardSnapshot } from "./kanban";

describe("datas em São Paulo", () => {
  it("hoje usa o fuso de São Paulo, não UTC", () => {
    // 02:30 UTC de 20/11 ainda é 19/11 em São Paulo (UTC-3).
    expect(todayInSaoPaulo(new Date("2026-11-20T02:30:00Z"))).toBe("2026-11-19");
    expect(todayInSaoPaulo(new Date("2026-11-20T03:30:00Z"))).toBe("2026-11-20");
  });
  it("formata dd/mm/aaaa e 24h", () => {
    expect(formatDateBR("2026-01-05")).toBe("05/01/2026");
    expect(formatDateBR(null)).toBe("");
    expect(formatDateTimeBR(new Date("2026-11-19T18:05:00Z"))).toBe("19/11/2026 15:05");
  });
  it("situação do prazo", () => {
    const t = "2026-11-19";
    expect(dueState("2026-11-18", "doing", t)).toBe("overdue");
    expect(dueState("2026-11-18", "done", t)).toBe("done");
    expect(dueState("2026-11-19", "todo", t)).toBe("today");
    expect(dueState("2026-11-22", "todo", t)).toBe("soon");
    expect(dueState("2026-12-01", "todo", t)).toBe("later");
    expect(dueState(null, "todo", t)).toBe("none");
  });
});

describe("card meu (alcance 'os seus')", () => {
  const card = { createdBy: "a", assignees: [{ kind: "user" as const, id: "b" }, { kind: "group" as const, id: "g1" }] };
  it("quem criou, responsável direto ou por grupo", () => {
    expect(isOwnCard(card, "a", [])).toBe(true);
    expect(isOwnCard(card, "b", [])).toBe(true);
    expect(isOwnCard(card, "c", ["g1"])).toBe(true);
    expect(isOwnCard(card, "c", ["g2"])).toBe(false);
  });
});

describe("ordem na coluna", () => {
  it("entre dois vizinhos, no fim e no começo", () => {
    expect(positionBetween(null, null)).toBe(1024);
    expect(positionBetween(1024, null)).toBe(2048);
    expect(positionBetween(null, 1024)).toBe(512);
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(1, 1 + 1e-9)).toBeNull();
  });
  it("posição ao soltar antes de um card", () => {
    const col = [
      { id: "x", position: 1024 },
      { id: "y", position: 2048 },
      { id: "z", position: 3072 },
    ];
    expect(dropPosition(col, "m", "y")).toBe(1536);
    expect(dropPosition(col, "m", "x")).toBe(512);
    expect(dropPosition(col, "m", null)).toBe(4096);
    // Mover "z" para antes de "x" ignora a própria posição.
    expect(dropPosition(col, "z", "x")).toBe(512);
  });
});

describe("histórico", () => {
  const base: CardSnapshot = {
    title: "A", description: "", type: "task", priority: "normal", dueDate: null, projectId: "p", requesterId: null, requestedAt: null,
    externalRef: "", assignees: ["u:1", "g:2"], labelIds: [],
  };
  it("lista só o que mudou e ignora a ordem dos responsáveis", () => {
    expect(changedFields(base, { ...base, assignees: ["g:2", "u:1"] })).toEqual([]);
    expect(changedFields(base, { ...base, title: "B", dueDate: "2026-12-01" })).toEqual(["título", "prazo"]);
  });
  it("frases em português", () => {
    expect(describeHistory("moved", { from: "todo", to: "doing" })).toBe("moveu de A Fazer para Em andamento");
    expect(describeHistory("edited", { fields: ["título"] })).toBe("alterou título");
  });
});
