import { STATUS_LABELS, type CardStatus, type Priority } from "@timcontrol/shared";

/** Regras puras do Kanban (Lote 2): ordem na coluna, "card meu", datas no fuso de São Paulo e histórico. */

export const TZ = "America/Sao_Paulo";

/** Data de hoje em São Paulo, AAAA-MM-DD (o prazo é uma data, sem hora). */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** AAAA-MM-DD → dd/mm/aaaa. */
export function formatDateBR(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/** Data e hora em São Paulo, dd/mm/aaaa hh:mm (24h). */
export function formatDateTimeBR(d: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return parts.replace(",", "");
}

export type DueState = "none" | "overdue" | "today" | "soon" | "later" | "done";

/** Situação do prazo: atrasado, vence hoje, nos próximos 3 dias ou depois. Concluído não atrasa. */
export function dueState(dueDate: string | null, status: CardStatus, today: string): DueState {
  if (status === "done") return "done";
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  const diff = (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return diff <= 3 ? "soon" : "later";
}

export const DUE_LABELS: Record<DueState, string> = {
  none: "",
  overdue: "Atrasado",
  today: "Vence hoje",
  soon: "Vence em breve",
  later: "",
  done: "",
};

/** O card é "da pessoa" (alcance "os seus"): ela criou ou é responsável, direto ou por um grupo dela. */
export function isOwnCard(
  card: { createdBy: string; assignees: { kind: "user" | "group"; id: string }[] },
  userId: string,
  groupIds: readonly string[],
): boolean {
  if (card.createdBy === userId) return true;
  return card.assignees.some((a) => (a.kind === "user" ? a.id === userId : groupIds.includes(a.id)));
}

export const POSITION_GAP = 1024;

/**
 * Posição de um card que entra entre `before` (acima) e `after` (abaixo) numa coluna.
 * Sem vizinhos, vai para o fim. Devolve `null` quando não há mais espaço entre os dois (aí a coluna é renumerada).
 */
export function positionBetween(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return POSITION_GAP;
  if (before === null) return after! / 2 > 1e-6 ? after! / 2 : null;
  if (after === null) return before + POSITION_GAP;
  const mid = (before + after) / 2;
  return mid > before && mid < after && after - before > 1e-6 ? mid : null;
}

/** Onde o card cai na coluna de destino, dado o id do card que fica logo abaixo dele (ou nada = fim). */
export function dropPosition(column: { id: string; position: number }[], movingId: string, beforeCardId: string | null): number | null {
  const others = column.filter((c) => c.id !== movingId);
  if (!beforeCardId) return positionBetween(others.at(-1)?.position ?? null, null);
  const idx = others.findIndex((c) => c.id === beforeCardId);
  if (idx < 0) return positionBetween(others.at(-1)?.position ?? null, null);
  return positionBetween(idx > 0 ? others[idx - 1]!.position : null, others[idx]!.position);
}

export interface CardSnapshot {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  projectId: string;
  externalRef: string;
  assignees: string[];
  labelIds: string[];
}

const FIELD_LABELS: Record<keyof CardSnapshot, string> = {
  title: "título",
  description: "descrição",
  priority: "prioridade",
  dueDate: "prazo",
  projectId: "projeto",
  externalRef: "referência externa",
  assignees: "responsáveis",
  labelIds: "etiquetas",
};

const same = (a: unknown, b: unknown) => (Array.isArray(a) && Array.isArray(b) ? [...a].sort().join() === [...b].sort().join() : a === b);

/** Campos que mudaram numa edição, para o histórico (nomes em português; sem valores longos). */
export function changedFields(before: CardSnapshot, after: CardSnapshot): string[] {
  return (Object.keys(FIELD_LABELS) as (keyof CardSnapshot)[]).filter((k) => !same(before[k], after[k])).map((k) => FIELD_LABELS[k]);
}

/** Frase do histórico, como aparece na tela do card. */
export function describeHistory(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case "created":
      return `criou o card em ${STATUS_LABELS[(details.status as CardStatus) ?? "todo"] ?? "A Fazer"}`;
    case "moved":
      return `moveu de ${STATUS_LABELS[details.from as CardStatus] ?? "?"} para ${STATUS_LABELS[details.to as CardStatus] ?? "?"}`;
    case "edited": {
      const f = (details.fields as string[] | undefined) ?? [];
      return f.length ? `alterou ${f.join(", ")}` : "editou o card";
    }
    default:
      return action;
  }
}

export const priorityRank = (p: Priority): number => ["low", "normal", "high", "urgent"].indexOf(p);
