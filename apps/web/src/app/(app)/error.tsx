"use client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="max-w-lg">
      <h1 className="text-lg font-bold">Algo deu errado</h1>
      <p className="mt-2 text-ink2">Não conseguimos carregar esta tela. Tente de novo; se continuar, avise o Gestor.</p>
      <Button className="mt-4" onClick={reset}>
        Tentar de novo
      </Button>
    </Card>
  );
}
