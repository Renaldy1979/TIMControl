"use client";
import { MEETING_KINDS, MEETING_KIND_LABELS, type MeetingKind } from "@timcontrol/shared";
import { createMeetingAction, deleteMeetingAction, updateMeetingAction } from "@/server/actions/kanban";
import { ActionForm } from "../ui/ActionForm";
import { Field, Select } from "../ui/Field";

interface Opt {
  id: string;
  name: string;
}

export interface MeetingValues {
  id?: string;
  projectId?: string;
  kind?: MeetingKind;
  title?: string;
  heldOn?: string;
  notes?: string;
  participantIds?: string[];
}

const list = (v: string | undefined) => (v ? v.split(",").filter(Boolean) : undefined);

function Fields({ projects, people, m, v, today }: { projects: Opt[]; people: Opt[]; m: MeetingValues; v: Record<string, string>; today: string }) {
  const chosen = new Set(list(v.participantes) ?? m.participantIds ?? []);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Tipo" name="tipo" defaultValue={v.tipo ?? m.kind ?? "meeting"}>
          {MEETING_KINDS.map((k) => (
            <option key={k} value={k}>
              {MEETING_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
        <Select label="Projeto" name="projeto" defaultValue={v.projeto ?? m.projectId ?? projects[0]?.id}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Título" name="titulo" required minLength={3} maxLength={160} defaultValue={v.titulo ?? m.title} placeholder="Ex.: Alinhamento semanal com a Accenture" />
        <Field label="Data" name="data" type="date" required defaultValue={v.data ?? m.heldOn ?? today} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="anotacoes" className="text-sm font-semibold text-ink2">
          Anotações
        </label>
        <textarea
          id="anotacoes"
          name="anotacoes"
          rows={5}
          maxLength={10000}
          defaultValue={v.anotacoes ?? m.notes}
          className="w-full rounded-md border border-bd bg-sf px-3 py-2 text-[15px] text-ink focus:border-br focus:outline-none"
          placeholder="Resumo, decisões e combinados."
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink2">Participantes</legend>
        <div className="grid max-h-56 gap-x-4 overflow-y-auto rounded-md border border-bd bg-sf p-3 sm:grid-cols-2">
          {people.map((p) => (
            <label key={p.id} className="flex min-h-touch cursor-pointer items-center gap-3 text-[15px]">
              <input type="checkbox" name="participantes" value={p.id} defaultChecked={chosen.has(p.id)} className="h-5 w-5 accent-[var(--br)]" />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function NewMeetingForm(props: { projects: Opt[]; people: Opt[]; today: string; initial: MeetingValues }) {
  return (
    <ActionForm action={createMeetingAction} submit="Registrar">
      {(v) => <Fields {...props} m={props.initial} v={v} />}
    </ActionForm>
  );
}

export function EditMeetingForm(props: { projects: Opt[]; people: Opt[]; today: string; meeting: MeetingValues }) {
  return (
    <ActionForm action={updateMeetingAction} submit="Salvar" hidden={{ id: props.meeting.id! }}>
      {(v) => <Fields {...props} m={props.meeting} v={v} />}
    </ActionForm>
  );
}

export function DeleteMeetingForm({ id }: { id: string }) {
  return <ActionForm action={deleteMeetingAction} submit="Excluir reunião" variant="danger" hidden={{ id }} />;
}
