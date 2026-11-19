import Link from "next/link";
import { AuthFrame } from "@/components/app/AuthFrame";
import { ForgotForm } from "@/components/forms/AuthForms";

export const metadata = { title: "Esqueci minha senha" };

export default function ForgotPage() {
  return (
    <AuthFrame title="Esqueci minha senha" subtitle="Enviamos um link para você criar uma senha nova.">
      <ForgotForm />
      <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-br-2 hover:underline">
        Voltar para entrar
      </Link>
    </AuthFrame>
  );
}
