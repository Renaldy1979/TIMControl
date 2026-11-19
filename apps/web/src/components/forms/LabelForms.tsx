"use client";
import { PROJECT_COLORS } from "@timcontrol/shared";
import { createLabelAction, deleteLabelAction, updateLabelAction } from "@/server/actions/kanban";
import { ActionForm } from "../ui/ActionForm";
import { Field } from "../ui/Field";

function Colors({ value }: { value?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink2">Cor</legend>
      <div className="flex flex-wrap gap-2">
        {PROJECT_COLORS.map((c) => (
          <label key={c} className="flex min-h-touch min-w-touch cursor-pointer items-center justify-center">
            <input type="radio" name="cor" value={c} defaultChecked={(value ?? PROJECT_COLORS[0]) === c} className="peer sr-only" />
            <span aria-label={c} className="h-8 w-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-[var(--ink)] peer-focus-visible:ring-2" style={{ backgroundColor: c }} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CreateLabelForm() {
  return (
    <ActionForm action={createLabelAction} submit="Criar etiqueta">
      {(v) => (
        <>
          <Field label="Nome" name="nome" required maxLength={30} defaultValue={v.nome} />
          <Colors value={v.cor} />
        </>
      )}
    </ActionForm>
  );
}

export function EditLabelForm({ l }: { l: { id: string; name: string; color: string } }) {
  return (
    <div className="flex flex-col gap-3">
      <ActionForm action={updateLabelAction} submit="Salvar" variant="secondary" hidden={{ id: l.id }}>
        <Field label="Nome" name="nome" required maxLength={30} defaultValue={l.name} />
        <Colors value={l.color} />
      </ActionForm>
      <ActionForm action={deleteLabelAction} submit="Excluir etiqueta" variant="ghost" hidden={{ id: l.id }} />
    </div>
  );
}
