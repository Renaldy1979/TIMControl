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
 * `inline`: campo e botão na mesma linha a partir de `sm` (botão alinhado pela base do campo); avisos embaixo.
 */
export function ActionForm({
  action,
  children,
  submit,
  variant = "primary",
  className,
  hidden,
  inline = false,
}: {
  action: Action;
  children?: React.ReactNode | ((values: Record<string, string>) => React.ReactNode);
  submit: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  hidden?: Record<string, string>;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const fields = typeof children === "function" ? children(state.values ?? {}) : children;
  return (
    <form action={formAction} className={cx("flex flex-col gap-4", className)}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {inline ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {fields}
          <Submit label={submit} variant={variant} inline />
        </div>
      ) : (
        fields
      )}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="ok">{state.ok}</Notice>}
      {!inline && <Submit label={submit} variant={variant} />}
    </form>
  );
}

function Submit({ label, variant, inline = false }: { label: string; variant: "primary" | "secondary" | "danger" | "ghost"; inline?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} className={inline ? "shrink-0 self-start sm:self-auto" : "self-start"}>
      {pending ? "Enviando..." : label}
    </Button>
  );
}
