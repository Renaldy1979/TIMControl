import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_ADMIN ?? "postgres://timcontrol_owner@localhost:5441/timcontrol" },
});
