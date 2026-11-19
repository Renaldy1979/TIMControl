import { Logo } from "./AppShell";

/** Moldura das telas de entrada (login, convite, senha, configuração inicial). */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-side px-4 py-10">
      <div className="w-full max-w-md rounded-xl bg-sf p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <span className="text-xl font-bold">TIMControl</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-ink3">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
