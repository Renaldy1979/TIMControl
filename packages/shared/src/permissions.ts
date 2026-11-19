import { ALL_ONLY, FEATURES, permissionKey, type Feature, type PermissionKey, type Scope, type SystemProfile, type UserState } from "./enums";

/** Permissões de um perfil: chave `funcionalidade.ação` → alcance. Chave ausente = não pode. */
export type Grants = Partial<Record<PermissionKey, Scope>>;

export interface ProfileRef {
  id: string;
  name: string;
  /** gestor | membro | visitante para os perfis do sistema; null para perfis criados pelo Gestor. */
  systemKey: SystemProfile | null;
  /** Vê todos os projetos com este perfil (sem precisar ser incluído em cada um). Visitante nasce com false. */
  allProjects: boolean;
  grants: Grants;
}

/** Quem está usando o sistema, com o perfil global e os perfis específicos por projeto. */
export interface Viewer {
  userId: string;
  state: UserState;
  globalProfile: ProfileRef;
  /** projectId → perfil naquele projeto (tabela project_members). */
  projectProfiles: Record<string, ProfileRef>;
}

/** Todas as chaves possíveis da matriz, na ordem em que aparecem na tela. */
export const ALL_PERMISSION_KEYS: PermissionKey[] = (Object.keys(FEATURES) as Feature[]).flatMap((f) =>
  FEATURES[f].map((a) => permissionKey(f, a) as PermissionKey),
);

export const isValidPermissionKey = (k: string): k is PermissionKey => (ALL_PERMISSION_KEYS as string[]).includes(k);
export const allowsOwn = (k: PermissionKey): boolean => !ALL_ONLY.has(k);

const full = (): Grants => Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, "all"])) as Grants;

/** Matriz padrão (docs/01, "Perfis e permissões"). O Gestor pode mudar Membro e Visitante depois. */
export const DEFAULT_GRANTS: Record<SystemProfile, Grants> = {
  gestor: full(),
  membro: {
    "kanban.view": "all",
    "kanban.create": "all",
    "kanban.edit": "own",
    "kanban.move": "own",
    "kanban.comment": "all",
  },
  visitante: {
    "kanban.view": "all",
  },
};

export const DEFAULT_ALL_PROJECTS: Record<SystemProfile, boolean> = { gestor: true, membro: true, visitante: false };

export const isGestorProfile = (p: ProfileRef): boolean => p.systemKey === "gestor";

/** O Gestor sempre tem tudo, mesmo que alguém tente gravar outra coisa no banco. */
export const effectiveGrants = (p: ProfileRef): Grants => (isGestorProfile(p) ? full() : p.grants);

export const isGestor = (v: Viewer): boolean => v.state === "active" && isGestorProfile(v.globalProfile);

/**
 * Perfil que vale num projeto:
 * 1. Gestor global vale em todos os projetos.
 * 2. Perfil específico do projeto (project_members), se houver.
 * 3. Senão, o perfil global, se ele "vê todos os projetos" (Membro). Visitante só vê o que foi liberado.
 */
export function profileFor(v: Viewer, projectId: string): ProfileRef | null {
  if (v.state !== "active") return null;
  if (isGestorProfile(v.globalProfile)) return v.globalProfile;
  const specific = v.projectProfiles[projectId];
  if (specific) return specific;
  return v.globalProfile.allProjects ? v.globalProfile : null;
}

export const canSeeProject = (v: Viewer, projectId: string): boolean => {
  const p = profileFor(v, projectId);
  return !!p && !!effectiveGrants(p)["kanban.view"];
};

/** Alcance de uma permissão. Sem projeto, vale o perfil global (ex.: administração). */
export function scopeOf(v: Viewer, key: PermissionKey, projectId?: string): Scope | null {
  if (v.state !== "active") return null;
  const p = projectId ? profileFor(v, projectId) : v.globalProfile;
  if (!p) return null;
  return effectiveGrants(p)[key] ?? null;
}

/**
 * Pode fazer? `own` diz se o item é da pessoa (criou ou é responsável). Com alcance "own", só vale para os próprios.
 */
export function can(v: Viewer, key: PermissionKey, opts: { projectId?: string; own?: boolean } = {}): boolean {
  const s = scopeOf(v, key, opts.projectId);
  if (s === "all") return true;
  if (s === "own") return opts.own === true;
  return false;
}

export interface CardRights {
  edit: boolean;
  move: boolean;
  delete: boolean;
  comment: boolean;
  /** Mexer nos responsáveis e etiquetas (= app_card_editable no SQL). */
  editStructure: boolean;
  /** Checklist e anexos (= app_card_workable no SQL): quem edita o card ou pode movê-lo. */
  work: boolean;
}

/** O que a pessoa pode fazer num card. Mesma regra de app_card_editable / app_card_workable (drizzle/0005 e 0009). */
export function cardRights(v: Viewer, card: { projectId: string; createdBy: string }, own: boolean): CardRights {
  const opts = { projectId: card.projectId, own };
  const edit = can(v, "kanban.edit", opts);
  const move = can(v, "kanban.move", opts);
  const editStructure = edit || (card.createdBy === v.userId && can(v, "kanban.create", { projectId: card.projectId }));
  return { edit, move, delete: can(v, "kanban.delete", opts), comment: can(v, "kanban.comment", opts), editStructure, work: editStructure || move };
}
