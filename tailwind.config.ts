import type { Config } from "tailwindcss";

/**
 * Carbon to Sea Initiative Brand Colors
 * Based on Brand Guidelines - May 2023
 */
const brandColors = {
  hadal: "#162326",
  coral: "#EE5919",
  white: "#FFFFFF",
  shell: "#F6F6F5",
  sand: "#F2EEEB",
  sunlight: "#E8EDEE",
  twilight: "#C1CCCF",
  midnight: "#7C9298",
  abyssal: "#4F656A",
};

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        brand: brandColors,
        // Semantic aliases
        primary: brandColors.hadal,
        accent: brandColors.coral,
        background: brandColors.shell,
        foreground: brandColors.hadal,
        muted: brandColors.twilight,
      },
      fontFamily: {
        display: ['"Newsreader"', "Georgia", '"Times New Roman"', "serif"],
        body: ['"Inter"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      // Extend with brand-specific design tokens if needed
      borderRadius: {
        brand: "0.5rem",
      },
    },
  },
};

export default config;
