import Link from "next/link";
import { CalendarClock, Lock, Users } from "lucide-react";
import { DUE_LABELS, dueState, formatDateBR } from "@timcontrol/domain";
import { ChecklistProgress } from "../collab/ChecklistProgress";
import { PRIORITY_LABELS, type Priority } from "@timcontrol/shared";
import type { CardSummary } from "@timcontrol/pg";
import { cx } from "../ui/cx";

const priorityTone: Record<Priority, string> = {
  low: "bg-sf2 text-ink2",
  normal: "bg-info-bg text-info",
  high: "bg-warn-bg text-warn",
  urgent: "bg-danger-bg text-danger",
};

const dueTone = { overdue: "text-danger", today: "text-warn", soon: "text-warn", later: "text-ink3", none: "text-ink3", done: "text-ink3" } as const;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

/** Bolinhas dos responsáveis: pessoas com iniciais, grupos com ícone. Sempre com o nome no título (leitor de tela). */
export function Assignees({ list, max = 4 }: { list: CardSummary["assignees"]; max?: number }) {
  if (!list.length) return <span className="text-xs text-ink3">Sem responsável</span>;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  const names = list.map((a) => a.name).join(", ");
  return (
    <span className="flex items-center" title={names} aria-label={`Responsáveis: ${names}`}>
      {shown.map((a, i) => (
        <span
          key={`${a.kind}${a.id}`}
          aria-hidden
          className={cx(
            "flex h-7 w-7 items-center justify-center rounded-full border-2 border-sf text-[11px] font-bold",
            i > 0 && "-ml-2",
            a.kind === "group" ? "bg-side text-white" : "bg-br-soft text-br-2",
          )}
        >
          {a.kind === "group" ? <Users size={13} /> : initials(a.name)}
        </span>
      ))}
      {rest > 0 && (
        <span aria-hidden className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-sf bg-sf2 text-[11px] font-bold text-ink2">
          +{rest}
        </span>
      )}
    </span>
  );
}

export function PriorityBadge({ p }: { p: Priority }) {
  return <span className={cx("rounded-pill px-2 py-0.5 text-[11px] font-semibold", priorityTone[p])}>{PRIORITY_LABELS[p]}</span>;
}

export function DueLabel({ dueDate, status, today }: { dueDate: string | null; status: CardSummary["status"]; today: string }) {
  if (!dueDate) return null;
  const s = dueState(dueDate, status, today);
  const extra = DUE_LABELS[s];
  return (
    <span className={cx("inline-flex items-center gap-1 text-xs font-semibold", dueTone[s])}>
      <CalendarClock size={14} aria-hidden />
      {formatDateBR(dueDate)}
      {extra && <span>· {extra}</span>}
    </span>
  );
}

/** Card do quadro: selo do projeto, título, etiquetas, prazo, prioridade e responsáveis. */
export function CardTile({ card, today, showProject, dragging }: { card: CardSummary & { canMove?: boolean }; today: string; showProject: boolean; dragging?: boolean }) {
  return (
    <div className={cx("flex flex-col gap-2.5 rounded-md bg-sf p-4 shadow-sm ring-1 ring-bd/60", dragging && "rotate-2 shadow-lg ring-br")}>
      <div className="flex flex-wrap items-center gap-1.5">
        {showProject && (
          <span className="rounded-pill px-2 py-0.5 text-[11px] font-semibold" style={{ color: card.projectColor, backgroundColor: `${card.projectColor}1F` }}>
            {card.projectName}
          </span>
        )}
        <PriorityBadge p={card.priority} />
        {card.canMove === false && (
          <span className="ml-auto text-ink3" title="Você não pode mover este card">
            <Lock size={13} aria-label="Você não pode mover este card" />
          </span>
        )}
      </div>
      <Link href={`/cards/${card.id}`} className="text-[15px] font-semibold leading-snug text-ink hover:text-br-2 focus:outline-none focus-visible:underline">
        {card.title}
      </Link>
      {card.labels.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Etiquetas">
          {card.labels.map((l) => (
            <li key={l.id} className="rounded-sm px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: l.color, backgroundColor: `${l.color}1A` }}>
              {l.name}
            </li>
          ))}
        </ul>
      )}
      {card.checklist.total > 0 && <ChecklistProgress done={card.checklist.done} total={card.checklist.total} compact />}
      <div className="flex items-center justify-between gap-2">
        <DueLabel dueDate={card.dueDate} status={card.status} today={today} />
        <span className="ml-auto">
          <Assignees list={card.assignees} />
        </span>
      </div>
    </div>
  );
}
