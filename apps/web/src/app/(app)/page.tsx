import { listProjects } from "@timcontrol/pg";
import { profileFor } from "@timcontrol/shared";
import { Card, PageHeader, ProjectChip } from "@/components/ui/Card";
import { asActor, requireActor } from "@/server/actor";

export const metadata = { title: "Início" };

export default async function HomePage() {
  const actor = await requireActor();
  const projects = (await asActor(actor, (tx) => listProjects(tx))).filter((p) => p.active);
  const first = actor.user.name.split(/\s+/)[0];
  return (
    <>
      <PageHeader title={`Olá, ${first}`} subtitle="Estes são os projetos que você acompanha. Os quadros kanban chegam no Lote 2." />
      {projects.length === 0 ? (
        <Card>
          <p className="text-ink2">Nenhum projeto liberado para você ainda. Fale com o Gestor.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 wide:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-between">
                  <ProjectChip name={p.name} color={p.color} />
                  <span className="font-mono text-xs text-ink3">{p.code}</span>
                </div>
                <p className="text-sm text-ink3">Seu perfil aqui: {profileFor(actor.viewer, p.id)?.name ?? "sem acesso"}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
