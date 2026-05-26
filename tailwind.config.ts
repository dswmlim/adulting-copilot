import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#06231a",
        forest: "#0b3d2e",
        moss: "#0e4a37",
        gold: "#f4c95d",
        amber: "#e8a13a",
        mist: "#9bbfae",
        cream: "#f5f1e6",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "serif"],
        body: ["ui-sans-serif", "system-ui", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
