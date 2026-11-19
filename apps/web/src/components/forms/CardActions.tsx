"use client";
import { CARD_STATUSES, STATUS_LABELS, type CardStatus } from "@timcontrol/shared";
import { deleteCardAction, moveCardFormAction } from "@/server/actions/kanban";
import { ActionForm } from "../ui/ActionForm";
import { Select } from "../ui/Field";

/** Mover sem arrastar (teclado, leitor de tela, celular). */
export function MoveCardForm({ id, status }: { id: string; status: CardStatus }) {
  return (
    <ActionForm action={moveCardFormAction} submit="Mover" variant="secondary" hidden={{ id }} className="sm:flex-row sm:items-end">
      <Select key={status} label="Mover para" name="status" defaultValue={status} className="sm:min-w-[220px]">
        {CARD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
    </ActionForm>
  );
}

export function DeleteCardForm({ id }: { id: string }) {
  return <ActionForm action={deleteCardAction} submit="Excluir card de vez" variant="danger" hidden={{ id }} />;
}
