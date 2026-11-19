import { cx } from "./cx";

export function Notice({ tone, children }: { tone: "ok" | "error" | "info"; children: React.ReactNode }) {
  const c = tone === "ok" ? "bg-ok-bg text-ok" : tone === "error" ? "bg-danger-bg text-danger" : "bg-info-bg text-info";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cx("rounded-md px-4 py-3 text-sm font-medium", c)}>
      {children}
    </p>
  );
}
