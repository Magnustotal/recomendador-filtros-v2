import React from "react";
import type { Metadata, Viewport } from "next";
import { Box } from "@mui/material";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import ThemeRegistry from './ThemeRegistry';
import Header from "./components/Header";
import Footer from "./components/Footer";
import RegisterServiceWorker from "./components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "Recomendador de Filtros para Acuarios",
  description: "Calcula el mejor filtro para tu acuario. Herramienta 100% gratuita, moderna y sin necesidad de registro.",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Filtros",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2A81F7" },
    { media: "(prefers-color-scheme: dark)", color: "#121826" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="data" defaultMode="system" />
        <ThemeRegistry>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: "100dvh",
            }}
          >
            <Header />
            <Box
              component="main"
              sx={{
                flex: 1,
                width: "100%",
                maxWidth: "1100px",
                mx: "auto",
                py: { xs: 2, md: 4 },
                px: { xs: 2, md: 4 },
              }}
            >
              {children}
            </Box>
            <Footer />
          </Box>
        </ThemeRegistry>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
