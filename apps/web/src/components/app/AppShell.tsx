import { LogOut } from "lucide-react";
import { signOut } from "@/server/actions/auth";
import { BottomNav, SideNav, type NavItem } from "./NavLinks";

/** Moldura do portal: menu lateral escuro (computador), barra inferior (celular) e topo com a pessoa logada. */
export function AppShell({ userName, profileName, showAdmin, children }: { userName: string; profileName: string; showAdmin: boolean; children: React.ReactNode }) {
  const items: NavItem[] = [
    { href: "/", label: "Início", icon: "home" },
    { href: "/quadro", label: "Quadro", icon: "board" },
    { href: "/minhas", label: "Minhas", icon: "mine" },
    { href: "/pedi", label: "Pedi", icon: "asked" },
    ...(showAdmin ? [{ href: "/configuracoes", label: "Configurações", icon: "settings", desktopOnly: true } as const] : []),
    { href: "/conta", label: "Conta", icon: "user" },
  ];
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="min-h-screen desk:flex">
      <aside className="sticky top-0 hidden h-screen w-24 shrink-0 flex-col items-center justify-between rounded-r-xl bg-side py-8 desk:flex">
        <div className="flex flex-col items-center gap-12">
          <Logo />
          <SideNav items={items} />
        </div>
        <form action={signOut}>
          <button type="submit" title="Sair" aria-label="Sair" className="flex h-12 w-12 items-center justify-center rounded-full text-side-ink hover:bg-white/10 hover:text-white">
            <LogOut size={22} aria-hidden />
          </button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3 desk:hidden">
            <Logo small />
            <span className="text-lg font-bold">TIMControl</span>
          </div>
          <span className="hidden text-lg font-bold desk:block">TIMControl</span>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-ink">{userName}</p>
              <p className="text-xs text-ink3">{profileName}</p>
            </div>
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-br-soft text-sm font-bold text-br-2">
              {initials}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 sm:px-8 desk:pb-10">{children}</main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}

export function Logo({ small }: { small?: boolean }) {
  const s = small ? 28 : 40;
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" role="img" aria-label="TIMControl">
      <circle cx="20" cy="12" r="8" fill="#7C5CFC" />
      <circle cx="12" cy="26" r="8" fill="#A78BFA" />
      <circle cx="28" cy="26" r="8" fill="#C4B5FD" />
    </svg>
  );
}
