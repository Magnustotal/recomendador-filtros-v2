// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeSelector from "@/components/ThemeSelector"; // Importamos el selector

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

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
    <html lang="es" >
      <body
        className={`${inter.variable} font-sans bg-gray-100 dark:bg-gray-900 dark:text-gray-300 transition-colors duration-300`}
      >
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow px-4 py-8 md:px-8 md:py-12">
            {children}
          </main>
          <footer className="py-4 text-center text-gray-500 dark:text-gray-400 text-sm border-t border-gray-200 dark:border-gray-700">
            <p>
              &copy; {new Date().getFullYear()} Javier B. V. - Todos los
              derechos reservados.
            </p>
            <ThemeSelector />
          </footer>
        </div>
      </body>
    </html>
  );
}