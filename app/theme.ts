import { createTheme, responsiveFontSizes, type Theme } from "@mui/material/styles";

/**
 * Con variables CSS (colorSchemes) los valores de `theme.palette` son solo los
 * del esquema por defecto; `theme.vars.palette` apunta a `var(--mui-...)` y sí
 * cambia con el esquema activo. Usar siempre esto dentro de estilos.
 */
export const paletteOf = (theme: Theme) => (theme.vars ?? theme).palette;

/** Transparencia sobre un color que puede ser un `var(--...)` (alpha() de MUI no lo admite). */
export const withAlpha = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

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
    button: { fontWeight: 700, textTransform: "none" as const, letterSpacing: "0.2px" },
  },
};

// Paleta de colores para el MODO CLARO
const lightPalette = {
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
  divider: "rgba(255, 255, 255, 0.12)",
  success: { main: "#41B883" },
  warning: { main: "#FFCB05" },
  info: { main: "#29b6f6" }, // Un azul info más claro para modo oscuro
};

export const theme = responsiveFontSizes(
  createTheme({
    ...baseThemeOptions,
    cssVariables: { colorSchemeSelector: "data" },
    defaultColorScheme: "light",
    colorSchemes: {
      light: { palette: lightPalette },
      dark: { palette: darkPalette },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            // En modo oscuro, la elevación se simula con bordes en lugar de sombras
            ...theme.applyStyles("dark", {
              backgroundImage: "none",
              border: `1px solid ${paletteOf(theme).divider}`,
            }),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: baseThemeOptions.shape.borderRadius,
            padding: theme.spacing(1),
            boxShadow: `0 4px 24px 0 ${withAlpha(paletteOf(theme).text.primary, 5)}`,
            ...theme.applyStyles("dark", {
              border: `1px solid ${paletteOf(theme).divider}`,
              boxShadow: "none",
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
            backgroundColor: paletteOf(theme).primary.main,
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
            backgroundColor: withAlpha(paletteOf(theme).background.default, 80),
            color: paletteOf(theme).text.primary,
            border: `1px solid ${paletteOf(theme).divider}`,
          }),
          arrow: ({ theme }) => ({
            color: paletteOf(theme).divider,
          }),
        },
      },
    },
  })
);
