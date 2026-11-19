import { audit, getAttachment } from "@timcontrol/pg";
import { asActor, currentActor } from "@/server/actor";
import { downloadFile } from "@/server/storage";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Tipos que o navegador pode abrir na própria aba; o resto sempre baixa. */
const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

/**
 * Download de anexo (Lote 3). Único caminho até o arquivo: confere quem é a pessoa, busca o anexo com o RLS dela
 * (quem não vê o card recebe 404), registra no audit_log e entrega o arquivo do bucket privado. Não existe link público.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return new Response("Faça login para baixar o anexo.", { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Anexo não encontrado.", { status: 404 });
  const att = await asActor(actor, async (tx) => {
    const a = await getAttachment(tx, id);
    if (a) await audit(tx, actor.user.id, "attachment.downloaded", "attachment", id, { cardId: a.cardId });
    return a;
  });
  if (!att) return new Response("Anexo não encontrado.", { status: 404 });
  let body: ArrayBuffer;
  try {
    body = await downloadFile(att.fileId);
  } catch (e) {
    console.error("[attachment.download]", (e as Error).name);
    return new Response("Não foi possível buscar o arquivo agora.", { status: 502 });
  }
  const download = new URL(req.url).searchParams.has("baixar") || !INLINE.has(att.mimeType);
  const type = INLINE.has(att.mimeType) ? att.mimeType : "application/octet-stream";
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(att.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
