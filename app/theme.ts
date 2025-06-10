import { createTheme, PaletteMode, alpha } from "@mui/material";

// Opciones base del tema que son comunes a ambos modos (claro y oscuro)
const baseThemeOptions = {
  shape: {
    borderRadius: 16, // Un radio ligeramente más versátil
  },
  typography: {
    fontFamily: ["Inter", "Roboto", "Helvetica Neue", "Arial", "sans-serif"].join(","),
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 700, textTransform: "none", letterSpacing: "0.2px" },
  },
};

// Paleta de colores para el MODO CLARO
const lightPalette = {
  mode: "light" as PaletteMode,
  primary: {
    main: "#2A81F7",
    dark: "#195B9B",
    light: "#EAF3FC",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#31B5A6",
    dark: "#18746a",
    light: "#DDF8F5",
    contrastText: "#FFFFFF",
  },
  background: {
    default: "#F8FAFC",
    paper: "#FFFFFF",
  },
  text: {
    primary: "#222B45",
    secondary: "#697586",
    disabled: "#A1ADC7",
  },
  divider: "#E0E6F2",
  success: { main: "#41B883" },
  warning: { main: "#FFCB05" },
  info: { main: "#1976d2" },
};

// Paleta de colores para el MODO OSCURO
const darkPalette = {
  mode: "dark" as PaletteMode,
  primary: {
    main: "#4BA2FF", // Azul más brillante para contraste en oscuro
    dark: "#2A81F7",
    light: "#1A2233",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#38d9a9", // Turquesa más vivo
    dark: "#31B5A6",
    light: "#1A2233",
    contrastText: "#FFFFFF",
  },
  background: {
    default: "#121826", // Azul oscuro profundo
    paper: "#1A2233",   // Superficies ligeramente más claras
  },
  text: {
    primary: "#F0F2F5",
    secondary: "#9DA8BE",
    disabled: "#535E74",
  },
  divider: alpha("#FFFFFF", 0.12),
  success: { main: "#41B883" },
  warning: { main: "#FFCB05" },
  info: { main: "#29b6f6" }, // Un azul info más claro para modo oscuro
};

/**
 * Función fábrica para crear el tema de la aplicación.
 * @param mode - El modo de la paleta ('light' o 'dark')
 * @returns Un tema de Material-UI completo y configurado.
 */
export const getTheme = (mode: PaletteMode) => {
  const palette = mode === "light" ? lightPalette : darkPalette;

  return createTheme({
    ...baseThemeOptions,
    palette: palette,
    components: {
      // --- Overrides de Componentes ---
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            // En modo oscuro, la elevación se simula con gradientes y bordes en lugar de sombras
            ...(theme.palette.mode === "dark" && {
              backgroundImage: "none",
              border: `1px solid ${theme.palette.divider}`,
            }),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: baseThemeOptions.shape.borderRadius,
            padding: theme.spacing(1),
            ...(theme.palette.mode === 'light'
              ? { boxShadow: `0 4px 24px 0 ${alpha(theme.palette.text.primary, 0.05)}` }
              : {
                  border: `1px solid ${theme.palette.divider}`,
                  boxShadow: 'none',
              }),
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: baseThemeOptions.shape.borderRadius / 2,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: ({ theme }) => ({
            height: 4,
            borderRadius: theme.shape.borderRadius,
            backgroundColor: theme.palette.primary.main,
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: baseThemeOptions.shape.borderRadius / 2,
            fontWeight: 600,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            backdropFilter: "blur(5px)",
            backgroundColor: alpha(theme.palette.background.default, 0.8),
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
          }),
          arrow: ({ theme }) => ({
            color: theme.palette.divider,
          }),
        },
      },
    },
  });
};