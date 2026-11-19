import { Check, Square, Trash2 } from "lucide-react";
import type { ChecklistItem } from "@timcontrol/pg";
import { checklistItemAction } from "@/server/actions/collab";
import { AddChecklistItemForm } from "./Forms";
import { MiniAction } from "./MiniAction";
import { ChecklistProgress } from "./ChecklistProgress";

export function ChecklistPanel({ cardId, items, canWork }: { cardId: string; items: ChecklistItem[]; canWork: boolean }) {
  const done = items.filter((i) => i.done).length;
  return (
    <section aria-labelledby="checklist-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="checklist-h" className="text-lg font-bold">
          Checklist
        </h2>
      </div>
      <ChecklistProgress done={done} total={items.length} />
      {items.length === 0 && <p className="text-sm text-ink3">{canWork ? "Nenhum item ainda. Inclua os passos para acompanhar o andamento." : "Sem checklist."}</p>}
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 border-b border-bd/60 py-1 last:border-0">
            {canWork ? (
              <MiniAction
                action={checklistItemAction}
                hidden={{ id: i.id, op: i.done ? "desmarcar" : "marcar" }}
                label={i.done ? `Desmarcar: ${i.text}` : `Marcar como feito: ${i.text}`}
                buttonClass="text-br-2 hover:bg-br-soft"
              >
                {i.done ? <Check size={20} aria-hidden /> : <Square size={20} aria-hidden />}
              </MiniAction>
            ) : (
              <span className="flex min-h-touch min-w-touch items-center justify-center text-ink3" aria-hidden>
                {i.done ? <Check size={20} /> : <Square size={20} />}
              </span>
            )}
            <span className="flex-1">
              <span className={i.done ? "text-ink3 line-through" : "text-ink"}>{i.text}</span>
              <span className="sr-only">{i.done ? " (feito)" : " (a fazer)"}</span>
              {i.done && i.doneByName && <span className="ml-2 text-xs text-ink3">· {i.doneByName}</span>}
            </span>
            {canWork && (
              <MiniAction action={checklistItemAction} hidden={{ id: i.id, op: "apagar" }} label={`Apagar item: ${i.text}`} buttonClass="text-ink3 hover:bg-danger-bg hover:text-danger">
                <Trash2 size={18} aria-hidden />
              </MiniAction>
            )}
          </li>
        ))}
      </ul>
      {canWork && (
        <AddChecklistItemForm cardId={cardId} />
      )}
    </section>
  );
}
