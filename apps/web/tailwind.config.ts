import type { Config } from "tailwindcss";

const v = (name: string) => `var(--${name})`;

/** Tokens de design/design.md (a partir do modelo.webp). Os valores vivem em src/styles/globals.css. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "640px", desk: "960px", wide: "1280px" },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#FFFFFF",
      bg: v("bg"),
      sf: v("sf"),
      sf2: v("sf2"),
      bd: v("bd"),
      ink: v("ink"),
      ink2: v("ink2"),
      ink3: v("ink3"),
      br: { DEFAULT: v("br"), 2: v("br2"), soft: v("br-soft") },
      side: { DEFAULT: v("side"), ink: v("side-ink"), act: v("side-act") },
      ok: { DEFAULT: v("ok"), bg: v("ok-bg") },
      warn: { DEFAULT: v("warn"), bg: v("warn-bg") },
      danger: { DEFAULT: v("danger"), bg: v("danger-bg") },
      info: { DEFAULT: v("info"), bg: v("info-bg") },
    },
    borderRadius: { none: "0", sm: "8px", DEFAULT: "12px", md: "14px", lg: "20px", xl: "28px", pill: "999px", full: "9999px" },
    boxShadow: {
      sm: "0 1px 2px rgba(30,11,75,.06)",
      md: "0 6px 24px rgba(30,11,75,.08)",
      lg: "0 18px 48px rgba(30,11,75,.16)",
      none: "none",
    },
    fontFamily: {
      sans: ["'Plus Jakarta Sans Variable'", "system-ui", "sans-serif"],
      mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
    },
    extend: {
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
    },
  },
  plugins: [],
};

export default config;
