import Link from "next/link";
import { STATUS_LABELS, TYPE_LABELS } from "@timcontrol/shared";
import type { CardView } from "@/server/kanban";
import { Assignees, DueLabel, PriorityBadge } from "./CardTile";

/** Lista de cards (visão em lista, Minhas atividades, Pedi a outros). */
export function CardList({ cards, today, empty = "Nenhum card por aqui.", showProject = true }: { cards: CardView[]; today: string; empty?: string; showProject?: boolean }) {
  if (!cards.length) return <p className="rounded-lg bg-sf p-5 text-ink3 shadow-sm">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {cards.map((c) => (
        <li key={c.id} className="flex flex-col gap-2 rounded-md bg-sf p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {showProject && (
                <span className="rounded-pill px-2 py-0.5 text-[11px] font-semibold" style={{ color: c.projectColor, backgroundColor: `${c.projectColor}1F` }}>
                  {c.projectName}
                </span>
              )}
              <span className="rounded-pill bg-sf2 px-2 py-0.5 text-[11px] font-semibold text-ink2">{STATUS_LABELS[c.status]}</span>
              {c.type === "request" && <span className="rounded-pill bg-br-soft px-2 py-0.5 text-[11px] font-semibold text-br-2">{TYPE_LABELS.request}</span>}
              <PriorityBadge p={c.priority} />
            </div>
            <Link href={`/cards/${c.id}`} className="font-semibold text-ink hover:text-br-2">
              {c.title}
            </Link>
            {c.type === "request" && c.requesterName && <p className="text-xs text-ink3">Pedido por {c.requesterName}</p>}
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <DueLabel dueDate={c.dueDate} status={c.status} today={today} />
            <Assignees list={c.assignees} />
          </div>
        </li>
      ))}
    </ul>
  );
}
