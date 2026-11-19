import Link from "next/link";
import { PRIORITIES, PRIORITY_LABELS } from "@timcontrol/shared";
import type { FilterState, KanbanContext } from "@/server/kanban";
import { buttonClass } from "../ui/Button";

const control = "min-h-touch w-full rounded-md border border-bd bg-sf px-3 text-sm text-ink focus:border-br focus:outline-none";

function Sel({ name, label, value, children }: { name: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold text-ink2">
      {label}
      <select name={name} defaultValue={value} className={control}>
        {children}
      </select>
    </label>
  );
}

/** Filtros do quadro e das listas (formulário GET: funciona sem JavaScript e o link pode ser compartilhado). */
export function Filters({ ctx, f, action, hide = [], extra }: { ctx: KanbanContext; f: FilterState; action: string; hide?: (keyof FilterState)[]; extra?: Record<string, string> }) {
  const show = (k: keyof FilterState) => !hide.includes(k);
  const active = Object.entries(f).some(([k, v]) => v && !hide.includes(k as keyof FilterState));
  const count = Object.entries(f).filter(([k, v]) => v && !hide.includes(k as keyof FilterState)).length;
  const form = (
    <form action={action} method="get" className="rounded-lg bg-sf p-4 shadow-sm" role="search" aria-label="Filtros">
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="flex flex-wrap items-end gap-3">
        {show("q") && (
          <label className="flex min-w-[180px] flex-[2] flex-col gap-1 text-xs font-semibold text-ink2">
            Buscar
            <input name="q" defaultValue={f.q} placeholder="Título, descrição ou referência" className={control} />
          </label>
        )}
        {show("projeto") && (
          <Sel name="projeto" label="Projeto" value={f.projeto}>
            <option value="">Todos</option>
            {ctx.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Sel>
        )}
        {show("resp") && (
          <Sel name="resp" label="Responsável" value={f.resp}>
            <option value="">Qualquer um</option>
            <option value="eu">Eu (direto ou por grupo)</option>
            <optgroup label="Grupos">
              {ctx.groups.map((g) => (
                <option key={g.id} value={`g:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Pessoas">
              {ctx.people.map((p) => (
                <option key={p.id} value={`u:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </Sel>
        )}
        {show("prioridade") && (
          <Sel name="prioridade" label="Prioridade" value={f.prioridade}>
            <option value="">Todas</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Sel>
        )}
        {show("etiqueta") && (
          <Sel name="etiqueta" label="Etiqueta" value={f.etiqueta}>
            <option value="">Todas</option>
            {ctx.labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Sel>
        )}
        {show("prazo") && (
          <Sel name="prazo" label="Prazo" value={f.prazo}>
            <option value="">Qualquer</option>
            <option value="atrasados">Atrasados</option>
            <option value="semana">Próximos 7 dias</option>
          </Sel>
        )}
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("primary")}>
            Filtrar
          </button>
          {active && (
            <Link href={`${action}${extra ? `?${new URLSearchParams(extra)}` : ""}`} className={buttonClass("ghost")}>
              Limpar
            </Link>
          )}
        </div>
      </div>
    </form>
  );
  return (
    <div className="mb-6">
      {/* Celular: filtros recolhidos para o quadro aparecer logo. Computador: sempre abertos. */}
      <details className="desk:hidden" open={count > 0}>
        <summary className="mb-3 flex min-h-touch cursor-pointer items-center rounded-lg bg-sf px-4 font-semibold text-ink shadow-sm">
          Filtros{count > 0 ? ` (${count} ativo${count > 1 ? "s" : ""})` : ""}
        </summary>
        {form}
      </details>
      <div className="hidden desk:block">{form}</div>
    </div>
  );
}
