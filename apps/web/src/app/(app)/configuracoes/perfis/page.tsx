import { listProfiles } from "@timcontrol/pg";
import { Card, PageHeader } from "@/components/ui/Card";
import { CreateProfileForm, DeleteProfileForm, MatrixForm } from "@/components/forms/ProfileForms";
import { asActor } from "@/server/actor";
import { requireAdmin } from "@/server/guard";

export const metadata = { title: "Perfis e permissões" };

export default async function ProfilesPage() {
  const actor = await requireAdmin("admin.profiles");
  const profiles = await asActor(actor, (tx) => listProfiles(tx));
  const custom = profiles.filter((p) => !p.systemKey);
  return (
    <>
      <PageHeader title="Perfis e permissões" subtitle="Escolha o que cada perfil pode fazer. &quot;Os seus&quot; vale para os cards que a pessoa criou ou em que é responsável." />
      <Card>
        <MatrixForm profiles={profiles} />
      </Card>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Novo perfil</h2>
          <CreateProfileForm profiles={profiles.filter((p) => p.systemKey !== "gestor").map((p) => ({ id: p.id, name: p.name }))} />
        </Card>
        {custom.length > 0 && (
          <Card>
            <h2 className="mb-4 text-lg font-bold">Excluir perfil</h2>
            <p className="mb-4 text-sm text-ink3">Só perfis criados por você e que ninguém usa.</p>
            <div className="flex flex-col gap-3">
              {custom.map((p) => (
                <DeleteProfileForm key={p.id} id={p.id} name={p.name} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
