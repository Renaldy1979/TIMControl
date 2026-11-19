import { AuthFrame } from "@/components/app/AuthFrame";
import { ResetForm } from "@/components/forms/AuthForms";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Nova senha" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ userId?: string; secret?: string }> }) {
  const { userId, secret } = await searchParams;
  return (
    <AuthFrame title="Criar nova senha">
      {userId && secret ? <ResetForm userId={userId} secret={secret} /> : <Notice tone="error">Link inválido. Peça um novo em &quot;Esqueci minha senha&quot;.</Notice>}
    </AuthFrame>
  );
}
