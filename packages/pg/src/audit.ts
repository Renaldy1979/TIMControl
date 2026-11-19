import type { Tx } from "./client";
import { auditLog } from "./schema";

/** Registra uma ação de administração. `details` nunca leva senha, token ou conteúdo de anexo. */
export async function audit(
  tx: Tx,
  actorUserId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await tx.insert(auditLog).values({ actorUserId, action, entity, entityId, details });
}
