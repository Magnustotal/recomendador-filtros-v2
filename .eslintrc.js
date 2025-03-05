module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true, // Añade esto si vas a usar Jest para testing
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:tailwindcss/recommended", // Para Tailwind CSS
    "next/core-web-vitals", // Recomendado por Next.js
    "prettier", // Desactiva reglas que puedan entrar en conflicto con Prettier
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
    project: "./tsconfig.json", // Apunta a tu archivo tsconfig.json
  },
  plugins: ["@typescript-eslint", "react", "react-hooks", "tailwindcss"],
  rules: {
    // Reglas específicas (puedes personalizarlas)
    "react/react-in-jsx-scope": "off", // No es necesario con Next.js 17+
    "react/prop-types": "off", // No es necesario con TypeScript
    "@typescript-eslint/explicit-module-boundary-types": "off", // Puede ser muy estricto
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ], // Ignora variables que empiezan con _
    "no-console": "warn", // Advierte sobre el uso de console.log
    "tailwindcss/no-custom-classname": "off", // Deshabilita si usas nombres de clase personalizados
    "react-hooks/exhaustive-deps":"warn", // Comprueba las dependencias de los hooks

  },
  settings: {
    react: {
      version: "detect", // Detecta automáticamente la versión de React
    },
    tailwindcss: {
      // Opciones de configuración para el plugin de Tailwind (opcional)
      callees: ["cn"], // Si usas una función como `cn` para concatenar clases
      config: "tailwind.config.js", // Ruta a tu archivo de configuración de Tailwind
    },
  },
  ignorePatterns: ["node_modules/", ".next/", "out/"], // Ignora estas carpetas
};