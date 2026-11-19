"use client";
import { inviteUser, resendInvite, setUserActive, updateUserAdmin } from "@/server/actions/admin";
import { ActionForm } from "../ui/ActionForm";
import { Check, Field, Select } from "../ui/Field";

export interface Opt {
  id: string;
  name: string;
}

export function InviteForm({ profiles, projects, defaultProfileId, memberProfileId }: { profiles: Opt[]; projects: Opt[]; defaultProfileId: string; memberProfileId: string }) {
  return (
    <ActionForm action={inviteUser} submit="Enviar convite">
      {(v) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" name="nome" required defaultValue={v.nome} />
            <Field label="E-mail" name="email" type="email" required defaultValue={v.email} />
          </div>
          <Select label="Perfil geral" name="perfil" defaultValue={defaultProfileId}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <fieldset className="rounded-md border border-bd p-4">
            <legend className="px-1 text-sm font-semibold text-ink2">Liberar projetos (opcional)</legend>
            <p className="mb-2 text-xs text-ink3">Use para Visitantes e pessoas das fábricas: elas só veem os projetos marcados aqui.</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {projects.map((p) => (
                <Check key={p.id} name="projetos" value={p.id} label={p.name} />
              ))}
            </div>
            <Select label="Perfil nesses projetos" name="perfilProjetos" defaultValue={memberProfileId} className="mt-3">
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </fieldset>
        </>
      )}
    </ActionForm>
  );
}

export function EditUserForm({ id, name, profileId, profiles }: { id: string; name: string; profileId: string; profiles: Opt[] }) {
  return (
    <ActionForm action={updateUserAdmin} submit="Salvar" variant="secondary" hidden={{ id }}>
      <Field label="Nome" name="nome" required defaultValue={name} />
      <Select label="Perfil geral" name="perfil" defaultValue={profileId}>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </ActionForm>
  );
}

export function ResendInviteForm({ id }: { id: string }) {
  return <ActionForm action={resendInvite} submit="Reenviar convite" variant="secondary" hidden={{ id }} />;
}

export function ToggleActiveForm({ id, active }: { id: string; active: boolean }) {
  return <ActionForm action={setUserActive} submit={active ? "Desativar acesso" : "Reativar acesso"} variant={active ? "danger" : "secondary"} hidden={{ id, ativo: active ? "0" : "1" }} />;
}
