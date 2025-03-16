import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import eslintPlugin from "@typescript-eslint/eslint-plugin";
import next from "@next/eslint-plugin-next";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": eslintPlugin,
      "next": next,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn", // Comprueba las dependencias de los hooks
    },
  },
  {
    ignores: ["dist/", "node_modules/", ".next/"],
  },
];