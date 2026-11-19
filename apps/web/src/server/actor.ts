import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { loadViewer, userByAppwriteId, withSistema, withUser, type Tx, type UserRow } from "@timcontrol/pg";
import { can, type PermissionKey, type Viewer } from "@timcontrol/shared";
import { currentAccount } from "./auth/session";
import { ForbiddenError } from "./errors";

export interface Actor {
  user: UserRow;
  viewer: Viewer;
}

/**
 * Quem está logado: sessão do Appwrite (validada a cada requisição) → pessoa no Postgres → perfis.
 * Sem sessão, sem cadastro ou desativado: volta para o login.
 */
export const currentActor = cache(async (): Promise<Actor | null> => {
  const account = await currentAccount();
  if (!account) return null;
  const user = await withSistema((tx) => userByAppwriteId(tx, account.id));
  if (!user || user.state !== "active") return null;
  const viewer = await withUser(user.id, (tx) => loadViewer(tx, user.id));
  return viewer ? { user, viewer } : null;
});

export async function requireActor(): Promise<Actor> {
  const a = await currentActor();
  if (!a) redirect("/login");
  return a;
}

/** Recusa no SERVIDOR (não só esconde na tela). */
export function requirePermission(actor: Actor, key: PermissionKey, opts?: { projectId?: string; own?: boolean }): void {
  if (!can(actor.viewer, key, opts)) throw new ForbiddenError(key);
}

/** Transação em nome de quem está logado (o RLS decide o que ela vê). */
export const asActor = <T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> => withUser(actor.user.id, fn);
