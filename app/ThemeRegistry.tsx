"use client";

import React from 'react';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { MotionConfig } from 'framer-motion';
import { theme, paletteOf } from './theme';

const animatedGradientStyles = (
  <GlobalStyles styles={(theme) => {
    const p = paletteOf(theme);
    return {
      '@keyframes gradient-animation': {
        '0%': { backgroundPosition: '0% 50%' },
        '50%': { backgroundPosition: '100% 50%' },
        '100%': { backgroundPosition: '0% 50%' },
      },
      body: {
        backgroundImage: `linear-gradient(-45deg, ${p.background.default}, ${p.primary.light}, ${p.secondary.light}, #EAF3FC)`,
        backgroundSize: '400% 400%',
        animation: 'gradient-animation 25s ease infinite',
        ...theme.applyStyles('dark', {
          backgroundImage: `linear-gradient(-45deg, ${p.background.default}, ${p.background.paper}, #121826, #1A2233)`,
        }),
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      },
    };
  }} />
);

// El esquema claro/oscuro lo resuelve el navegador con variables CSS (ver
// InitColorSchemeScript en layout.tsx), sin estado de React: así no hay
// parpadeo de tema claro al cargar con el sistema en oscuro.
export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      {animatedGradientStyles}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
