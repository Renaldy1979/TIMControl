"use client";
import Link from "next/link";
import { acceptInvite, forgotPassword, initialSetup, resetPassword, signIn } from "@/server/actions/auth";
import { ActionForm } from "../ui/ActionForm";
import { Check, Field } from "../ui/Field";

export function LoginForm() {
  return (
    <ActionForm action={signIn} submit="Entrar">
      {(v) => (
        <>
          <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={v.email} />
          <Field label="Senha" name="senha" type="password" autoComplete="current-password" required />
          <Check label="Manter conectado neste aparelho" name="lembrar" defaultChecked />
          <Link href="/esqueci-senha" className="text-sm font-semibold text-br-2 hover:underline">
            Esqueci minha senha
          </Link>
        </>
      )}
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={forgotPassword} submit="Enviar link">
      {(v) => <Field label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={v.email} />}
    </ActionForm>
  );
}

export function ResetForm({ userId, secret }: { userId: string; secret: string }) {
  return (
    <ActionForm action={resetPassword} submit="Salvar nova senha" hidden={{ userId, secret }}>
      <Field label="Nova senha" name="senha" type="password" autoComplete="new-password" minLength={8} required hint="Mínimo de 8 caracteres." />
      <Field label="Repita a nova senha" name="confirmar" type="password" autoComplete="new-password" required />
    </ActionForm>
  );
}

export function AcceptInviteForm({ t, userId, secret, email }: { t: string; userId: string; secret: string; email: string }) {
  return (
    <ActionForm action={acceptInvite} submit="Criar senha e entrar" hidden={{ t, userId, secret }}>
      {email && <Field label="E-mail" value={email} readOnly disabled />}
      <Field label="Crie sua senha" name="senha" type="password" autoComplete="new-password" minLength={8} required hint="Mínimo de 8 caracteres." />
      <Field label="Repita a senha" name="confirmar" type="password" autoComplete="new-password" required />
    </ActionForm>
  );
}

export function SetupForm() {
  return (
    <ActionForm action={initialSetup} submit="Criar conta de Gestor">
      {(v) => (
        <>
          <Field label="Código de configuração" name="codigo" required autoComplete="off" hint="O valor de SETUP_CODE definido no EasyPanel." />
          <Field label="Seu nome" name="nome" required autoComplete="name" defaultValue={v.nome} />
          <Field label="E-mail" name="email" type="email" required autoComplete="email" defaultValue={v.email} />
          <Field label="Senha" name="senha" type="password" minLength={8} required autoComplete="new-password" hint="Mínimo de 8 caracteres." />
          <Field label="Repita a senha" name="confirmar" type="password" required autoComplete="new-password" />
        </>
      )}
    </ActionForm>
  );
}
