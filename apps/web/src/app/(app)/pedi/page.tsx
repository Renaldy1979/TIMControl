import Link from "next/link";
import { Plus } from "lucide-react";
import { CardList } from "@/components/kanban/CardList";
import { Filters } from "@/components/kanban/Filters";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { requireActor } from "@/server/actor";
import { creatableProjects, kanbanContext, loadCards, readFilters, toCardFilter, type Search } from "@/server/kanban";

export const metadata = { title: "Pedi a outros" };

/** Cards que a pessoa criou para outras pessoas ou grupos: o que ela pediu e ainda espera. */
export default async function RequestedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const f = readFilters(await searchParams);
  const filter = { ...toCardFilter(f, actor, ctx.projects.map((p) => p.id), ctx.today), requestedBy: actor.user.id };
  const [open, done] = await Promise.all([
    loadCards(actor, ctx, { ...filter, includeDone: false }, "due"),
    loadCards(actor, ctx, { ...filter, status: "done" }, "updated"),
  ]);
  return (
    <>
      <PageHeader
        title="Pedi a outros"
        subtitle="Cards que você criou para outras pessoas ou grupos, para acompanhar o que você pediu."
        action={
          creatableProjects(actor, ctx).length > 0 && (
            <Link href="/cards/novo" className={buttonClass("primary")}>
              <Plus size={18} aria-hidden /> Novo card
            </Link>
          )
        }
      />
      <Filters ctx={ctx} f={f} action="/pedi" />
      <h2 className="mb-3 text-lg font-bold">Aguardando ({open.length})</h2>
      <CardList cards={open} today={ctx.today} empty="Nenhum card seu para outras pessoas em aberto." />
      <details className="mt-8">
        <summary className="min-h-touch cursor-pointer text-lg font-bold">Concluídos ({done.length})</summary>
        <div className="mt-3">
          <CardList cards={done.slice(0, 50)} today={ctx.today} empty="Nenhum concluído ainda." />
        </div>
      </details>
    </>
  );
}
