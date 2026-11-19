"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/server/form";
import { cx } from "../ui/cx";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Botão pequeno ligado a uma Server Action (marcar item, apagar), com o erro logo ao lado. */
export function MiniAction({ action, hidden, label, children, className, buttonClass }: { action: Action; hidden: Record<string, string>; label: string; children: React.ReactNode; className?: string; buttonClass?: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={cx("flex items-center gap-2", className)}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Btn label={label} className={buttonClass}>
        {children}
      </Btn>
      {state.error && (
        <span role="alert" className="text-xs font-semibold text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}

function Btn({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" aria-label={label} title={label} disabled={pending} aria-busy={pending} className={cx("inline-flex min-h-touch min-w-touch items-center justify-center rounded-md disabled:opacity-50", className)}>
      {children}
    </button>
  );
}
