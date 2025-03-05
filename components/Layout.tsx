// components/Layout.tsx
import React, { ReactNode } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Recomendador de Filtros' }) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Encuentra el filtro perfecto para tu acuario" />
        <link rel="icon" href="/favicon.ico" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="flex flex-col min-h-screen bg-background-light text-text-color">
        {/* Barra de Navegación */}
        <nav className="bg-primary-dark text-white py-4 shadow-lg">
          <div className="container mx-auto flex items-center justify-between px-4">
            <Link href="/" className="text-xl font-bold hover:text-accent transition-colors duration-200">
              Recomendador de Filtros
            </Link>
            <div className="space-x-4">
              <Link href="/about" className="hover:text-accent transition-colors duration-200">
                Acerca de
              </Link>
              <Link href="/contact" className="hover:text-accent transition-colors duration-200">
                Contacto
              </Link>
            </div>
          </div>
        </nav>

        {/* Cabecera */}
        <header className="relative bg-cover bg-center py-20 md:py-32">
          <Image
            src="/images/acuario-fondo.jpg"
            alt="Acuario"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="relative container mx-auto text-center text-white z-10 px-4">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Encuentra el Filtro Perfecto para tu Acuario
            </h1>
            <p className="text-lg md:text-xl">
              Descubre el filtro ideal para mantener tu acuario limpio y saludable.
            </p>
          </div>
        </header>

        {/* Contenido Principal */}
        <main className="flex-grow container mx-auto py-8 px-4">
          {children}
        </main>

        {/* Pie de Página */}
        <footer className="bg-primary-dark text-white py-6 mt-12 shadow-lg">
          <div className="container mx-auto text-center px-4">
            <p>&copy; {new Date().getFullYear()} Recomendador de Filtros. Todos los derechos reservados.</p>
            <div className="mt-2 flex justify-center space-x-4">
              <a href="#" className="hover:text-accent transition-colors duration-200">
                Términos y Condiciones
              </a>
              <a href="#" className="hover:text-accent transition-colors duration-200">
                Política de Privacidad
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Layout;