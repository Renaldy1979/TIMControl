import { NewMeetingForm } from "@/components/forms/MeetingForm";
import { Card, PageHeader } from "@/components/ui/Card";
import { requireActor } from "@/server/actor";
import { kanbanContext, meetingProjects } from "@/server/kanban";

export const metadata = { title: "Registrar reunião" };

export default async function NewMeetingPage() {
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const projects = meetingProjects(actor, ctx);
  return (
    <>
      <PageHeader title="Registrar reunião ou WarRoom" subtitle="Depois de salvar, crie os cards que saíram do encontro." />
      <Card className="max-w-3xl">
        {projects.length === 0 ? (
          <p className="text-ink2">Seu perfil não permite registrar reuniões. Fale com o Gestor.</p>
        ) : (
          <NewMeetingForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} people={ctx.people} today={ctx.today} initial={{ participantIds: [actor.user.id] }} />
        )}
      </Card>
    </>
  );
}
