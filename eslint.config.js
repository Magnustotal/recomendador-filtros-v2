import js from "@eslint/js";
import ts from "typescript-eslint";
import tailwindcss from "eslint-plugin-tailwindcss";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...react.configs.recommended,
  reactHooks.configs.recommended,
 ...next.configs.recommended(),
  tailwindcss.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"], // Aplica estas reglas a archivos TypeScript y TSX
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json", // Asegúrate de que la ruta es correcta
      },
      globals: { // Define aquí variables globales si las necesitas
        // Por ejemplo:
        // MyGlobalVariable: "readonly",
      },
    },
    plugins: {
      // "@typescript-eslint": ts, // Ya se está usando con ...ts.configs.recommended
      react,
      "react-hooks": reactHooks,
      tailwindcss,
    },
    rules: {
      // Tus reglas personalizadas aquí
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "warn",
      "tailwindcss/no-custom-classname": "off",
        "react-hooks/exhaustive-deps":"warn", // Comprueba las dependencias de los hooks
    },
    settings: {
      react: {
        version: "detect",
      },
      tailwindcss: {
        callees: ["cn"],
        config: "tailwind.config.js",
      },
    },
  },
  {
    ignores: ["node_modules/", ".next/", "out/"], // Ignora estas carpetas
  },
];