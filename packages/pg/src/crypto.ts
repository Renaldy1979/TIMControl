import { createHash, randomBytes } from "node:crypto";

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Token aleatório para links (convite). Só o hash vai para o banco. */
export const newToken = (): string => randomBytes(32).toString("base64url");
