import Link from "next/link";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Board } from "@/components/kanban/Board";
import { CardList } from "@/components/kanban/CardList";
import { Filters } from "@/components/kanban/Filters";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { cx } from "@/components/ui/cx";
import { requireActor } from "@/server/actor";
import { creatableProjects, kanbanContext, loadCards, readFilters, toCardFilter, type Search } from "@/server/kanban";

export const metadata = { title: "Quadro" };

const ORDERS = { prazo: "due", prioridade: "priority", atualizados: "updated" } as const;

export default async function BoardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const f = readFilters(sp);
  const list = sp.vista === "lista";
  const ordem = typeof sp.ordem === "string" && sp.ordem in ORDERS ? (sp.ordem as keyof typeof ORDERS) : "prazo";
  const cards = await loadCards(actor, ctx, toCardFilter(f, actor, ctx.projects.map((p) => p.id), ctx.today), list ? ORDERS[ordem] : "board");
  const project = ctx.projects.find((p) => p.id === f.projeto);
  const canCreate = project ? creatableProjects(actor, ctx).some((p) => p.id === project.id) : creatableProjects(actor, ctx).length > 0;
  const qs = (over: Record<string, string>) => {
    const u = new URLSearchParams(Object.entries({ ...f, ...(list ? { vista: "lista", ordem } : {}), ...over }).filter(([, v]) => v) as [string, string][]);
    return `/quadro?${u}`;
  };

  return (
    <>
      <PageHeader
        title={project ? project.name : "Visão geral"}
        subtitle={project ? `Quadro do projeto ${project.code}.` : "Todos os projetos que você acompanha. O selo colorido mostra o projeto de cada card."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Modo de exibição" className="flex rounded-md bg-sf p-1 shadow-sm">
              <Link href={qs({ vista: "", ordem: "" })} aria-current={!list ? "page" : undefined} className={cx("flex min-h-touch items-center gap-2 rounded-sm px-3 text-sm font-semibold", !list ? "bg-br-soft text-br-2" : "text-ink2")}>
                <LayoutGrid size={16} aria-hidden /> Quadro
              </Link>
              <Link href={qs({ vista: "lista" })} aria-current={list ? "page" : undefined} className={cx("flex min-h-touch items-center gap-2 rounded-sm px-3 text-sm font-semibold", list ? "bg-br-soft text-br-2" : "text-ink2")}>
                <List size={16} aria-hidden /> Lista
              </Link>
            </nav>
            {canCreate && (
              <Link href={`/cards/novo${project ? `?projeto=${project.id}` : ""}`} className={buttonClass("primary")}>
                <Plus size={18} aria-hidden /> Novo card
              </Link>
            )}
          </div>
        }
      />
      <Filters ctx={ctx} f={f} action="/quadro" extra={list ? { vista: "lista", ordem } : undefined} />
      {list ? (
        <>
          <nav aria-label="Ordenar" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink3">Ordenar por:</span>
            {(Object.keys(ORDERS) as (keyof typeof ORDERS)[]).map((o) => (
              <Link key={o} href={qs({ ordem: o })} aria-current={ordem === o ? "true" : undefined} className={cx("rounded-pill px-3 py-1 font-semibold", ordem === o ? "bg-br text-white" : "bg-sf text-ink2")}>
                {o === "prazo" ? "Prazo" : o === "prioridade" ? "Prioridade" : "Atualizados"}
              </Link>
            ))}
          </nav>
          <CardList cards={cards} today={ctx.today} showProject={!project} empty="Nenhum card com esses filtros." />
        </>
      ) : (
        <Board cards={cards} today={ctx.today} showProject={!project} />
      )}
    </>
  );
}
