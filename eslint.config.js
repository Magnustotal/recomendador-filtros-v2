// eslint.config.js
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tailwindPlugin from "eslint-plugin-tailwindcss";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"], // Aplica a todos los archivos JS y TS
    ignores: ["node_modules/", ".next/", "out/", "dist/"], // Ignora estas carpetas
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json", // Ruta a tu tsconfig.json
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
      globals: {
        // Define globales aquí si las necesitas (ej: NodeJS, browser)
        NodeJS: "readonly",
        React: "readonly"
      },
    },
     plugins: {
      "@typescript-eslint": tsPlugin,
      tailwindcss: tailwindPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
       next: nextPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs["recommended-type-checked"].rules, // Usar si quieres reglas más estrictas, basadas en el tipado
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
        ...nextPlugin.configs.recommended.rules,
      "tailwindcss/no-custom-classname": "off", // Desactiva si usas clases personalizadas
      "react/react-in-jsx-scope": "off", // No es necesario en Next.js
      "react/prop-types": "off", // No es necesario con TypeScript
        "@typescript-eslint/explicit-module-boundary-types": "off", // Desactivar si es demasiado restrictivo
       "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "warn", // Permitir console.log, pero mostrar advertencia
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];