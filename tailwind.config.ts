import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // ألوان إضافية للحالات
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // ألوان جديدة - أزرق وأخضر
        ocean: {
          DEFAULT: "hsl(var(--ocean))",
          foreground: "hsl(var(--ocean-foreground))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal))",
          foreground: "hsl(var(--teal-foreground))",
        },
        emerald: {
          DEFAULT: "hsl(var(--emerald))",
          foreground: "hsl(var(--emerald-foreground))",
        },
        sky: {
          DEFAULT: "hsl(var(--sky))",
          foreground: "hsl(var(--sky-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Inter', 'system-ui', 'sans-serif'],
        display: ['IBM Plex Sans Arabic', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-down": {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-blue": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(210 85% 50% / 0.3)" },
          "50%": { boxShadow: "0 0 35px hsl(210 85% 50% / 0.5)" },
        },
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(155 60% 45% / 0.3)" },
          "50%": { boxShadow: "0 0 35px hsl(155 60% 45% / 0.5)" },
        },
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(45 85% 50% / 0.3)" },
          "50%": { boxShadow: "0 0 30px hsl(45 85% 50% / 0.5)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "fade-in-down": "fade-in-down 0.5s ease-out",
        "slide-in-right": "slide-in-right 0.5s ease-out",
        "slide-in-left": "slide-in-left 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "pulse-blue": "pulse-blue 2s ease-in-out infinite",
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "pulse-gold": "pulse-gold 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-gold": "linear-gradient(135deg, hsl(45, 85%, 55%) 0%, hsl(38, 90%, 45%) 100%)",
        "gradient-dark": "linear-gradient(135deg, hsl(215, 55%, 20%) 0%, hsl(155, 50%, 25%) 100%)",
        "gradient-hero": "linear-gradient(135deg, hsl(215, 55%, 12%) 0%, hsl(200, 50%, 18%) 50%, hsl(155, 50%, 15%) 100%)",
        "gradient-blue": "linear-gradient(135deg, hsl(210, 85%, 50%) 0%, hsl(200, 80%, 45%) 100%)",
        "gradient-green": "linear-gradient(135deg, hsl(155, 60%, 40%) 0%, hsl(175, 65%, 35%) 100%)",
        "gradient-ocean": "linear-gradient(135deg, hsl(200, 75%, 45%) 0%, hsl(175, 65%, 40%) 100%)",
        "gradient-teal": "linear-gradient(135deg, hsl(175, 65%, 40%) 0%, hsl(155, 60%, 45%) 100%)",
        "gradient-sky": "linear-gradient(135deg, hsl(195, 85%, 55%) 0%, hsl(210, 80%, 50%) 100%)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        "gold": "0 4px 20px -2px hsl(45 85% 50% / 0.25)",
        "blue": "0 4px 25px -4px hsl(210 85% 50% / 0.3)",
        "green": "0 4px 25px -4px hsl(155 60% 40% / 0.3)",
        "ocean": "0 4px 30px -5px hsl(200 75% 45% / 0.35)",
        "elegant": "0 4px 30px -5px hsl(215 35% 10% / 0.15)",
        "card-hover": "0 10px 40px -10px hsl(215 35% 10% / 0.2)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;