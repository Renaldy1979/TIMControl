import "server-only";
import { redirect } from "next/navigation";
import { can, type PermissionKey } from "@timcontrol/shared";
import { requireActor, type Actor } from "./actor";

/** Página de administração: sem a permissão, volta para o início (a Server Action confere de novo). */
export async function requireAdmin(key: PermissionKey): Promise<Actor> {
  const actor = await requireActor();
  if (!can(actor.viewer, key)) redirect("/");
  return actor;
}
