import { AuthFrame } from "@/components/app/AuthFrame";
import { AcceptInviteForm } from "@/components/forms/AuthForms";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Aceitar convite" };

/** O link do e-mail traz o token do convite (t) e, do Magic URL do Appwrite, userId e secret. Só confirma no clique do botão. */
export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ t?: string; e?: string; userId?: string; secret?: string }> }) {
  const { t, e, userId, secret } = await searchParams;
  return (
    <AuthFrame title="Bem-vindo ao TIMControl" subtitle="Crie sua senha para entrar.">
      {t && userId && secret ? (
        <AcceptInviteForm t={t} userId={userId} secret={secret} email={e ?? ""} />
      ) : (
        <Notice tone="error">Link de convite incompleto. Abra de novo o link do e-mail ou peça ao Gestor para reenviar.</Notice>
      )}
    </AuthFrame>
  );
}
