import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "TIMControl", template: "%s · TIMControl" },
  description: "Kanban de atividades e solicitações do time de Dev Ops.",
  applicationName: "TIMControl",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#1E0B4B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">{children}</body>
    </html>
  );
}
