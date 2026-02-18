import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bnb-yellow": "#F0B90B",
        "bnb-gold": "#FCD535",
        surface: "#1a1a2e",
      },
    },
  },
  plugins: [],
};
export default config;
