"use client";
import { createGroupAction, updateGroupAction } from "@/server/actions/admin";
import { ActionForm } from "../ui/ActionForm";
import { Check, Field } from "../ui/Field";
import type { Opt } from "./UserForms";

function Members({ people, selected }: { people: Opt[]; selected: string[] }) {
  return (
    <fieldset className="rounded-md border border-bd p-4">
      <legend className="px-1 text-sm font-semibold text-ink2">Pessoas do grupo</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {people.map((u) => (
          <Check key={u.id} name="membros" value={u.id} defaultChecked={selected.includes(u.id)} label={u.name} />
        ))}
      </div>
    </fieldset>
  );
}

export function CreateGroupForm({ people }: { people: Opt[] }) {
  return (
    <ActionForm action={createGroupAction} submit="Criar grupo">
      {(v) => (
        <>
          <Field label="Nome" name="nome" required defaultValue={v.nome} />
          <Field label="Descrição (opcional)" name="descricao" defaultValue={v.descricao} />
          <Members people={people} selected={[]} />
        </>
      )}
    </ActionForm>
  );
}

export function EditGroupForm({ g, people }: { g: { id: string; name: string; description: string; active: boolean; memberIds: string[] }; people: Opt[] }) {
  return (
    <ActionForm action={updateGroupAction} submit="Salvar grupo" variant="secondary" hidden={{ id: g.id }}>
      <Field label="Nome" name="nome" required defaultValue={g.name} />
      <Field label="Descrição (opcional)" name="descricao" defaultValue={g.description} />
      <Members people={people} selected={g.memberIds} />
      <Check name="ativo" defaultChecked={g.active} label="Grupo ativo" />
    </ActionForm>
  );
}
