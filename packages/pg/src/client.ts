import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { appUrl } from "./env";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let _sql: ReturnType<typeof postgres> | undefined;
let _db: Db | undefined;

/** Conexão da APLICAÇÃO (papel timcontrol_app, sem BYPASSRLS). Pool único por processo. */
export function getDb(url?: string): Db {
  if (_db) return _db;
  _sql = postgres(url ?? appUrl(), { max: 10, prepare: false, onnotice: () => {} });
  _db = drizzle(_sql, { schema });
  return _db;
}

export async function closeDb(): Promise<void> {
  await _sql?.end();
  _sql = undefined;
  _db = undefined;
}

/** Banco responde? Usado pelo /api/health. */
export async function ping(db: Db = getDb()): Promise<boolean> {
  try {
    await db.execute("select 1");
    return true;
  } catch {
    return false;
  }
}
