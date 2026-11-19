import { AppShell } from "@/components/app/AppShell";
import { unreadCount } from "@timcontrol/pg";
import { asActor, requireActor } from "@/server/actor";
import { adminSectionsFor } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const unread = await asActor(actor, (tx) => unreadCount(tx, actor.user.id));
  return (
    <AppShell userName={actor.user.name} profileName={actor.viewer.globalProfile.name} showAdmin={adminSectionsFor(actor.viewer).length > 0} unread={unread}>
      {children}
    </AppShell>
  );
}
