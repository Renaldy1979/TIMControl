import type { z } from "zod";

/** Estado devolvido aos formulários (useActionState). */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

export const fd = (f: FormData, k: string): string => String(f.get(k) ?? "");
export const firstIssue = (e: z.ZodError): string => e.issues[0]?.message ?? "Confira os dados informados.";
