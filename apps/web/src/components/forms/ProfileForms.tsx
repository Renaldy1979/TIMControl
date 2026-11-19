"use client";
import { ACTION_LABELS, ALL_PERMISSION_KEYS, allowsOwn, FEATURE_LABELS, SCOPE_LABELS, type Feature, type ProfileRef } from "@timcontrol/shared";
import { createProfileAction, deleteProfileAction, saveMatrix } from "@/server/actions/admin";
import { ActionForm } from "../ui/ActionForm";
import { Check, Field, Select } from "../ui/Field";

/** Matriz perfil × funcionalidade × ação. A coluna do Gestor é fixa (tem tudo). */
export function MatrixForm({ profiles }: { profiles: ProfileRef[] }) {
  const features = [...new Set(ALL_PERMISSION_KEYS.map((k) => k.split(".")[0] as Feature))];
  return (
    <ActionForm action={saveMatrix} submit="Salvar permissões">
      <div className="overflow-x-auto rounded-md border border-bd">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-sf2 text-left">
              <th scope="col" className="p-3 font-semibold text-ink2">
                Permissão
              </th>
              {profiles.map((p) => (
                <th key={p.id} scope="col" className="p-3 font-semibold text-ink">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-bd">
              <th scope="row" className="p-3 text-left font-medium text-ink2">
                Vê todos os projetos
                <span className="block text-xs font-normal text-ink3">Sem isso, só vê os projetos liberados para a pessoa.</span>
              </th>
              {profiles.map((p) => (
                <td key={p.id} className="p-3">
                  {p.systemKey === "gestor" ? (
                    <span className="text-ink3">Sim</span>
                  ) : (
                    <Check name={`all:${p.id}`} defaultChecked={p.allProjects} label={<span className="sr-only">{`${p.name}: vê todos os projetos`}</span>} />
                  )}
                </td>
              ))}
            </tr>
            {features.map((f) => (
              <FeatureRows key={f} feature={f} profiles={profiles} />
            ))}
          </tbody>
        </table>
      </div>
    </ActionForm>
  );
}

function FeatureRows({ feature, profiles }: { feature: Feature; profiles: ProfileRef[] }) {
  const keys = ALL_PERMISSION_KEYS.filter((k) => k.startsWith(`${feature}.`));
  return (
    <>
      <tr className="border-t border-bd bg-br-soft/60">
        <th colSpan={profiles.length + 1} scope="rowgroup" className="p-3 text-left text-xs font-bold uppercase tracking-wide text-br-2">
          {FEATURE_LABELS[feature]}
        </th>
      </tr>
      {keys.map((k) => (
        <tr key={k} className="border-t border-bd">
          <th scope="row" className="p-3 text-left font-medium text-ink2">
            {ACTION_LABELS[k] ?? k}
          </th>
          {profiles.map((p) => (
            <td key={p.id} className="p-2">
              {p.systemKey === "gestor" ? (
                <span className="text-ink3">{SCOPE_LABELS.all}</span>
              ) : (
                <select
                  name={`g:${p.id}:${k}`}
                  defaultValue={p.grants[k] ?? "none"}
                  aria-label={`${p.name}: ${ACTION_LABELS[k] ?? k}`}
                  className="min-h-touch w-full rounded-sm border border-bd bg-sf px-2 text-sm"
                >
                  <option value="none">{SCOPE_LABELS.none}</option>
                  <option value="all">{SCOPE_LABELS.all}</option>
                  {allowsOwn(k) && <option value="own">{SCOPE_LABELS.own}</option>}
                </select>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CreateProfileForm({ profiles }: { profiles: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createProfileAction} submit="Criar perfil" variant="secondary">
      {(v) => (
        <>
          <Field label="Nome do perfil" name="nome" required defaultValue={v.nome} />
          <Select label="Começar com as permissões de" name="base" defaultValue={profiles[0]?.id}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Check name="todos" label="Vê todos os projetos" />
        </>
      )}
    </ActionForm>
  );
}

export function DeleteProfileForm({ id, name }: { id: string; name: string }) {
  return <ActionForm action={deleteProfileAction} submit={`Excluir ${name}`} variant="danger" hidden={{ id }} />;
}
