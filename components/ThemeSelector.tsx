// components/ThemeSelector.tsx
"use client";
import { useState, useEffect } from 'react';

const ThemeSelector = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  useEffect(() => {
    // 1. Obtener el tema del localStorage
    const localTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;

    if (localTheme) {
      setTheme(localTheme); // Usar el tema guardado, si existe
    } else {
      // Si no hay tema guardado, usar el del sistema
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(isDark ? 'dark' : 'light');
    }
  }, []);


  useEffect(() => {
    const html = document.documentElement;

    if (theme === 'system') {
      localStorage.removeItem('theme'); // Borra la preferencia si es 'system'
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      localStorage.setItem('theme', 'dark');
      html.classList.add('dark');
    } else {
      localStorage.setItem('theme', 'light');
      html.classList.remove('dark');
    }
  }, [theme]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(event.target.value as 'light' | 'dark' | 'system');
  };

  return (
    <div className="mt-4">
      <label htmlFor="theme-select" className="mr-2 text-gray-700 dark:text-gray-300">
        Tema:
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={handleChange}
        className="border rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
      >
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
        <option value="system">Sistema</option>
      </select>
    </div>
  );
};

export default ThemeSelector;