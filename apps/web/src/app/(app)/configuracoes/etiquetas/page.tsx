import { listLabels } from "@timcontrol/pg";
import { Card, PageHeader } from "@/components/ui/Card";
import { CreateLabelForm, EditLabelForm } from "@/components/forms/LabelForms";
import { asActor } from "@/server/actor";
import { requireAdmin } from "@/server/guard";

export const metadata = { title: "Etiquetas" };

export default async function LabelsPage() {
  const actor = await requireAdmin("admin.projects");
  const labels = await asActor(actor, (tx) => listLabels(tx));
  return (
    <>
      <PageHeader title="Etiquetas" subtitle="Valem para todos os projetos. Excluir uma etiqueta tira ela dos cards, sem apagar os cards." />
      <div className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_400px]">
        <ul className="flex flex-col gap-3">
          {labels.map((l) => (
            <li key={l.id}>
              <Card className="p-4">
                <details>
                  <summary className="flex min-h-touch cursor-pointer list-none items-center gap-3">
                    <span className="rounded-sm px-2 py-1 text-sm font-semibold" style={{ color: l.color, backgroundColor: `${l.color}1A` }}>
                      {l.name}
                    </span>
                  </summary>
                  <div className="mt-4 border-t border-bd pt-4">
                    <EditLabelForm l={l} />
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ul>
        <Card className="self-start">
          <h2 className="mb-4 text-lg font-bold">Nova etiqueta</h2>
          <CreateLabelForm />
        </Card>
      </div>
    </>
  );
}
