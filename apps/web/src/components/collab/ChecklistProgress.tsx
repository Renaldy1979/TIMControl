/** Barra de progresso do checklist (x de y), com texto: o estado nunca fica só na cor. */
export function ChecklistProgress({ done, total, compact }: { done: number; total: number; compact?: boolean }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2" title={`Checklist: ${done} de ${total}`}>
      <div role="progressbar" aria-label="Checklist" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} de ${total}`} className={compact ? "h-1.5 w-16 rounded-pill bg-sf2" : "h-2 flex-1 rounded-pill bg-sf2"}>
        <div className="h-full rounded-pill bg-br" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink2">
        {done}/{total}
      </span>
    </div>
  );
}
