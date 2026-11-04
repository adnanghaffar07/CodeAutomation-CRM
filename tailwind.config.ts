import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    // Corner radii (Design v2, 9/23/26). Every utility reads a CSS variable
    // set in src/app/globals.css, so the whole app's rounding is dialled in
    // ONE place. Default = Mitch's "Subtle rounding"; html[data-shape] offers
    // "soft" and "square" presets. Top level (NOT `extend`) so it replaces
    // the framework scale outright.
    borderRadius: {
      none: "0px",
      xs: "var(--radius-xs)",
      sm: "var(--radius-sm)",
      DEFAULT: "var(--radius-control)",
      md: "var(--radius-control)",
      control: "var(--radius-control)",
      lg: "var(--radius-card)",
      card: "var(--radius-card)",
      xl: "var(--radius-overlay)",
      overlay: "var(--radius-overlay)",
      "2xl": "var(--radius-sheet)",
      "3xl": "var(--radius-sheet)",
      sheet: "var(--radius-sheet)",
      full: "var(--radius-pill)",
      pill: "var(--radius-pill)",
      // Concentric inner radii: child = parent − parent's inset.
      "control-inner": "max(calc(var(--radius-control) - 2px), 0px)",
      "card-inner": "max(calc(var(--radius-card) - 4px), 0px)",
      "overlay-inner": "max(calc(var(--radius-overlay) - 6px), 0px)",
    },
    // Density-aware named type roles (Mitch, 9/23/26: "Comfort or Compact
    // ... shouldnt need to refresh"). Every size is a CSS variable switched
    // by html[data-density] — see globals.css. Legacy keys (nano, micro,
    // mini, caption, body, callout, lead, xs…xl) are KEPT so every migrated
    // usage keeps working; they now resolve onto the role values, with an
    // 11px floor.
    fontSize: {
      caption2: ["var(--fs-caption2)", { lineHeight: "var(--lh-caption2)", letterSpacing: "0.01em", fontWeight: "500" }],
      caption: ["var(--fs-caption)", { lineHeight: "var(--lh-caption)" }],
      footnote: ["var(--fs-footnote)", { lineHeight: "var(--lh-footnote)", letterSpacing: "-0.006em" }],
      body: ["var(--fs-body)", { lineHeight: "var(--lh-body)", letterSpacing: "-0.011em" }],
      callout: ["var(--fs-callout)", { lineHeight: "var(--lh-callout)", letterSpacing: "-0.014em" }],
      headline: ["var(--fs-headline)", { lineHeight: "var(--lh-headline)", letterSpacing: "-0.014em", fontWeight: "600" }],
      title3: ["var(--fs-title3)", { lineHeight: "var(--lh-title3)", letterSpacing: "-0.02em", fontWeight: "600" }],
      title2: ["var(--fs-title2)", { lineHeight: "var(--lh-title2)", letterSpacing: "-0.018em", fontWeight: "600" }],
      title1: ["var(--fs-title1)", { lineHeight: "var(--lh-title1)", letterSpacing: "-0.015em", fontWeight: "700" }],
      "large-title": ["var(--fs-large)", { lineHeight: "var(--lh-large)", letterSpacing: "-0.018em", fontWeight: "700" }],
      kpi: ["var(--fs-kpi)", { lineHeight: "var(--lh-kpi)", letterSpacing: "-0.02em", fontWeight: "600" }],
      // legacy (unchanged names, new values)
      nano: ["var(--fs-nano)", { lineHeight: "var(--lh-caption2)" }],
      micro: ["var(--fs-micro)", { lineHeight: "var(--lh-caption)" }],
      mini: ["var(--fs-mini)", { lineHeight: "var(--lh-caption)" }],
      lead: ["var(--fs-lead)", { lineHeight: "var(--lh-callout)" }],
      xs: ["var(--fs-caption)", { lineHeight: "var(--lh-caption)" }],
      sm: ["var(--fs-body)", { lineHeight: "var(--lh-body)" }],
      base: ["var(--fs-base)", { lineHeight: "var(--lh-callout)" }],
      lg: ["var(--fs-lg)", { lineHeight: "var(--lh-title3)" }],
      xl: ["var(--fs-xl)", { lineHeight: "var(--lh-title2)" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
      "5xl": ["3rem", { lineHeight: "1" }],
      "6xl": ["3.75rem", { lineHeight: "1" }],
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        field: "hsl(var(--field))",
        tertiary: "hsl(var(--tertiary-foreground))",
        "fill-strong": "hsl(var(--fill-strong))",
        // Opaque table header band (sticky-safe; globals.css --table-head).
        "table-head": "hsl(var(--table-head))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        // BayfordBridge brand blue + its derived shades. Prefer these
        // (bg-brand for fills, text-brand-text for words and icons) over a
        // hex literal so the palette has one place to change.
        brand: {
          DEFAULT: "hsl(var(--brand))",
          dark: "hsl(var(--brand-dark))",
          hover: "hsl(var(--brand-hover))",
          soft: "hsl(var(--brand-soft))",
          bright: "hsl(var(--brand-bright))",
          pressed: "hsl(var(--brand-pressed))",
          text: "hsl(var(--brand-text))",
          tint: "hsl(var(--brand-tint))",
        },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          solid: "hsl(var(--destructive-solid))",
          tint: "hsl(var(--destructive-tint))",
        },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          tint: "hsl(var(--success-tint))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          tint: "hsl(var(--warning-tint))",
        },
        // Line theming (SHELL, CONTRACTS UI rules): html[data-line] sets these
        // in globals.css. bg-line-accent for fills (text-line-accent-foreground
        // on top), text-line-accent for words/icons on the page background,
        // bg-line-accent-tint for soft fills.
        "line-accent": {
          DEFAULT: "hsl(var(--line-accent))",
          foreground: "hsl(var(--line-accent-foreground))",
          text: "hsl(var(--line-accent-text))",
          tint: "hsl(var(--line-accent-tint))",
        },
        "line-secondary": "hsl(var(--line-secondary))",
      },
      opacity: { 4: ".04", 6: ".06", 8: ".08", 12: ".12", 16: ".16" },
      fontFamily: {
        // System SF first (Apple), then Inter via next/font (Windows), then
        // Roboto as Android's native fallback. `serif` is the same stack so
        // any leftover `font-serif` on legacy components stays consistent.
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', "var(--font-inter)", '"Segoe UI Variable Text"', '"Segoe UI"', "Roboto", "system-ui", "sans-serif"],
        serif: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', "var(--font-inter)", '"Segoe UI Variable Text"', '"Segoe UI"', "Roboto", "system-ui", "sans-serif"],
        // Mono ONLY for phone numbers, parcel IDs and code.
        mono: ["ui-monospace", '"SF Mono"', '"JetBrains Mono"', "Menlo", "monospace"],
      },
      boxShadow: {
        e1: "var(--shadow-e1)",
        e2: "var(--shadow-e2)",
        e3: "var(--shadow-e3)",
        e4: "var(--shadow-e4)",
      },
      transitionDuration: {
        instant: "100ms",
        fast: "150ms",
        base: "200ms",
        moderate: "300ms",
        slow: "450ms",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        enter: "var(--ease-enter)",
        exit: "var(--ease-exit)",
        sheet: "var(--ease-sheet)",
        spring: "var(--ease-spring)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "pulse-soft": { "0%,100%": { opacity: "1" }, "50%": { opacity: ".55" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        // One-shot entrance: fade + 4px rise. No fill-forwards, so the
        // element keeps no transform once it has landed.
        "fade-up": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
        "pulse-soft": "pulse-soft 1.6s var(--ease-standard) infinite",
        "fade-in": "fade-in 150ms var(--ease-standard) backwards",
        "fade-up": "fade-up 220ms var(--ease-enter) backwards",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [animate],
};
export default config;
