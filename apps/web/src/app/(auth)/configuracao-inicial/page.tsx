import { redirect } from "next/navigation";
import { countUsers, withSistema } from "@timcontrol/pg";
import { AuthFrame } from "@/components/app/AuthFrame";
import { SetupForm } from "@/components/forms/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuração inicial" };

/** Só existe enquanto não há nenhuma pessoa cadastrada: cria o primeiro Gestor e os dados iniciais. */
export default async function SetupPage() {
  if ((await withSistema((tx) => countUsers(tx))) > 0) redirect("/login");
  return (
    <AuthFrame title="Configuração inicial" subtitle="Crie a conta do Gestor. Os perfis, os 3 projetos e os grupos iniciais são criados junto.">
      <SetupForm />
    </AuthFrame>
  );
}
