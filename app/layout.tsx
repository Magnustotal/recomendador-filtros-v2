import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Recomendador de Filtros para Acuarios',
  description: 'Encuentra el filtro perfecto para tu acuario de agua dulce',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-inter bg-background-light text-text-color">
        {children}
      </body>
    </html>
  );
}