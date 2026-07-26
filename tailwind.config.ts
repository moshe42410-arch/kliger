import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      xs: "375px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "1920px",
    },
    extend: {
      colors: {
        /* Masiim palette */
        cream: {
          50: "#FDFCF7",
          100: "#FCFBF4",
          200: "#F8F5E8",
          300: "#F1EBD5",
          400: "#E6DBB6",
          500: "#D6C58C",
        },
        navy: {
          50: "#f3f6fc",
          100: "#e0e8f5",
          200: "#c2d2e9",
          300: "#9ab1d4",
          400: "#6f8ec0",
          500: "#4a6ea8",
          600: "#365488",
          700: "#27416b",
          800: "#1b3054",
          900: "#132442",
          950: "#002147" /* masiim navy */,
        },
        gold: {
          50: "#fbf7ea",
          100: "#f5ecc6",
          200: "#ecd888",
          300: "#e2be4a",
          400: "#D4AF37" /* masiim gold */,
          500: "#c0891a",
          600: "#9e6615",
          700: "#7e4b16",
          800: "#683d18",
          900: "#58331a",
        },
        teal: {
          50: "#f0fbf9",
          100: "#d3f5ee",
          200: "#a7ebde",
          300: "#71d9c8",
          400: "#3fbfaf",
          500: "#369989" /* masiim teal */,
          600: "#2a7a6f",
          700: "#265f58",
          800: "#224b47",
          900: "#1e3e3b",
        },
      },
      fontFamily: {
        sans: ["Rubik", "system-ui", "sans-serif"],
        heading: ["Bellefair", "Rubik", "serif"],
        display: ["Bellefair", "Rubik", "serif"],
        brand: ["'Cormorant Garamond'", "Bellefair", "serif"],
      },
      fontSize: {
        "fluid-xs": "clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)",
        "fluid-sm": "clamp(0.875rem, 0.8rem + 0.3vw, 1rem)",
        "fluid-base": "clamp(1rem, 0.9rem + 0.4vw, 1.125rem)",
        "fluid-lg": "clamp(1.125rem, 1rem + 0.5vw, 1.375rem)",
        "fluid-xl": "clamp(1.25rem, 1.05rem + 0.75vw, 1.75rem)",
        "fluid-2xl": "clamp(1.5rem, 1.2rem + 1vw, 2.25rem)",
        "fluid-3xl": "clamp(1.875rem, 1.4rem + 1.5vw, 3rem)",
        "fluid-4xl": "clamp(2.25rem, 1.6rem + 2vw, 3.75rem)",
        "fluid-hero": "clamp(2.5rem, 1.6rem + 2.8vw, 4.5rem)",
      },
      boxShadow: {
        "gold-glow": "0 0 25px rgba(217,168,37,0.25)",
        "gold-glow-lg": "0 0 40px rgba(217,168,37,0.45)",
        luxe: "0 10px 40px -10px rgba(0,0,0,0.5)",
        soft: "0 4px 20px -4px rgba(12,26,51,0.35)",
        "soft-lg": "0 10px 40px -10px rgba(12,26,51,0.55)",
        "soft-xl": "0 20px 60px -15px rgba(12,26,51,0.65)",
        "inner-gold":
          "inset 0 1px 0 rgba(245,236,198,0.15), inset 0 -1px 0 rgba(0,0,0,0.25)",
      },
      backgroundImage: {
        "gold-gradient":
          "linear-gradient(135deg, #d9a825 0%, #f5ecc6 50%, #9e6615 100%)",
        "gold-shimmer":
          "linear-gradient(120deg, #d9a825 0%, #fef3c7 25%, #f5ecc6 50%, #d9a825 75%, #9e6615 100%)",
        "navy-gradient":
          "linear-gradient(135deg, #0c1a33 0%, #1b3054 50%, #27416b 100%)",
        "surface-gradient":
          "linear-gradient(145deg, rgba(39,65,107,0.72) 0%, rgba(19,36,66,0.7) 100%)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.4, 0, 0.2, 1)",
        "premium-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "premium-in": "cubic-bezier(0.7, 0, 0.84, 0)",
        bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "fade-in-up": "fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-down": "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulseSlow 3s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "count-up": "countUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        "blob-drift": "blobDrift 20s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.94)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.03)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        countUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blobDrift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(20px, -25px) scale(1.05)" },
          "66%": { transform: "translate(-15px, 20px) scale(0.98)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
