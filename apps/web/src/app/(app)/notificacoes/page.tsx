import { formatDateTimeBR } from "@timcontrol/domain";
import { listNotifications, type NotificationView } from "@timcontrol/pg";
import { STATUS_LABELS, type CardStatus } from "@timcontrol/shared";
import { Card, PageHeader } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { asActor, requireActor } from "@/server/actor";
import { markAllReadAction } from "@/server/actions/collab";
import { cx } from "@/components/ui/cx";

export const metadata = { title: "Notificações" };

function describe(n: NotificationView): string {
  const who = n.actorName ?? "Alguém";
  switch (n.kind) {
    case "assigned":
      return `${who} colocou você como responsável`;
    case "mentioned":
      return `${who} mencionou você num comentário`;
    case "commented":
      return `${who} comentou`;
    case "moved": {
      const to = STATUS_LABELS[n.details.to as CardStatus];
      return to ? `${who} moveu para ${to}` : `${who} moveu o card`;
    }
  }
}

export default async function NotificationsPage() {
  const actor = await requireActor();
  const items = await asActor(actor, (tx) => listNotifications(tx, actor.user.id));
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle={unread ? `${unread} não lida${unread > 1 ? "s" : ""}.` : "Tudo lido."}
        action={
          unread > 0 && (
            <form action={markAllReadAction}>
              <button type="submit" className={buttonClass("secondary")}>
                Marcar todas como lidas
              </button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <Card>
          <p className="text-ink3">Nenhuma notificação. Você é avisado quando alguém te coloca como responsável, te menciona, comenta ou move um card seu.</p>
        </Card>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              {/* Navegação completa (não <Link>): o número do sininho no topo é recalculado ao abrir. */}
              <a
                href={`/notificacoes/${n.id}`}
                className={cx("flex flex-col gap-1 rounded-md p-4 shadow-sm ring-1 transition-shadow hover:shadow-md", n.readAt ? "bg-sf ring-bd/50" : "bg-br-soft ring-br/40")}
              >
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  {!n.readAt && <span className="rounded-pill bg-br px-2 py-0.5 font-bold text-white">Nova</span>}
                  <span className="rounded-pill px-2 py-0.5 font-semibold" style={{ color: n.projectColor, backgroundColor: `${n.projectColor}1F` }}>
                    {n.projectName}
                  </span>
                  <time className="text-ink3" dateTime={n.createdAt.toISOString()}>
                    {formatDateTimeBR(n.createdAt)}
                  </time>
                </span>
                <span className="text-ink2">{describe(n)}</span>
                <span className="font-semibold text-ink">{n.cardTitle}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
