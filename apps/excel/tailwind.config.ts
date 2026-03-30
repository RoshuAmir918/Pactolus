import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      colors: {
        background: "hsl(220 33% 98%)",
        foreground: "hsl(222 47% 11%)",
        card: "hsl(0 0% 100%)",
        "card-foreground": "hsl(222 47% 11%)",
        primary: "hsl(221 83% 53%)",
        "primary-foreground": "hsl(0 0% 100%)",
        secondary: "hsl(215 14% 34%)",
        "secondary-foreground": "hsl(0 0% 100%)",
        muted: "hsl(215 16% 47%)",
        "muted-foreground": "hsl(215 16% 47%)",
        border: "hsl(214 32% 91%)",
        destructive: "hsl(0 84% 60%)",
        "destructive-foreground": "hsl(0 0% 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
