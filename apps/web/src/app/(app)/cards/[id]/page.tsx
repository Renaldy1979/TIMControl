import Link from "next/link";
import { notFound } from "next/navigation";
import { cardHistoryOf, getCard } from "@timcontrol/pg";
import { describeHistory, formatDateTimeBR, isOwnCard } from "@timcontrol/domain";
import { can, STATUS_LABELS } from "@timcontrol/shared";
import { EditCardForm } from "@/components/forms/CardForm";
import { DeleteCardForm, MoveCardForm } from "@/components/forms/CardActions";
import { Assignees, DueLabel, PriorityBadge } from "@/components/kanban/CardTile";
import { Card, ProjectChip } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { asActor, requireActor } from "@/server/actor";
import { cardFormData, kanbanContext, type Search } from "@/server/kanban";

export const metadata = { title: "Card" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const { card, history } = await asActor(actor, async (tx) => ({ card: await getCard(tx, id), history: await cardHistoryOf(tx, id) }));
  if (!card) notFound();
  const own = isOwnCard(card, actor.user.id, ctx.myGroupIds);
  const opts = { projectId: card.projectId, own };
  const canEdit = can(actor.viewer, "kanban.edit", opts);
  const canMove = can(actor.viewer, "kanban.move", opts);
  const canDelete = can(actor.viewer, "kanban.delete", opts);
  // Ao editar, o card pode ir para outro projeto em que a pessoa também cria cards.
  const projects = ctx.projects.filter((p) => p.id === card.projectId || can(actor.viewer, "kanban.create", { projectId: p.id }));
  const d = canEdit ? cardFormData(actor, ctx, projects, canMove) : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <nav aria-label="Caminho" className="text-sm">
        <Link href={`/quadro?projeto=${card.projectId}`} className="font-semibold text-br-2 hover:underline">
          ← Quadro de {card.projectName}
        </Link>
      </nav>
      {sp.ok === "criado" && <Notice tone="ok">Card criado.</Notice>}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectChip name={card.projectName} color={card.projectColor} />
          <span className="rounded-pill bg-sf2 px-3 py-1 text-xs font-semibold text-ink2">{STATUS_LABELS[card.status]}</span>
          <PriorityBadge p={card.priority} />
          {card.labels.map((l) => (
            <span key={l.id} className="rounded-sm px-2 py-0.5 text-xs font-semibold" style={{ color: l.color, backgroundColor: `${l.color}1A` }}>
              {l.name}
            </span>
          ))}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{card.title}</h1>
        {card.description ? <p className="whitespace-pre-wrap text-ink2">{card.description}</p> : <p className="text-ink3">Sem descrição.</p>}
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink3">Responsáveis</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <Assignees list={card.assignees} max={6} />
              <span className="text-ink2">{card.assignees.map((a) => a.name).join(", ")}</span>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink3">Prazo</dt>
            <dd className="mt-1">{card.dueDate ? <DueLabel dueDate={card.dueDate} status={card.status} today={ctx.today} /> : <span className="text-ink3">Sem prazo</span>}</dd>
          </div>
          {card.externalRef && (
            <div>
              <dt className="font-semibold text-ink3">Referência externa</dt>
              <dd className="mt-1 font-mono text-ink2">{card.externalRef}</dd>
            </div>
          )}
          <div>
            <dt className="font-semibold text-ink3">Criado</dt>
            <dd className="mt-1 text-ink2">
              por {card.createdByName} em {formatDateTimeBR(card.createdAt)}
            </dd>
          </div>
        </dl>
        {canMove && !canEdit && <MoveCardForm id={card.id} status={card.status} />}
        {canMove && canEdit && (
          <div className="border-t border-bd pt-4">
            <MoveCardForm id={card.id} status={card.status} />
          </div>
        )}
        {!canEdit && !canMove && <p className="text-sm text-ink3">Você pode ver este card, mas seu perfil não permite alterá-lo.</p>}
      </Card>

      {d && (
        <details className="rounded-lg bg-sf shadow-md">
          <summary className="min-h-touch cursor-pointer px-5 py-4 text-lg font-bold">Editar card</summary>
          <div className="px-5 pb-5">
            <EditCardForm
              d={d}
              card={{
                id: card.id,
                projectId: card.projectId,
                title: card.title,
                description: card.description,
                status: card.status,
                priority: card.priority,
                dueDate: card.dueDate,
                assignees: card.assignees.map((a) => `${a.kind === "user" ? "u" : "g"}:${a.id}`),
                labelIds: card.labels.map((l) => l.id),
                externalRef: card.externalRef,
              }}
            />
          </div>
        </details>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-bold">Histórico</h2>
        {history.length === 0 ? (
          <p className="text-ink3">Sem registros.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col border-l-2 border-br-soft pl-3 text-sm sm:flex-row sm:gap-3">
                <time className="shrink-0 font-mono text-xs text-ink3" dateTime={h.createdAt.toISOString()}>
                  {formatDateTimeBR(h.createdAt)}
                </time>
                <span className="text-ink2">
                  <strong className="text-ink">{h.actorName ?? "Alguém"}</strong> {describeHistory(h.action, h.details)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {canDelete && (
        <details className="rounded-lg border border-danger-bg bg-sf p-5">
          <summary className="min-h-touch cursor-pointer font-semibold text-danger">Excluir card</summary>
          <p className="my-3 text-sm text-ink2">O card e o histórico dele somem de vez. Não dá para desfazer.</p>
          <DeleteCardForm id={card.id} />
        </details>
      )}
    </div>
  );
}
