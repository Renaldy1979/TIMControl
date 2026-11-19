"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/server/form";
import { Button } from "./Button";
import { Notice } from "./Notice";
import { cx } from "./cx";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/**
 * Formulário ligado a uma Server Action (useActionState): mostra erro e sucesso e desabilita o botão enquanto envia.
 * `children` pode ser uma função que recebe os valores devolvidos (para manter o que a pessoa digitou).
 */
export function ActionForm({
  action,
  children,
  submit,
  variant = "primary",
  className,
  hidden,
}: {
  action: Action;
  children?: React.ReactNode | ((values: Record<string, string>) => React.ReactNode);
  submit: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={cx("flex flex-col gap-4", className)}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {typeof children === "function" ? children(state.values ?? {}) : children}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="ok">{state.ok}</Notice>}
      <Submit label={submit} variant={variant} />
    </form>
  );
}

function Submit({ label, variant }: { label: string; variant: "primary" | "secondary" | "danger" | "ghost" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} className="self-start">
      {pending ? "Enviando..." : label}
    </Button>
  );
}
