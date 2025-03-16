@ -1,36 +0,0 @@
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

export const metadata: Metadata = {
  title: "Recomendador de Filtros",
  description: "Encuentra el filtro perfecto para tu acuario",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="Encuentra el filtro perfecto para tu acuario" />
        <meta name="keywords" content="acuario, filtro, peces, acuariofilia, mantenimiento" />
        <meta name="author" content="Tu Nombre" />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}