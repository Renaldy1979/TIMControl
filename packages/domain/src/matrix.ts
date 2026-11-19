import { allowsOwn, isValidPermissionKey, type Grants, type PermissionKey, type Scope } from "@timcontrol/shared";

export interface MatrixChange {
  key: string;
  scope: Scope | null;
}

/**
 * Aplica mudanças na matriz de um perfil, recusando chaves desconhecidas e "own" onde só cabe "todos".
 * Perfis do sistema "gestor" nunca são editados (a chamada recusa antes de chegar aqui).
 */
export function applyMatrixChanges(current: Grants, changes: MatrixChange[]): Grants {
  const next: Grants = { ...current };
  for (const c of changes) {
    if (!isValidPermissionKey(c.key)) throw new Error(`Permissão desconhecida: ${c.key}`);
    const key = c.key as PermissionKey;
    if (c.scope === "own" && !allowsOwn(key)) throw new Error(`"${key}" não aceita o alcance "os seus"`);
    if (c.scope === null) delete next[key];
    else next[key] = c.scope;
  }
  return next;
}

/** Quem não vê o kanban não pode fazer mais nada nele: ver é pré-requisito das outras ações. */
export function normalizeGrants(g: Grants): Grants {
  const out: Grants = { ...g };
  if (!out["kanban.view"]) for (const k of Object.keys(out)) if (k.startsWith("kanban.")) delete out[k as PermissionKey];
  if (!out["meetings.view"]) for (const k of Object.keys(out)) if (k.startsWith("meetings.")) delete out[k as PermissionKey];
  return out;
}
