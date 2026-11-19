import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listCards } from "@timcontrol/pg";
import { profileFor } from "@timcontrol/shared";
import { Card, PageHeader, ProjectChip } from "@/components/ui/Card";
import { CardList } from "@/components/kanban/CardList";
import { asActor, requireActor } from "@/server/actor";
import { kanbanContext, loadCards } from "@/server/kanban";

export const metadata = { title: "Início" };

export default async function HomePage() {
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const ids = ctx.projects.map((p) => p.id);
  const [open, mine, overdue] = await Promise.all([
    asActor(actor, (tx) => listCards(tx, { projectIds: ids, includeDone: false })),
    loadCards(actor, ctx, { projectIds: ids, assignedTo: actor.user.id, includeDone: false }, "due"),
    asActor(actor, (tx) => listCards(tx, { projectIds: ids, due: { kind: "overdue", today: ctx.today } })),
  ]);
  const first = actor.user.name.split(/\s+/)[0];
  return (
    <>
      <PageHeader title={`Olá, ${first}`} subtitle="Seus projetos e o que está com você." />
      {ctx.projects.length === 0 ? (
        <Card>
          <p className="text-ink2">Nenhum projeto liberado para você ainda. Fale com o Gestor.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <ul className="grid gap-4 sm:grid-cols-2 wide:grid-cols-3">
            {ctx.projects.map((p) => {
              const n = open.filter((c) => c.projectId === p.id).length;
              const late = overdue.filter((c) => c.projectId === p.id).length;
              return (
                <li key={p.id}>
                  <Link href={`/quadro?projeto=${p.id}`} className="block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-br">
                    <Card className="flex h-full flex-col gap-3 transition-shadow hover:shadow-lg">
                      <div className="flex items-center justify-between">
                        <ProjectChip name={p.name} color={p.color} />
                        <ArrowRight size={18} className="text-ink3" aria-hidden />
                      </div>
                      <p className="text-ink2">
                        <strong className="text-2xl text-ink">{n}</strong> em aberto
                        {late > 0 && <span className="ml-2 font-semibold text-danger">· {late} atrasado{late > 1 ? "s" : ""}</span>}
                      </p>
                      <p className="text-sm text-ink3">Seu perfil aqui: {profileFor(actor.viewer, p.id)?.name ?? "sem acesso"}</p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Com você agora</h2>
              <Link href="/minhas" className="text-sm font-semibold text-br-2 hover:underline">
                Ver todas
              </Link>
            </div>
            <CardList cards={mine.slice(0, 5)} today={ctx.today} empty="Nada em aberto com você." />
          </section>
        </div>
      )}
    </>
  );
}
