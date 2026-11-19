import "server-only";
import { groupIdsOf, listCards, listGroups, listLabels, listProjects, listUsers, type CardFilter, type CardSummary, type LabelRef, type ProjectRow } from "@timcontrol/pg";
import { isOwnCard, todayInSaoPaulo } from "@timcontrol/domain";
import { can, CARD_TYPES, PRIORITIES, type CardType, type Priority } from "@timcontrol/shared";
import { asActor, type Actor } from "./actor";

/** Dados das telas do Kanban: projetos visíveis, pessoas, grupos, etiquetas e cards com o que a pessoa pode fazer em cada um. */

export interface PersonOpt {
  id: string;
  name: string;
}

export interface KanbanContext {
  projects: ProjectRow[];
  people: PersonOpt[];
  groups: PersonOpt[];
  labels: LabelRef[];
  myGroupIds: string[];
  today: string;
}

export interface CardView extends CardSummary {
  canMove: boolean;
  canEdit: boolean;
}

export type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FilterState {
  projeto: string;
  tipo: string;
  resp: string;
  prioridade: string;
  etiqueta: string;
  prazo: string;
  q: string;
}

/** Filtros da URL (?projeto=...&tipo=...), sempre validados: valor estranho é ignorado. */
export function readFilters(sp: Search): FilterState {
  const projeto = one(sp.projeto);
  const tipo = one(sp.tipo);
  const resp = one(sp.resp);
  const prioridade = one(sp.prioridade);
  const etiqueta = one(sp.etiqueta);
  const prazo = one(sp.prazo);
  return {
    projeto: UUID.test(projeto) ? projeto : "",
    tipo: (CARD_TYPES as readonly string[]).includes(tipo) ? tipo : "",
    resp: /^[ug]:[0-9a-f-]{36}$/i.test(resp) || resp === "eu" ? resp : "",
    prioridade: (PRIORITIES as readonly string[]).includes(prioridade) ? prioridade : "",
    etiqueta: UUID.test(etiqueta) ? etiqueta : "",
    prazo: prazo === "atrasados" || prazo === "semana" ? prazo : "",
    q: one(sp.q).slice(0, 80),
  };
}

export function toCardFilter(f: FilterState, actor: Actor, visibleProjectIds: string[], today: string): CardFilter {
  return {
    projectIds: f.projeto ? visibleProjectIds.filter((p) => p === f.projeto) : visibleProjectIds,
    type: (f.tipo || undefined) as CardType | undefined,
    priority: (f.prioridade || undefined) as Priority | undefined,
    labelId: f.etiqueta || undefined,
    assignee: f.resp && f.resp !== "eu" ? f.resp : undefined,
    assignedTo: f.resp === "eu" ? actor.user.id : undefined,
    due: f.prazo ? { kind: f.prazo === "atrasados" ? "overdue" : "week", today } : undefined,
    q: f.q || undefined,
  };
}

export async function kanbanContext(actor: Actor): Promise<KanbanContext> {
  return asActor(actor, async (tx) => {
    const [projects, users, groups, labels, myGroupIds] = await Promise.all([listProjects(tx), listUsers(tx), listGroups(tx), listLabels(tx), groupIdsOf(tx, actor.user.id)]);
    return {
      projects: projects.filter((p) => p.active),
      people: users.filter((u) => u.state === "active").map((u) => ({ id: u.id, name: u.name })),
      groups: groups.filter((g) => g.active).map((g) => ({ id: g.id, name: g.name })),
      labels,
      myGroupIds,
      today: todayInSaoPaulo(),
    };
  });
}

export function withRights(actor: Actor, ctx: KanbanContext, cards: CardSummary[]): CardView[] {
  return cards.map((c) => {
    const own = isOwnCard(c, actor.user.id, ctx.myGroupIds);
    return { ...c, canMove: can(actor.viewer, "kanban.move", { projectId: c.projectId, own }), canEdit: can(actor.viewer, "kanban.edit", { projectId: c.projectId, own }) };
  });
}

export async function loadCards(actor: Actor, ctx: KanbanContext, filter: CardFilter, order?: Parameters<typeof listCards>[2]): Promise<CardView[]> {
  const cards = await asActor(actor, (tx) => listCards(tx, filter, order));
  return withRights(actor, ctx, cards);
}

/** Projetos em que a pessoa pode criar card (para o botão "Novo card"). */
export const creatableProjects = (actor: Actor, ctx: KanbanContext) => ctx.projects.filter((p) => can(actor.viewer, "kanban.create", { projectId: p.id }));

/** Dados do formulário de card: projetos permitidos, pessoas, grupos e etiquetas. */
export function cardFormData(actor: Actor, ctx: KanbanContext, projects: ProjectRow[], canMove: boolean) {
  return {
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    people: ctx.people,
    groups: ctx.groups,
    labels: ctx.labels,
    meId: actor.user.id,
    today: ctx.today,
    canMove,
  };
}
