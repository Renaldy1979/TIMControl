import Link from "next/link";
import { Plus } from "lucide-react";
import { CardList } from "@/components/kanban/CardList";
import { Filters } from "@/components/kanban/Filters";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { requireActor } from "@/server/actor";
import { creatableProjects, kanbanContext, loadCards, readFilters, toCardFilter, type Search } from "@/server/kanban";

export const metadata = { title: "Pedi a outros" };

/** Solicitações em que a pessoa é a solicitante: o que ela pediu e ainda espera. */
export default async function RequestedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const f = { ...readFilters(await searchParams), tipo: "" };
  const filter = { ...toCardFilter(f, actor, ctx.projects.map((p) => p.id), ctx.today), requestedBy: actor.user.id };
  const [open, done] = await Promise.all([
    loadCards(actor, ctx, { ...filter, includeDone: false }, "due"),
    loadCards(actor, ctx, { ...filter, status: "done" }, "updated"),
  ]);
  return (
    <>
      <PageHeader
        title="Pedi a outros"
        subtitle="Solicitações em que você é o solicitante, para acompanhar o que você pediu."
        action={
          creatableProjects(actor, ctx).length > 0 && (
            <Link href="/cards/novo?tipo=request" className={buttonClass("primary")}>
              <Plus size={18} aria-hidden /> Nova solicitação
            </Link>
          )
        }
      />
      <Filters ctx={ctx} f={f} action="/pedi" hide={["tipo"]} />
      <h2 className="mb-3 text-lg font-bold">Aguardando ({open.length})</h2>
      <CardList cards={open} today={ctx.today} empty="Nenhuma solicitação sua em aberto." />
      <details className="mt-8">
        <summary className="min-h-touch cursor-pointer text-lg font-bold">Concluídas ({done.length})</summary>
        <div className="mt-3">
          <CardList cards={done.slice(0, 50)} today={ctx.today} empty="Nenhuma concluída ainda." />
        </div>
      </details>
    </>
  );
}
