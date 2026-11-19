import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/Card";
import { requireActor } from "@/server/actor";
import { adminSectionsFor } from "@/lib/admin";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const sections = adminSectionsFor(actor.viewer);
  if (sections.length === 0) redirect("/");
  return (
    <>
      <PageHeader title="Configurações" />
      <ul className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block">
              <Card className="flex items-center justify-between gap-4 transition-shadow hover:shadow-lg">
                <div>
                  <h2 className="font-bold">{s.title}</h2>
                  <p className="text-sm text-ink3">{s.text}</p>
                </div>
                <ChevronRight className="shrink-0 text-ink3" aria-hidden />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
