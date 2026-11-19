import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { adminUrl, appUrl } from "./env";
import { runMigrations } from "./migrate";
import * as schema from "./schema";
import type { Db } from "./client";

/**
 * Apoio aos testes de integração (Postgres real do docker-compose.dev.yml).
 * Sem banco, os testes de integração são pulados; com REQUIRE_DB=1 (CI) a falta do banco FALHA.
 */
export async function dbAvailable(): Promise<boolean> {
  const sql = postgres(adminUrl(), { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await sql`select 1`;
    return true;
  } catch (e) {
    if (process.env.REQUIRE_DB === "1") throw e;
    return false;
  } finally {
    await sql.end();
  }
}

export interface TestDbs {
  admin: Db;
  app: Db;
  close: () => Promise<void>;
}

/** Migra, limpa todas as tabelas e devolve as duas conexões: dono (sem RLS) e aplicação (com RLS). */
export async function freshDb(): Promise<TestDbs> {
  await runMigrations();
  const a = postgres(adminUrl(), { max: 2, onnotice: () => {} });
  const b = postgres(appUrl(), { max: 4, prepare: false, onnotice: () => {} });
  await a`truncate notifications, attachments, comment_mentions, comments, checklist_items, card_history, card_labels, card_assignees, cards, labels, audit_log, group_members, groups, project_members, invites, users, projects, profile_permissions, profiles restart identity cascade`;
  return {
    admin: drizzle(a, { schema }),
    app: drizzle(b, { schema }),
    close: async () => {
      await a.end();
      await b.end();
    },
  };
}
