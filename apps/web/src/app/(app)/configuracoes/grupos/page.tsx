import { listGroups, listUsers } from "@timcontrol/pg";
import { Badge, Card, PageHeader } from "@/components/ui/Card";
import { CreateGroupForm, EditGroupForm } from "@/components/forms/GroupForms";
import { asActor } from "@/server/actor";
import { requireAdmin } from "@/server/guard";

export const metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const actor = await requireAdmin("admin.groups");
  const { groups, users } = await asActor(actor, async (tx) => ({ groups: await listGroups(tx), users: await listUsers(tx) }));
  const people = users.filter((u) => u.state !== "disabled").map((u) => ({ id: u.id, name: u.name }));
  const name = new Map(users.map((u) => [u.id, u.name]));
  return (
    <>
      <PageHeader title="Grupos" subtitle="Um grupo coloca várias pessoas como responsável de um card de uma vez. Quem acessa e altera os cards são as pessoas." />
      <div className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_400px]">
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Card className="p-4">
                <details>
                  <summary className="flex min-h-touch cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{g.name}</p>
                      <p className="text-sm text-ink3">{g.memberIds.map((id) => name.get(id)).filter(Boolean).join(", ") || "Sem pessoas ainda"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!g.active && <Badge tone="danger">Inativo</Badge>}
                      <Badge tone="brand">{g.memberIds.length} pessoas</Badge>
                    </div>
                  </summary>
                  <div className="mt-4 border-t border-bd pt-4">
                    <EditGroupForm g={g} people={people} />
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ul>
        <Card className="self-start">
          <h2 className="mb-4 text-lg font-bold">Novo grupo</h2>
          <CreateGroupForm people={people} />
        </Card>
      </div>
    </>
  );
}
