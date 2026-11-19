"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ListChecks, Send, Settings, UserRound } from "lucide-react";
import { cx } from "../ui/cx";

export interface NavItem {
  href: string;
  label: string;
  icon: "home" | "settings" | "user" | "board" | "mine" | "asked";
  /** Some na barra inferior do celular (vai para o menu "Mais" da Conta). */
  desktopOnly?: boolean;
}

const icons = { home: Home, settings: Settings, user: UserRound, board: LayoutGrid, mine: ListChecks, asked: Send };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

/** Menu lateral (computador) no estilo do modelo: ícones em círculo, item ativo em roxo. */
export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col items-center gap-3">
      {items.map((it) => {
        const Icon = icons[it.icon];
        const active = isActive(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.label}
            aria-label={it.label}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              active ? "bg-side-act text-white shadow-md" : "text-side-ink hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon size={22} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior (celular). */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Menu principal" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-white/10 bg-side px-1 pb-[env(safe-area-inset-bottom)] desk:hidden">
      {items.filter((it) => !it.desktopOnly).map((it) => {
        const Icon = icons[it.icon];
        const active = isActive(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cx("flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-white" : "text-side-ink")}
          >
            <Icon size={22} aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
