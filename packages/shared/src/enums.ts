/**
 * Funcionalidades e ações da matriz de permissões (docs/02, seção "Permissões").
 * Uma funcionalidade nova (indicadores, férias) entra aqui e ganha linhas na matriz, sem mudar o código de permissão.
 */
export const FEATURES = {
  kanban: ["view", "create", "edit", "move", "comment", "delete"],
  meetings: ["view", "create", "edit", "delete"],
  admin: ["users", "profiles", "projects", "groups"],
} as const;

export type Feature = keyof typeof FEATURES;
export type Action<F extends Feature = Feature> = (typeof FEATURES)[F][number];

/** Alcance de uma permissão: todos os itens, só os próprios (criados por mim ou em que sou responsável) ou nenhum. */
export const SCOPES = ["all", "own"] as const;
export type Scope = (typeof SCOPES)[number];

/** Ações que só fazem sentido com alcance "todos" (não existe "administrar os próprios usuários"). */
export const ALL_ONLY: ReadonlySet<string> = new Set(["admin.users", "admin.profiles", "admin.projects", "admin.groups", "kanban.view", "meetings.view", "kanban.create", "meetings.create"]);

/** Perfis que nascem com o sistema. O Gestor tem tudo e não pode ser editado (evita alguém se trancar fora). */
export const SYSTEM_PROFILES = ["gestor", "membro", "visitante"] as const;
export type SystemProfile = (typeof SYSTEM_PROFILES)[number];

export const USER_STATES = ["invited", "active", "disabled"] as const;
export type UserState = (typeof USER_STATES)[number];

export const TOWERS = ["producao", "sustentacao", "ambas"] as const;
export type Tower = (typeof TOWERS)[number];

export const permissionKey = (feature: Feature, action: string) => `${feature}.${action}`;
export type PermissionKey = `${Feature}.${string}`;
