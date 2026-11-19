import { cx } from "./cx";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx("rounded-lg bg-sf p-5 shadow-md", className)} />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-ink3">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

const tones = {
  brand: "bg-br-soft text-br-2",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-sf2 text-ink2",
} as const;

export function Badge({ tone = "neutral", children, style }: { tone?: keyof typeof tones; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={style} className={cx("inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

/** Selo colorido do projeto (como no modelo: texto na cor do projeto sobre fundo claro da mesma cor). */
export function ProjectChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold" style={{ color, backgroundColor: `${color}1F` }}>
      {name}
    </span>
  );
}
