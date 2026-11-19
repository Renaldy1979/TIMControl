"use client";
import { PROJECT_COLORS } from "@timcontrol/shared";
import { createProjectAction, removeProjectMemberAction, setProjectMemberAction, updateProjectAction } from "@/server/actions/admin";
import { ActionForm } from "../ui/ActionForm";
import { Check, Field, Select } from "../ui/Field";
import type { Opt } from "./UserForms";

interface ProjectValues {
  id?: string;
  name?: string;
  code?: string;
  color?: string;
  active?: boolean;
}

function ProjectFields({ p, v }: { p: ProjectValues; v: Record<string, string> }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Nome" name="nome" required defaultValue={v.nome ?? p.name} />
        <Field label="Sigla" name="sigla" required maxLength={8} defaultValue={v.sigla ?? p.code} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink2">Cor do selo</legend>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <label key={c} className="flex min-h-touch min-w-touch cursor-pointer items-center justify-center">
              <input type="radio" name="cor" value={c} defaultChecked={(v.cor ?? p.color ?? PROJECT_COLORS[0]) === c} className="peer sr-only" />
              <span aria-label={c} className="h-8 w-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-[var(--ink)] peer-focus-visible:ring-2" style={{ backgroundColor: c }} />
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function CreateProjectForm() {
  return (
    <ActionForm action={createProjectAction} submit="Criar projeto">
      {(v) => <ProjectFields p={{}} v={v} />}
    </ActionForm>
  );
}

export function EditProjectForm({ p }: { p: Required<ProjectValues> }) {
  return (
    <ActionForm action={updateProjectAction} submit="Salvar projeto" variant="secondary" hidden={{ id: p.id }}>
      {(v) => (
        <>
          <ProjectFields p={p} v={v} />
          <Check name="ativo" defaultChecked={p.active} label="Projeto ativo" />
        </>
      )}
    </ActionForm>
  );
}

export function AddMemberForm({ projectId, people, profiles, defaultProfileId }: { projectId: string; people: Opt[]; profiles: Opt[]; defaultProfileId: string }) {
  return (
    <ActionForm action={setProjectMemberAction} submit="Liberar acesso" variant="secondary" hidden={{ projeto: projectId }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Pessoa" name="pessoa" required defaultValue="">
          <option value="" disabled>
            Escolha...
          </option>
          {people.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select label="Perfil neste projeto" name="perfil" defaultValue={defaultProfileId}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
    </ActionForm>
  );
}

export function RemoveMemberForm({ projectId, userId, label }: { projectId: string; userId: string; label: string }) {
  return <ActionForm action={removeProjectMemberAction} submit={label} variant="ghost" hidden={{ projeto: projectId, pessoa: userId }} />;
}
