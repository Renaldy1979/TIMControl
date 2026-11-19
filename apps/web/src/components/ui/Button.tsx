import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-br text-white hover:bg-br-2 shadow-sm",
  secondary: "bg-sf text-ink border border-bd hover:bg-sf2",
  ghost: "text-ink2 hover:bg-sf2",
  danger: "bg-danger-bg text-danger hover:bg-danger hover:text-white",
};

export function buttonClass(variant: Variant = "primary", extra?: string): string {
  return cx(
    "inline-flex min-h-touch items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    styles[variant],
    extra,
  );
}

export function Button({ variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={buttonClass(variant, className)} />;
}
