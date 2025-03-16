@ -1,89 +0,0 @@
'use client';

import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { esES } from '@mui/material/locale';

// Crear un tema personalizado con modo oscuro y paleta adaptada
let theme = createTheme(
  {
    palette: {
      mode: 'dark',
      primary: {
        main: '#90caf9',
      },
      secondary: {
        main: '#f48fb1',
      },
      background: {
        default: '#121212',
        paper: '#1e1e1e',
      },
      text: {
        primary: '#ffffff',
        secondary: '#bbbbbb',
      },
      error: {
        main: '#f44336',
      },
      warning: {
        main: '#ffa726',
      },
      info: {
        main: '#29b6f6',
      },
      success: {
        main: '#66bb6a',
      },
      divider: 'rgba(255, 255, 255, 0.12)',
      action: {
        active: '#ffffff',
        hover: 'rgba(255, 255, 255, 0.08)',
        selected: 'rgba(255, 255, 255, 0.16)',
        disabled: 'rgba(255, 255, 255, 0.3)',
        disabledBackground: 'rgba(255, 255, 255, 0.12)',
        focus: 'rgba(255, 255, 255, 0.12)',
      },
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          },
        },
      },
    },
  },
  esES // Localización en español
);

// Ajuste automático de fuentes para mejorar la accesibilidad
theme = responsiveFontSizes(theme);

export default theme;