"use client";
import { addChecklistItemAction, addCommentAction } from "@/server/actions/collab";
import { ActionForm } from "../ui/ActionForm";
import { Field } from "../ui/Field";

const area = "w-full rounded-md border border-bd bg-sf px-3 py-2 text-[15px] text-ink placeholder:text-ink3 focus:border-br focus:outline-none";

/** Formulários com valores devolvidos em caso de erro (precisam ser componentes de cliente). */
export function AddChecklistItemForm({ cardId }: { cardId: string }) {
  return (
    <ActionForm action={addChecklistItemAction} submit="Incluir item" variant="secondary" hidden={{ cardId }} className="sm:flex-row sm:items-end">
      {(v) => <Field label="Novo item" name="texto" maxLength={200} required defaultValue={v.texto} placeholder="Ex.: Coletar logs do dia" className="flex-1" />}
    </ActionForm>
  );
}

export function NewCommentForm({ cardId, people }: { cardId: string; people: { id: string; name: string }[] }) {
  return (
    <ActionForm action={addCommentAction} submit="Comentar" hidden={{ cardId }}>
      {(v) => (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink2">
            Novo comentário
            <textarea name="texto" rows={3} maxLength={5000} required defaultValue={v.texto} className={area} placeholder="Atualização, dúvida ou combinado. Evite colar dados de clientes." />
          </label>
          {people.length > 0 && (
            <details>
              <summary className="inline-flex min-h-touch cursor-pointer items-center text-sm font-semibold text-br-2">Mencionar alguém (avisa no sininho)</summary>
              <div className="mt-2 grid max-h-56 gap-x-4 overflow-y-auto rounded-md border border-bd bg-sf p-3 sm:grid-cols-2">
                {people.map((p) => (
                  <label key={p.id} className="flex min-h-touch cursor-pointer items-center gap-3 text-[15px]">
                    <input type="checkbox" name="mencionar" value={p.id} className="h-5 w-5 accent-[var(--br)]" />
                    {p.name}
                  </label>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </ActionForm>
  );
}
