/** Convite por e-mail: vale 7 dias e uma só vez (docs/03, "Convite"). */
export const INVITE_TTL_DAYS = 7;

export const inviteExpiresAt = (now: Date = new Date()): Date => new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 3600 * 1000);

export type InviteStatus = "valid" | "expired" | "used";

export function inviteStatus(invite: { expiresAt: Date; acceptedAt: Date | null }, now: Date = new Date()): InviteStatus {
  if (invite.acceptedAt) return "used";
  return invite.expiresAt.getTime() <= now.getTime() ? "expired" : "valid";
}
