import { NextResponse } from "next/server";
import { ping } from "@timcontrol/pg";

export const dynamic = "force-dynamic";

/** O EasyPanel considera o serviço saudável quando isto responde 200 (processo no ar e banco conectado). */
export async function GET() {
  const db = await ping();
  return NextResponse.json({ ok: db, db, version: process.env["APP_VERSION"] ?? "dev" }, { status: db ? 200 : 503 });
}
