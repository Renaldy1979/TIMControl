import { Download, FileText, Trash2 } from "lucide-react";
import { formatDateTimeBR } from "@timcontrol/domain";
import type { AttachmentView } from "@timcontrol/pg";
import { ATTACHMENT_EXTENSIONS } from "@timcontrol/shared";
import { deleteAttachmentAction, uploadAttachmentAction } from "@/server/actions/collab";
import { ActionForm } from "../ui/ActionForm";
import { MiniAction } from "./MiniAction";

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`);

export function AttachmentsPanel({ cardId, items, canWork, canEditStructure, meId }: { cardId: string; items: AttachmentView[]; canWork: boolean; canEditStructure: boolean; meId: string }) {
  return (
    <section aria-labelledby="attachments-h" className="flex flex-col gap-3">
      <h2 id="attachments-h" className="text-lg font-bold">
        Anexos ({items.length})
      </h2>
      <p className="text-xs text-ink3">Ficam guardados sem link público; só quem vê o card baixa, e cada download fica registrado.</p>
      {items.length === 0 && <p className="text-sm text-ink3">Nenhum anexo.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((a) => {
          const canDelete = (a.uploadedBy === meId && canWork) || canEditStructure;
          return (
            <li key={a.id} className="flex items-center gap-3 rounded-md border border-bd/70 p-2 pl-3">
              <FileText size={20} className="shrink-0 text-ink3" aria-hidden />
              <div className="min-w-0 flex-1">
                <a href={`/api/anexos/${a.id}`} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-br-2 hover:underline">
                  {a.name}
                </a>
                <p className="text-xs text-ink3">
                  {formatBytes(a.size)} · {a.uploadedByName} · {formatDateTimeBR(a.createdAt)}
                </p>
              </div>
              <a href={`/api/anexos/${a.id}?baixar=1`} aria-label={`Baixar ${a.name}`} title="Baixar" className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md text-ink2 hover:bg-sf2">
                <Download size={18} aria-hidden />
              </a>
              {canDelete && (
                <MiniAction action={deleteAttachmentAction} hidden={{ id: a.id }} label={`Apagar anexo ${a.name}`} buttonClass="text-ink3 hover:bg-danger-bg hover:text-danger">
                  <Trash2 size={18} aria-hidden />
                </MiniAction>
              )}
            </li>
          );
        })}
      </ul>
      {canWork && (
        <ActionForm action={uploadAttachmentAction} submit="Enviar anexo" variant="secondary" hidden={{ cardId }}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink2">
            Arquivo (até 10 MB)
            <input
              type="file"
              name="arquivo"
              required
              accept={ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(",")}
              className="min-h-touch w-full rounded-md border border-bd bg-sf px-3 py-2 text-[15px] text-ink file:mr-3 file:rounded-md file:border-0 file:bg-br-soft file:px-3 file:py-1.5 file:font-semibold file:text-br-2"
            />
            <span className="text-xs font-normal text-ink3">Imagem, PDF, texto, planilha, documento ou zip.</span>
          </label>
        </ActionForm>
      )}
    </section>
  );
}
