import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getMeeting } from "@timcontrol/pg";
import { formatDateBR } from "@timcontrol/domain";
import { can, MEETING_KIND_LABELS } from "@timcontrol/shared";
import { DeleteMeetingForm, EditMeetingForm } from "@/components/forms/MeetingForm";
import { CardList } from "@/components/kanban/CardList";
import { buttonClass } from "@/components/ui/Button";
import { Card, ProjectChip } from "@/components/ui/Card";
import { asActor, requireActor } from "@/server/actor";
import { kanbanContext, loadCards, meetingProjects } from "@/server/kanban";

export const metadata = { title: "Reunião" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const m = await asActor(actor, (tx) => getMeeting(tx, id));
  if (!m) notFound();
  const cards = await loadCards(actor, ctx, { meetingId: m.id }, "due");
  const open = cards.filter((c) => c.status !== "done");
  const done = cards.filter((c) => c.status === "done");
  const own = m.createdBy === actor.user.id || m.participants.some((p) => p.id === actor.user.id);
  const canEdit = can(actor.viewer, "meetings.edit", { projectId: m.projectId, own });
  const canDelete = can(actor.viewer, "meetings.delete", { projectId: m.projectId, own });
  const canCreateCard = can(actor.viewer, "kanban.create", { projectId: m.projectId });
  const projects = meetingProjects(actor, ctx).filter((p) => p.id === m.projectId || m.totalCards === 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <nav aria-label="Caminho" className="text-sm">
        <Link href="/reunioes" className="font-semibold text-br-2 hover:underline">
          ← Reuniões e WarRooms
        </Link>
      </nav>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectChip name={m.projectName} color={m.projectColor} />
          <span className="rounded-pill bg-sf2 px-3 py-1 text-xs font-semibold text-ink2">{MEETING_KIND_LABELS[m.kind]}</span>
          <span className="font-mono text-sm text-ink2">{formatDateBR(m.heldOn)}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        {m.notes ? <p className="whitespace-pre-wrap text-ink2">{m.notes}</p> : <p className="text-ink3">Sem anotações.</p>}
        <p className="text-sm text-ink3">
          Participantes: {m.participants.length ? m.participants.map((p) => p.name).join(", ") : "nenhum registrado"} · registrada por {m.createdByName}
        </p>
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Pendentes ({open.length})</h2>
          {canCreateCard && (
            <Link href={`/cards/novo?projeto=${m.projectId}&reuniao=${m.id}`} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden /> Card desta reunião
            </Link>
          )}
        </div>
        <CardList cards={open} today={ctx.today} showProject={false} empty="Nada pendente desta reunião." />
        {done.length > 0 && (
          <>
            <h2 className="mb-3 mt-6 text-lg font-bold">Concluídos ({done.length})</h2>
            <CardList cards={done} today={ctx.today} showProject={false} />
          </>
        )}
      </section>

      {canEdit && (
        <details className="rounded-lg bg-sf shadow-md">
          <summary className="min-h-touch cursor-pointer px-5 py-4 text-lg font-bold">Editar reunião</summary>
          <div className="px-5 pb-5">
            <EditMeetingForm
              projects={(projects.length ? projects : ctx.projects.filter((p) => p.id === m.projectId)).map((p) => ({ id: p.id, name: p.name }))}
              people={ctx.people}
              today={ctx.today}
              meeting={{ id: m.id, projectId: m.projectId, kind: m.kind, title: m.title, heldOn: m.heldOn, notes: m.notes, participantIds: m.participants.map((p) => p.id) }}
            />
          </div>
        </details>
      )}
      {canDelete && (
        <details className="rounded-lg border border-danger-bg bg-sf p-5">
          <summary className="min-h-touch cursor-pointer font-semibold text-danger">Excluir reunião</summary>
          <p className="my-3 text-sm text-ink2">Os cards criados nela continuam no quadro, só perdem a ligação com a reunião.</p>
          <DeleteMeetingForm id={m.id} />
        </details>
      )}
    </div>
  );
}
