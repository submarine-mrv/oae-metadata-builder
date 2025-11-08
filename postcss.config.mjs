// In test environment, skip PostCSS processing to avoid Tailwind plugin issues
const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

const config = {
  plugins: isTest ? [] : ["@tailwindcss/postcss"]
};

export default config;
