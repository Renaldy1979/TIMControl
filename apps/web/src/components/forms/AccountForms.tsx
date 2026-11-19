"use client";
import { updateMyName } from "@/server/actions/admin";
import { ActionForm } from "../ui/ActionForm";
import { Field } from "../ui/Field";

export function MyNameForm({ name }: { name: string }) {
  return (
    <ActionForm action={updateMyName} submit="Salvar nome">
      <Field label="Seu nome" name="nome" required defaultValue={name} />
    </ActionForm>
  );
}
