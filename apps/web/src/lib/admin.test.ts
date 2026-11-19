import { DEFAULT_ALL_PROJECTS, DEFAULT_GRANTS, type ProfileRef, type Viewer } from "@timcontrol/shared";
import { adminSectionsFor } from "./admin";

const viewer = (key: "gestor" | "membro" | "visitante"): Viewer => {
  const p: ProfileRef = { id: key, name: key, systemKey: key, allProjects: DEFAULT_ALL_PROJECTS[key], grants: DEFAULT_GRANTS[key] };
  return { userId: "u", state: "active", globalProfile: p, projectProfiles: {} };
};

describe("menu de Configurações", () => {
  it("Gestor vê as 4 seções; Membro e Visitante, nenhuma", () => {
    expect(adminSectionsFor(viewer("gestor"))).toHaveLength(4);
    expect(adminSectionsFor(viewer("membro"))).toHaveLength(0);
    expect(adminSectionsFor(viewer("visitante"))).toHaveLength(0);
  });

  it("perfil com só 'grupos' vê só Grupos", () => {
    const v = viewer("membro");
    v.globalProfile = { ...v.globalProfile, systemKey: null, grants: { "admin.groups": "all" } };
    expect(adminSectionsFor(v).map((s) => s.title)).toEqual(["Grupos"]);
  });
});
