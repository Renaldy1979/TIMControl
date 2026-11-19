import Link from "next/link";
import { NewCardForm } from "@/components/forms/CardForm";
import { Card, PageHeader } from "@/components/ui/Card";
import { requireActor } from "@/server/actor";
import { can } from "@timcontrol/shared";
import { cardFormData, creatableProjects, kanbanContext, type Search } from "@/server/kanban";

export const metadata = { title: "Novo card" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewCardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const actor = await requireActor();
  const ctx = await kanbanContext(actor);
  const projects = creatableProjects(actor, ctx);
  if (!projects.length) {
    return (
      <>
        <PageHeader title="Novo card" />
        <Card>
          <p className="text-ink2">Seu perfil não permite criar cards em nenhum projeto. Fale com o Gestor.</p>
        </Card>
      </>
    );
  }
  const projectId = projects.some((p) => p.id === one(sp.projeto)) ? one(sp.projeto) : projects[0]!.id;
  const d = await cardFormData(actor, ctx, projects, can(actor.viewer, "kanban.move", { projectId, own: true }));
  const meetingId = d.meetings.some((m) => m.id === one(sp.reuniao)) ? one(sp.reuniao) : null;
  const meeting = d.meetings.find((m) => m.id === meetingId);
  return (
    <>
      <PageHeader title={one(sp.tipo) === "request" ? "Nova solicitação" : "Novo card"} subtitle={meeting ? `Saindo de: ${meeting.name}` : "Preencha o essencial; o resto pode ser ajustado depois."} />
      <Card className="max-w-3xl">
        <NewCardForm
          d={d}
          initial={{
            projectId: meeting?.projectId ?? projectId,
            type: one(sp.tipo) === "request" || meetingId ? "request" : "task",
            meetingId,
            assignees: one(sp.tipo) === "request" || meetingId ? [] : [`u:${actor.user.id}`],
          }}
        />
      </Card>
      <p className="mt-4">
        <Link href="/quadro" className="text-sm font-semibold text-br-2 hover:underline">
          Voltar ao quadro
        </Link>
      </p>
    </>
  );
}
