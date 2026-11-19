import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { RegisterSW } from "@/components/app/RegisterSW";

export const metadata: Metadata = {
  title: { default: "TIMControl", template: "%s · TIMControl" },
  description: "Kanban de atividades do time de Dev Ops.",
  applicationName: "TIMControl",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "TIMControl", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1E0B4B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
