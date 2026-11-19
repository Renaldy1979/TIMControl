import { CardList } from "@/components/kanban/CardList";
import { Filters } from "@/components/kanban/Filters";
import { PageHeader } from "@/components/ui/Card";
import { requireActor } from "@/server/actor";
import { kanbanContext, loadCards, readFilters, toCardFilter, type Search } from "@/server/kanban";

export const metadata = { title: "Minhas atividades" };

/** Cards em que a pessoa é responsável, direto ou por um grupo dela. Abertos primeiro, por prazo. */
export default async function MinePage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const f = { ...readFilters(await searchParams), resp: "" };
  const filter = { ...toCardFilter(f, actor, ctx.projects.map((p) => p.id), ctx.today), assignedTo: actor.user.id };
  const [open, done] = await Promise.all([
    loadCards(actor, ctx, { ...filter, includeDone: false }, "due"),
    loadCards(actor, ctx, { ...filter, status: "done" }, "updated"),
  ]);
  return (
    <>
      <PageHeader title="Minhas atividades" subtitle="Cards em que você é responsável, direto ou por um dos seus grupos." />
      <Filters ctx={ctx} f={f} action="/minhas" hide={["resp"]} />
      <h2 className="mb-3 text-lg font-bold">Em aberto ({open.length})</h2>
      <CardList cards={open} today={ctx.today} empty="Nada em aberto com você. 🎉" />
      <details className="mt-8">
        <summary className="min-h-touch cursor-pointer text-lg font-bold">Concluídos ({done.length})</summary>
        <div className="mt-3">
          <CardList cards={done.slice(0, 50)} today={ctx.today} empty="Nenhum concluído ainda." />
        </div>
      </details>
    </>
  );
}
