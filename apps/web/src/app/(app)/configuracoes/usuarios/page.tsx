import { listProfiles, listProjects, listUsers, pendingInvite } from "@timcontrol/pg";
import { USER_STATE_LABELS } from "@timcontrol/shared";
import { Badge, Card, PageHeader } from "@/components/ui/Card";
import { EditUserForm, InviteForm, ResendInviteForm, ToggleActiveForm } from "@/components/forms/UserForms";
import { asActor } from "@/server/actor";
import { requireAdmin } from "@/server/guard";

export const metadata = { title: "Usuários" };

const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

export default async function UsersPage() {
  const actor = await requireAdmin("admin.users");
  const { users, profiles, projects, invites } = await asActor(actor, async (tx) => {
    const users = await listUsers(tx);
    const invites = new Map<string, Date>();
    for (const u of users) if (u.state === "invited") {
      const i = await pendingInvite(tx, u.id);
      if (i) invites.set(u.id, i.expiresAt);
    }
    return { users, profiles: await listProfiles(tx), projects: await listProjects(tx), invites };
  });
  const profileName = new Map(profiles.map((p) => [p.id, p.name]));
  const opts = profiles.map((p) => ({ id: p.id, name: p.name }));
  const membro = profiles.find((p) => p.systemKey === "membro")?.id ?? opts[0]!.id;
  return (
    <>
      <PageHeader title="Usuários" subtitle={`${users.length} pessoas cadastradas`} />
      <div className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_420px]">
        <ul className="flex flex-col gap-3">
          {users.map((u) => (
            <li key={u.id}>
              <Card className="p-4">
                <details>
                  <summary className="flex min-h-touch cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-sm text-ink3">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{profileName.get(u.globalProfileId)}</Badge>
                      <Badge tone={u.state === "active" ? "ok" : u.state === "invited" ? "warn" : "danger"}>{USER_STATE_LABELS[u.state]}</Badge>
                    </div>
                  </summary>
                  <div className="mt-4 grid gap-4 border-t border-bd pt-4 sm:grid-cols-2">
                    <EditUserForm id={u.id} name={u.name} profileId={u.globalProfileId} profiles={opts} />
                    <div className="flex flex-col gap-3">
                      {u.state === "invited" && (
                        <>
                          {invites.get(u.id) && <p className="text-sm text-ink3">Convite vale até {fmt.format(invites.get(u.id)!)}.</p>}
                          <ResendInviteForm id={u.id} />
                        </>
                      )}
                      {u.state !== "invited" && u.id !== actor.user.id && <ToggleActiveForm id={u.id} active={u.state === "active"} />}
                    </div>
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ul>
        <Card className="self-start">
          <h2 className="mb-4 text-lg font-bold">Convidar pessoa</h2>
          <InviteForm profiles={opts} projects={projects.map((p) => ({ id: p.id, name: p.name }))} defaultProfileId={membro} memberProfileId={membro} />
        </Card>
      </div>
    </>
  );
}
