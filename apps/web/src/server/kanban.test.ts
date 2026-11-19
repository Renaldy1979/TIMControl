import { describe, expect, it } from "vitest";
import { readFilters } from "./kanban";

describe("filtros do quadro (URL)", () => {
  it("aceita valores válidos e ignora os estranhos", () => {
    const id = "0b6f1c1e-6d0e-4a37-9c2e-3f1f1f1f1f1f";
    expect(readFilters({ projeto: id, prioridade: "urgent", prazo: "atrasados", resp: `g:${id}`, q: " lentidão " })).toEqual({
      projeto: id, resp: `g:${id}`, prioridade: "urgent", etiqueta: "", prazo: "atrasados", q: "lentidão",
    });
    expect(readFilters({ projeto: "1; drop table", prioridade: "max", prazo: "ontem", resp: "x:1" })).toEqual({
      projeto: "", resp: "", prioridade: "", etiqueta: "", prazo: "", q: "",
    });
    expect(readFilters({ resp: "eu" }).resp).toBe("eu");
  });
});
