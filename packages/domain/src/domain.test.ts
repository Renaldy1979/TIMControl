import { describe, expect, it } from "vitest";
import { DEFAULT_GRANTS } from "@timcontrol/shared";
import { applyMatrixChanges, inviteExpiresAt, inviteStatus, normalizeGrants } from "./index";

describe("convite", () => {
  it("vale 7 dias e uma vez", () => {
    const now = new Date("2026-11-19T12:00:00Z");
    const exp = inviteExpiresAt(now);
    expect(exp.toISOString()).toBe("2026-11-26T12:00:00.000Z");
    expect(inviteStatus({ expiresAt: exp, acceptedAt: null }, now)).toBe("valid");
    expect(inviteStatus({ expiresAt: exp, acceptedAt: null }, new Date("2026-11-27T00:00:00Z"))).toBe("expired");
    expect(inviteStatus({ expiresAt: exp, acceptedAt: now }, now)).toBe("used");
  });
});

describe("matriz", () => {
  it("liga, desliga e muda o alcance", () => {
    const g = applyMatrixChanges(DEFAULT_GRANTS.membro, [
      { key: "kanban.delete", scope: "own" },
      { key: "kanban.comment", scope: null },
    ]);
    expect(g["kanban.delete"]).toBe("own");
    expect(g["kanban.comment"]).toBeUndefined();
  });

  it("recusa chave desconhecida e 'own' onde não cabe", () => {
    expect(() => applyMatrixChanges({}, [{ key: "kanban.fly", scope: "all" }])).toThrow();
    expect(() => applyMatrixChanges({}, [{ key: "admin.users", scope: "own" }])).toThrow();
  });

  it("sem ver o kanban, as outras ações do kanban caem", () => {
    expect(normalizeGrants({ "kanban.edit": "all", "admin.groups": "all" })).toEqual({ "admin.groups": "all" });
  });
});
