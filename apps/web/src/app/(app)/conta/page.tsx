import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/Card";
import { MyNameForm } from "@/components/forms/AccountForms";
import { buttonClass } from "@/components/ui/Button";
import { requireActor } from "@/server/actor";
import { signOut } from "@/server/actions/auth";
import { adminSectionsFor } from "@/lib/admin";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const actor = await requireActor();
  return (
    <>
      <PageHeader title="Minha conta" subtitle={actor.user.email} />
      <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
        <Card>
          <MyNameForm name={actor.user.name} />
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-ink2">Perfil geral: {actor.viewer.globalProfile.name}</p>
          {adminSectionsFor(actor.viewer).length > 0 && (
            <Link href="/configuracoes" className={buttonClass("secondary", "self-start desk:hidden")}>
              Configurações
            </Link>
          )}
          <Link href="/esqueci-senha" className={buttonClass("secondary", "self-start")}>
            Trocar senha
          </Link>
          <form action={signOut}>
            <button type="submit" className={buttonClass("ghost")}>
              Sair
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
