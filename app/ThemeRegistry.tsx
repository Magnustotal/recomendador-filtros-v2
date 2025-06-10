"use client";

import React, { useState, useMemo, createContext, useContext, useEffect } from 'react';
import { ThemeProvider, useMediaQuery, CssBaseline, PaletteMode, GlobalStyles } from '@mui/material';
import { getTheme } from './theme';

export const ColorModeContext = createContext({
  toggleColorMode: () => {},
});

const animatedGradientStyles = (
  <GlobalStyles styles={(theme) => ({
    '@keyframes gradient-animation': {
      '0%': { backgroundPosition: '0% 50%' },
      '50%': { backgroundPosition: '100% 50%' },
      '100%': { backgroundPosition: '0% 50%' },
    },
    body: {
      background: theme.palette.mode === 'light'
        ? `linear-gradient(-45deg, ${theme.palette.background.default}, ${theme.palette.primary.light}, ${theme.palette.secondary.light}, #EAF3FC)`
        : `linear-gradient(-45deg, ${theme.palette.background.default}, ${theme.palette.background.paper}, #121826, #1A2233)`,
      backgroundSize: '400% 400%',
      animation: 'gradient-animation 25s ease infinite',
    }
  })} />
);

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<PaletteMode>('light');
  
  // 👇 1. Añadimos un estado para saber si el componente ya se montó en el cliente
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // 👇 2. Cuando se monta, lo ponemos a true
    setIsMounted(true);
  }, []);

  // 👇 3. Actualizamos el modo basándonos en la preferencia del sistema,
  // pero solo DESPUÉS de que el componente se haya montado en el cliente.
  useEffect(() => {
    if (isMounted) {
      setMode(prefersDarkMode ? 'dark' : 'light');
    }
  }, [prefersDarkMode, isMounted]);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  // 👇 4. Para el renderizado inicial (tanto en servidor como en cliente),
  // forzamos el modo 'light' si aún no estamos montados, para asegurar que coincidan.
  const activeMode = isMounted ? mode : 'light';
  const theme = React.useMemo(() => getTheme(activeMode), [activeMode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {animatedGradientStyles}
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}