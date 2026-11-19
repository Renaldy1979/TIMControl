"use client";
import { useState } from "react";
import { CARD_STATUSES, PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, type CardType } from "@timcontrol/shared";
import { createCardAction, updateCardAction } from "@/server/actions/kanban";
import { ActionForm } from "../ui/ActionForm";
import { Field, Select } from "../ui/Field";

export interface Opt {
  id: string;
  name: string;
}

export interface CardFormData {
  projects: Opt[];
  people: Opt[];
  groups: Opt[];
  labels: (Opt & { color: string })[];
  meId: string;
  today: string;
  /** Pode escolher a coluna ao criar/editar (permissão de mover). */
  canMove: boolean;
}

export interface CardValues {
  id?: string;
  projectId?: string;
  type?: CardType;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignees?: string[];
  labelIds?: string[];
  requesterId?: string | null;
  requestedAt?: string | null;
  externalRef?: string;
}

const area = "w-full rounded-md border border-bd bg-sf px-3 py-2 text-[15px] text-ink placeholder:text-ink3 focus:border-br focus:outline-none";

/** Valor que volta do servidor quando dá erro (vários valores vêm separados por vírgula). */
const list = (v: string | undefined) => (v ? v.split(",").filter(Boolean) : undefined);

function Fields({ d, c, v }: { d: CardFormData; c: CardValues; v: Record<string, string> }) {
  const [type, setType] = useState<CardType>((v.tipo as CardType) ?? c.type ?? "task");
  const [projectId, setProjectId] = useState(v.projeto ?? c.projectId ?? d.projects[0]?.id ?? "");
  const assignees = new Set(list(v.responsaveis) ?? c.assignees ?? []);
  const labelIds = new Set(list(v.etiquetas) ?? c.labelIds ?? []);
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink2">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["task", "Tarefa", "Atividade do time"],
              ["request", "Solicitação", "Pedido de alguém para alguém (fábrica, colega, gestor)"],
            ] as const
          ).map(([val, label, hint]) => (
            <label key={val} className="flex min-h-touch flex-1 cursor-pointer items-start gap-3 rounded-md border border-bd bg-sf p-3 has-[:checked]:border-br has-[:checked]:bg-br-soft">
              <input type="radio" name="tipo" value={val} checked={type === val} onChange={() => setType(val)} className="mt-1 h-4 w-4 accent-[var(--br)]" />
              <span>
                <span className="block font-semibold text-ink">{label}</span>
                <span className="block text-xs text-ink3">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Título" name="titulo" required minLength={3} maxLength={160} defaultValue={v.titulo ?? c.title} placeholder="Ex.: Analisar lentidão no checkout" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="descricao" className="text-sm font-semibold text-ink2">
          Descrição
        </label>
        <textarea id="descricao" name="descricao" rows={5} maxLength={10000} defaultValue={v.descricao ?? c.description} className={area} placeholder="O que precisa ser feito, contexto e critério de pronto." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Projeto" name="projeto" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
          {d.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {d.canMove ? (
          <Select label="Coluna" name="status" defaultValue={v.status ?? c.status ?? "todo"}>
            {CARD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        ) : (
          <input type="hidden" name="status" value={c.status ?? "todo"} />
        )}
        <Select label="Prioridade" name="prioridade" defaultValue={v.prioridade ?? c.priority ?? "normal"}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        <Field label={type === "request" ? "Prazo combinado" : "Prazo"} name="prazo" type="date" defaultValue={v.prazo ?? c.dueDate ?? ""} />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink2">Responsáveis {type === "request" && <span className="font-normal text-ink3">(ao menos um)</span>}</legend>
        <p className="mb-2 text-xs text-ink3">Pode marcar pessoas e grupos. Um grupo vale para todas as pessoas dele.</p>
        <div className="grid max-h-64 gap-x-4 overflow-y-auto rounded-md border border-bd bg-sf p-3 sm:grid-cols-2">
          <p className="col-span-full text-xs font-bold uppercase tracking-wide text-ink3">Grupos</p>
          {d.groups.map((g) => (
            <label key={g.id} className="flex min-h-touch cursor-pointer items-center gap-3 text-[15px]">
              <input type="checkbox" name="responsaveis" value={`g:${g.id}`} defaultChecked={assignees.has(`g:${g.id}`)} className="h-5 w-5 accent-[var(--br)]" />
              {g.name}
            </label>
          ))}
          <p className="col-span-full mt-2 text-xs font-bold uppercase tracking-wide text-ink3">Pessoas</p>
          {d.people.map((p) => (
            <label key={p.id} className="flex min-h-touch cursor-pointer items-center gap-3 text-[15px]">
              <input type="checkbox" name="responsaveis" value={`u:${p.id}`} defaultChecked={assignees.has(`u:${p.id}`)} className="h-5 w-5 accent-[var(--br)]" />
              {p.name}
              {p.id === d.meId && <span className="text-xs text-ink3">(você)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      {d.labels.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink2">Etiquetas</legend>
          <div className="flex flex-wrap gap-2">
            {d.labels.map((l) => (
              <label key={l.id} className="flex min-h-touch cursor-pointer items-center gap-2 rounded-pill border border-bd bg-sf px-3 has-[:checked]:border-current" style={{ color: l.color }}>
                <input type="checkbox" name="etiquetas" value={l.id} defaultChecked={labelIds.has(l.id)} className="h-4 w-4" style={{ accentColor: l.color }} />
                <span className="text-sm font-semibold">{l.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {type === "request" && (
        <div className="grid gap-4 rounded-md bg-sf2 p-4 sm:grid-cols-2">
          <Select label="Solicitante" name="solicitante" defaultValue={v.solicitante ?? c.requesterId ?? d.meId}>
            {d.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Field label="Data do pedido" name="pedidoEm" type="date" defaultValue={v.pedidoEm ?? c.requestedAt ?? d.today} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Referência externa (opcional)" name="referencia" maxLength={120} defaultValue={v.referencia ?? c.externalRef} placeholder="Nº do bug ou chamado em outra ferramenta" />
      </div>
    </>
  );
}

export function NewCardForm({ d, initial }: { d: CardFormData; initial: CardValues }) {
  return (
    <ActionForm action={createCardAction} submit="Criar card">
      {(v) => <Fields d={d} c={initial} v={v} />}
    </ActionForm>
  );
}

export function EditCardForm({ d, card }: { d: CardFormData; card: CardValues }) {
  return (
    <ActionForm action={updateCardAction} submit="Salvar card" hidden={{ id: card.id! }}>
      {(v) => <Fields d={d} c={card} v={v} />}
    </ActionForm>
  );
}
