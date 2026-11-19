import { markNotificationsRead } from "@timcontrol/pg";
import { asActor, currentActor } from "@/server/actor";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Redireciona com caminho relativo: atrás do proxy do EasyPanel o host interno não vaza para o navegador. */
const go = (path: string) => new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });

/** Abrir uma notificação: marca como lida e leva ao card (o RLS só acha avisos da própria pessoa). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return go("/login");
  const { id } = await params;
  const cardId = UUID.test(id)
    ? await asActor(actor, async (tx) => {
        const card = await markNotificationsRead(tx, actor.user.id, { id });
        // Os outros avisos do mesmo card também ficam lidos: a pessoa vai vê-lo agora.
        if (card) await markNotificationsRead(tx, actor.user.id, { cardId: card });
        return card;
      })
    : null;
  return go(cardId ? `/cards/${cardId}` : "/notificacoes");
}
