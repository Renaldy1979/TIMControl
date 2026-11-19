import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { PROJECT_COLORS } from "@timcontrol/shared";
import type { Tx } from "./client";
import { adminUrl } from "./env";
import { ensureSystemProfiles } from "./profiles";
import * as schema from "./schema";

/** Projetos e grupos com que o sistema começa (docs/01). O Gestor cadastra outros pela tela. */
export const INITIAL_PROJECTS = [
  { name: "TIM Vendas", code: "TV", tower: "producao", color: PROJECT_COLORS[0] },
  { name: "WhatsApp CX", code: "WCX", tower: "producao", color: PROJECT_COLORS[3] },
  { name: "Ecommerce", code: "ECOM", tower: "producao", color: PROJECT_COLORS[1] },
] as const;

export const INITIAL_GROUPS = [
  { name: "Time TIM", description: "Torres de produção e sustentação" },
  { name: "Accenture", description: "Fábrica" },
  { name: "Engineering", description: "Fábrica" },
] as const;

/**
 * Dados iniciais: perfis do sistema com a matriz padrão e, se o banco ainda não tiver nenhum,
 * os 3 projetos e 3 grupos iniciais. Idempotente: pode rodar de novo sem duplicar.
 */
export async function seedInitialData(tx: Tx): Promise<void> {
  await ensureSystemProfiles(tx);
  const [p] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.projects);
  if ((p?.n ?? 0) === 0) await tx.insert(schema.projects).values(INITIAL_PROJECTS.map((x) => ({ ...x })));
  const [g] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.groups);
  if ((g?.n ?? 0) === 0) await tx.insert(schema.groups).values(INITIAL_GROUPS.map((x) => ({ ...x })));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const conn = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    await drizzle(conn, { schema }).transaction((tx) => seedInitialData(tx));
    console.warn("Dados iniciais conferidos (perfis, projetos e grupos).");
  } finally {
    await conn.end();
  }
}
