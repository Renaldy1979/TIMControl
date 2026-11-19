import { redirect } from "next/navigation";
import { countUsers, withSistema } from "@timcontrol/pg";
import { AuthFrame } from "@/components/app/AuthFrame";
import { LoginForm } from "@/components/forms/AuthForms";
import { Notice } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if ((await withSistema((tx) => countUsers(tx))) === 0) redirect("/configuracao-inicial");
  const { ok } = await searchParams;
  return (
    <AuthFrame title="Entrar" subtitle="Use o e-mail e a senha do seu convite.">
      {ok === "senha" && (
        <div className="mb-4">
          <Notice tone="ok">Senha alterada. Entre com a nova senha.</Notice>
        </div>
      )}
      <LoginForm />
    </AuthFrame>
  );
}
