import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/cookies";

/** Telas e rotas que não exigem sessão. Tudo o mais pede o cookie da sessão. */
const PUBLIC = ["/login", "/esqueci-senha", "/redefinir-senha", "/aceitar-convite", "/configuracao-inicial", "/api/health", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png", "/sw.js", "/offline.html"];
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Quem não tem cookie de sessão vai para /login (páginas) ou recebe 401 (API).
 * Aqui só dá para olhar se o cookie existe (Edge); a sessão é validada NO APPWRITE em cada requisição (layout e Server Actions).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname) || req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
