import { listProfiles, listProjectMembers, listProjects, listUsers } from "@timcontrol/pg";
import { Badge, Card, PageHeader, ProjectChip } from "@/components/ui/Card";
import { AddMemberForm, CreateProjectForm, EditProjectForm, RemoveMemberForm } from "@/components/forms/ProjectForms";
import { asActor } from "@/server/actor";
import { requireAdmin } from "@/server/guard";

export const metadata = { title: "Projetos" };

export default async function ProjectsPage() {
  const actor = await requireAdmin("admin.projects");
  const { projects, members, users, profiles } = await asActor(actor, async (tx) => ({
    projects: await listProjects(tx),
    members: await listProjectMembers(tx),
    users: await listUsers(tx),
    profiles: await listProfiles(tx),
  }));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const profileName = new Map(profiles.map((p) => [p.id, p.name]));
  const people = users.filter((u) => u.state !== "disabled").map((u) => ({ id: u.id, name: u.name }));
  const profileOpts = profiles.filter((p) => p.systemKey !== "gestor").map((p) => ({ id: p.id, name: p.name }));
  const membro = profiles.find((p) => p.systemKey === "membro")?.id ?? profileOpts[0]?.id ?? "";
  return (
    <>
      <PageHeader title="Projetos" subtitle="Cada projeto é um sistema coberto pelo time. Membros veem todos; Visitantes e fábricas só os liberados aqui." />
      <div className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_400px]">
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const pm = members.filter((m) => m.projectId === p.id);
            return (
              <li key={p.id}>
                <Card className="p-4">
                  <details>
                    <summary className="flex min-h-touch cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <ProjectChip name={p.name} color={p.color} />
                        <span className="font-mono text-xs text-ink3">{p.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!p.active && <Badge tone="danger">Inativo</Badge>}
                        <Badge>{pm.length} com acesso específico</Badge>
                      </div>
                    </summary>
                    <div className="mt-4 grid gap-6 border-t border-bd pt-4 desk:grid-cols-2">
                      <EditProjectForm p={p} />
                      <div className="flex flex-col gap-4">
                        <h3 className="font-semibold">Acesso específico</h3>
                        {pm.length === 0 ? (
                          <p className="text-sm text-ink3">Ninguém com perfil específico. Membros acessam pelo perfil geral.</p>
                        ) : (
                          <ul className="flex flex-col divide-y divide-[var(--bd)]">
                            {pm.map((m) => (
                              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                <span>
                                  {userName.get(m.userId)} <span className="text-sm text-ink3">· {profileName.get(m.profileId)}</span>
                                </span>
                                <RemoveMemberForm projectId={p.id} userId={m.userId} label="Remover" />
                              </li>
                            ))}
                          </ul>
                        )}
                        <AddMemberForm projectId={p.id} people={people} profiles={profileOpts} defaultProfileId={membro} />
                      </div>
                    </div>
                  </details>
                </Card>
              </li>
            );
          })}
        </ul>
        <Card className="self-start">
          <h2 className="mb-4 text-lg font-bold">Novo projeto</h2>
          <CreateProjectForm />
        </Card>
      </div>
    </>
  );
}
