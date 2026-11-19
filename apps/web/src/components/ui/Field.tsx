"use client";
import { useId } from "react";
import { cx } from "./cx";

const control = "w-full min-h-touch rounded-md border border-bd bg-sf px-3 text-[15px] text-ink placeholder:text-ink3 focus:border-br focus:outline-none";

export function Field({ label, hint, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink2">
        {label}
      </label>
      <input id={id} {...props} className={control} />
      {hint && <p className="text-xs text-ink3">{hint}</p>}
    </div>
  );
}

export function Select({ label, className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink2">
        {label}
      </label>
      <select id={id} {...props} className={control}>
        {children}
      </select>
    </div>
  );
}

export function Check({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cx("flex min-h-touch cursor-pointer items-center gap-3 text-[15px] text-ink", className)}>
      <input type="checkbox" {...props} className="h-5 w-5 accent-[var(--br)]" />
      <span>{label}</span>
    </label>
  );
}
