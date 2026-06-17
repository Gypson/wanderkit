import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/supabase/src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#16202a",
        moss: "#2d6a4f",
        clay: "#c8553d",
        skywash: "#eaf4f4",
        paper: "#fbfaf7"
      }
    }
  },
  plugins: []
};

export default config;
