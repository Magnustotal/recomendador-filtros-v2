import React from "react";
import type { Metadata } from "next";
import { Box } from "@mui/material";
import ThemeRegistry from './ThemeRegistry';
import Header from "./components/Header";
import Footer from "./components/Footer";

// La metadata no cambia
export const metadata: Metadata = {
  title: "Recomendador de Filtros para Acuarios",
  description: "Calcula el mejor filtro para tu acuario. Herramienta 100% gratuita, moderna y sin necesidad de registro.",
  themeColor: "#2A81F7",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <ThemeRegistry>
          {/* Ya no necesitamos el <GlobalStyles/> aquí, ThemeRegistry lo gestiona */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
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
      </body>
    </html>
  );
}