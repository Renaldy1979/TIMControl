"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CARD_STATUSES, STATUS_LABELS, type CardStatus } from "@timcontrol/shared";
import type { CardView } from "@/server/kanban";
import { moveCardAction } from "@/server/actions/kanban";
import { Notice } from "../ui/Notice";
import { cx } from "../ui/cx";
import { CardTile } from "./CardTile";

type Columns = Record<CardStatus, CardView[]>;

const group = (cards: CardView[]): Columns => {
  const cols = Object.fromEntries(CARD_STATUSES.map((s) => [s, [] as CardView[]])) as unknown as Columns;
  for (const c of cards) cols[c.status].push(c);
  return cols;
};

const findColumn = (cols: Columns, id: string): CardStatus | null => {
  if ((CARD_STATUSES as readonly string[]).includes(id)) return id as CardStatus;
  return CARD_STATUSES.find((s) => cols[s].some((c) => c.id === id)) ?? null;
};

const columnDot: Record<CardStatus, string> = { todo: "bg-ink3", doing: "bg-info", review: "bg-warn", done: "bg-ok" };

/**
 * Quadro com as 4 colunas fixas. Arrastar e soltar com mouse, toque (segurar um instante) ou teclado (espaço para pegar, setas, espaço para soltar).
 * Card que a pessoa não pode mover fica com cadeado e não arrasta; o servidor confere de novo ao salvar.
 */
export function Board({ cards, today, showProject }: { cards: CardView[]; today: string; showProject: boolean }) {
  const [cols, setCols] = useState<Columns>(() => group(cards));
  const [active, setActive] = useState<CardView | null>(null);
  const [startCol, setStartCol] = useState<CardStatus | null>(null);
  const [snapshot, setSnapshot] = useState<Columns | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => setCols(group(cards)), [cards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const col = findColumn(cols, id);
    setActive(col ? (cols[col].find((c) => c.id === id) ?? null) : null);
    setStartCol(col);
    setSnapshot(cols);
    setError(null);
  }

  function onDragOver(e: DragOverEvent) {
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const id = String(e.active.id);
    setCols((prev) => {
      const from = findColumn(prev, id);
      const to = findColumn(prev, overId);
      if (!from || !to || from === to) return prev;
      const card = prev[from].find((c) => c.id === id)!;
      const target = prev[to];
      const overIdx = target.findIndex((c) => c.id === overId);
      const idx = overIdx < 0 ? target.length : overIdx;
      return { ...prev, [from]: prev[from].filter((c) => c.id !== id), [to]: [...target.slice(0, idx), { ...card, status: to }, ...target.slice(idx)] };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const before = snapshot;
    setActive(null);
    if (!overId || !before) {
      if (before) setCols(before);
      return;
    }
    let next = cols;
    const col = findColumn(cols, id);
    if (!col) return;
    const list = cols[col];
    const from = list.findIndex((c) => c.id === id);
    const overIdx = list.findIndex((c) => c.id === overId);
    if (overIdx >= 0 && overIdx !== from) {
      const moved = [...list];
      const [card] = moved.splice(from, 1);
      moved.splice(overIdx, 0, card!);
      next = { ...cols, [col]: moved };
      setCols(next);
    }
    const finalList = next[col];
    const pos = finalList.findIndex((c) => c.id === id);
    const beforeId = finalList[pos + 1]?.id ?? null;
    const unchanged = startCol === col && before[col].findIndex((c) => c.id === id) === pos;
    if (unchanged) return;
    setAnnounce(`Card movido para ${STATUS_LABELS[col]}.`);
    startTransition(async () => {
      const r = await moveCardAction({ id, status: col, beforeId });
      if (!r.ok) {
        setCols(before);
        setError(r.error);
        setAnnounce(r.error);
      }
    });
  }

  const empty = useMemo(() => CARD_STATUSES.every((s) => cols[s].length === 0), [cols]);

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {empty && <p className="mb-4 text-ink3">Nenhum card com esses filtros.</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          if (snapshot) setCols(snapshot);
          setActive(null);
        }}
        accessibility={{
          screenReaderInstructions: { draggable: "Para mover o card, aperte espaço, use as setas e aperte espaço de novo para soltar. Esc cancela." },
          announcements: {
            onDragStart: () => "Card selecionado.",
            onDragOver: ({ over }) => (over ? "Sobre outra posição." : "Fora das colunas."),
            onDragEnd: ({ over }) => (over ? "Card solto." : "Movimento cancelado."),
            onDragCancel: () => "Movimento cancelado.",
          },
        }}
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8 desk:mx-0 desk:grid desk:grid-cols-4 desk:overflow-visible desk:px-0">
          {CARD_STATUSES.map((s) => (
            <Column key={s} status={s} cards={cols[s]} today={today} showProject={showProject} />
          ))}
        </div>
        <DragOverlay>{active ? <CardTile card={active} today={today} showProject={showProject} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, cards, today, showProject }: { status: CardStatus; cards: CardView[]; today: string; showProject: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section aria-label={`${STATUS_LABELS[status]}, ${cards.length} cards`} className="w-[82vw] max-w-[340px] shrink-0 snap-start desk:w-auto desk:max-w-none">
      <header className="mb-3 flex items-center gap-2 px-1">
        <span aria-hidden className={cx("h-2.5 w-2.5 rounded-full", columnDot[status])} />
        <h2 className="font-bold text-ink">{STATUS_LABELS[status]}</h2>
        <span className="rounded-pill bg-sf px-2 text-xs font-semibold text-ink2">{cards.length}</span>
      </header>
      <SortableContext id={status} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className={cx("flex min-h-[160px] flex-col gap-3 rounded-lg p-2 transition-colors", isOver ? "bg-br-soft" : "bg-sf2")}>
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} today={today} showProject={showProject} />
          ))}
          {cards.length === 0 && <li className="rounded-md border-2 border-dashed border-bd p-4 text-center text-sm text-ink3">Solte um card aqui</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ card, today, showProject }: { card: CardView; today: string; showProject: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: !card.canMove });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="card arrastável"
      className={cx("touch-manipulation rounded-md", card.canMove && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40 outline-2 outline-dashed outline-br")}
    >
      <CardTile card={card} today={today} showProject={showProject} />
    </li>
  );
}
