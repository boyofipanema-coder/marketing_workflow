import type { Config } from "tailwindcss";

/**
 * Apple-style design system → Tailwind.
 *
 * Colors resolve from CSS variables defined in src/styles/globals.css, stored
 * as space-separated RGB channels so opacity modifiers work everywhere:
 *   bg-surface  text-secondary  border-separator  bg-accent/10  ring-accent/40
 *
 * Prefer these semantic utilities over raw palette values. The raw `gray-*`
 * ramp is exposed for the rare case a component needs a specific step.
 */

// rgb(var(--x) / <alpha-value>) — lets Tailwind apply /opacity modifiers.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // lib holds Tailwind class strings (status.ts colors, derive helpers) —
    // must be scanned or those utilities never generate.
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic surfaces
        bg: v("bg"),
        surface: {
          DEFAULT: v("surface"),
          2: v("surface-2"),
          3: v("surface-3"),
        },
        elevated: v("elevated"),

        // Text (use as text-secondary, text-tertiary…)
        text: {
          DEFAULT: v("text"),
          secondary: v("text-secondary"),
          tertiary: v("text-tertiary"),
          quaternary: v("text-quaternary"),
          "on-accent": v("text-on-accent"),
        },

        // Lines
        separator: v("separator"),
        border: {
          DEFAULT: v("border"),
          strong: v("border-strong"),
        },

        // Accent
        accent: {
          DEFAULT: v("accent"),
          hover: v("accent-hover"),
          pressed: v("accent-pressed"),
        },
        ring: v("ring"),

        // Task status
        status: {
          inbox: v("status-inbox"),
          todo: v("status-todo"),
          inprogress: v("status-inprogress"),
          waiting: v("status-waiting"),
          review: v("status-review"),
          done: v("status-done"),
          cancelled: v("status-cancelled"),
        },

        // Attention flags
        flag: {
          blocked: v("flag-blocked"),
          overdue: v("flag-overdue"),
          followup: v("flag-followup"),
          ready: v("flag-ready"),
        },

        // Raw neutral ramp (escape hatch)
        gray: {
          0: v("gray-0"),
          50: v("gray-50"),
          100: v("gray-100"),
          150: v("gray-150"),
          200: v("gray-200"),
          300: v("gray-300"),
          400: v("gray-400"),
          500: v("gray-500"),
          600: v("gray-600"),
          700: v("gray-700"),
          800: v("gray-800"),
          900: v("gray-900"),
          950: v("gray-950"),
        },
      },

      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },

      /**
       * Type scale — Apple discipline: tracking is size-specific (tighten as
       * text grows), leading tracks size inversely. [size, {lineHeight, ls}].
       */
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }],   // 11 — micro labels
        xs: ["0.75rem", { lineHeight: "1.1rem", letterSpacing: "0.005em" }],     // 12 — metadata
        sm: ["0.8125rem", { lineHeight: "1.25rem", letterSpacing: "0" }],        // 13 — secondary
        base: ["0.9375rem", { lineHeight: "1.5rem", letterSpacing: "-0.006em" }],// 15 — body (Apple base)
        lg: ["1.0625rem", { lineHeight: "1.6rem", letterSpacing: "-0.012em" }],  // 17 — emphasized body
        xl: ["1.25rem", { lineHeight: "1.7rem", letterSpacing: "-0.018em" }],    // 20 — section titles
        "2xl": ["1.5rem", { lineHeight: "1.85rem", letterSpacing: "-0.022em" }], // 24 — page titles
        "3xl": ["1.9375rem", { lineHeight: "2.25rem", letterSpacing: "-0.026em" }], // 31
        "4xl": ["2.5rem", { lineHeight: "2.7rem", letterSpacing: "-0.03em" }],   // 40 — display
        "5xl": ["3.25rem", { lineHeight: "3.4rem", letterSpacing: "-0.033em" }], // 52 — hero
      },

      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },

      backdropBlur: {
        material: "var(--material-blur)",
        "material-strong": "var(--material-blur-strong)",
      },

      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },

      transitionDuration: {
        fast: "140ms",
        base: "240ms",
        slow: "400ms",
      },

      spacing: {
        // 8pt-grid friendly extras
        4.5: "1.125rem",
        13: "3.25rem",
        15: "3.75rem",
        18: "4.5rem",
      },

      // Soft-tint opacity steps the status/flag fills rely on. These aren't in
      // Tailwind's default opacity scale, so `bg-status-todo/12` silently fails
      // to generate without them. Registering them makes every /8../18 tint work.
      opacity: {
        8: "0.08",
        12: "0.12",
        15: "0.15",
        18: "0.18",
      },

      keyframes: {
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(16px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "reveal-up": "reveal-up 0.4s var(--ease-out) both",
        "fade-in": "fade-in 0.24s var(--ease-out) both",
        "scale-in": "scale-in 0.24s var(--ease-out) both",
        "sheet-up": "sheet-up 0.4s var(--ease-out) both",
        "slide-in-right": "slide-in-right 0.28s var(--ease-out) both",
      },
    },
  },
  plugins: [],
};

export default config;
