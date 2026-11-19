// Migrações dentro da imagem Docker (docs/09, passo "Migração"). Usa o papel DONO do banco:
//   DATABASE_URL_ADMIN=postgres://timcontrol_owner:SENHA@HOST:5432/timcontrol node /app/migrate/migrate.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL_ADMIN;
if (!url) {
  console.error("Defina DATABASE_URL_ADMIN (papel dono do banco).");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: path.join(path.dirname(fileURLToPath(import.meta.url)), "drizzle") });
  console.log("Migrações aplicadas.");
} finally {
  await sql.end();
}
