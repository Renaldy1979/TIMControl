import Link from "next/link";
import { Plus } from "lucide-react";
import { listMeetings } from "@timcontrol/pg";
import { formatDateBR } from "@timcontrol/domain";
import { can, MEETING_KIND_LABELS } from "@timcontrol/shared";
import { buttonClass } from "@/components/ui/Button";
import { Card, PageHeader, ProjectChip } from "@/components/ui/Card";
import { asActor, requireActor } from "@/server/actor";
import { kanbanContext, meetingProjects } from "@/server/kanban";

export const metadata = { title: "Reuniões e WarRooms" };

export default async function MeetingsPage() {
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const visible = ctx.projects.filter((p) => can(actor.viewer, "meetings.view", { projectId: p.id }));
  const meetings = await asActor(actor, (tx) => listMeetings(tx, { projectIds: visible.map((p) => p.id) }));
  return (
    <>
      <PageHeader
        title="Reuniões e WarRooms"
        subtitle="Registre o encontro e crie os cards que saíram dele. Assim nada se perde no e-mail."
        action={
          meetingProjects(actor, ctx).length > 0 && (
            <Link href="/reunioes/nova" className={buttonClass("primary")}>
              <Plus size={18} aria-hidden /> Registrar
            </Link>
          )
        }
      />
      {meetings.length === 0 ? (
        <Card>
          <p className="text-ink2">Nenhuma reunião registrada ainda.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {meetings.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 rounded-md bg-sf p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
              <span className="w-24 shrink-0 font-mono text-sm text-ink2">{formatDateBR(m.heldOn)}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <ProjectChip name={m.projectName} color={m.projectColor} />
                  <span className={m.kind === "warroom" ? "rounded-pill bg-danger-bg px-2 py-0.5 text-[11px] font-semibold text-danger" : "rounded-pill bg-sf2 px-2 py-0.5 text-[11px] font-semibold text-ink2"}>
                    {MEETING_KIND_LABELS[m.kind]}
                  </span>
                </div>
                <Link href={`/reunioes/${m.id}`} className="font-semibold text-ink hover:text-br-2">
                  {m.title}
                </Link>
              </div>
              <span className="text-sm text-ink2">
                {m.openCards > 0 ? <strong className="text-warn">{m.openCards} pendente{m.openCards > 1 ? "s" : ""}</strong> : "Nada pendente"} · {m.totalCards} card{m.totalCards === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
