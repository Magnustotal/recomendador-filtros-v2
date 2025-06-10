"use client";

import React, { FC, useContext } from "react";
import { AppBar, Toolbar, Typography, Box, Container, Tooltip, IconButton, useScrollTrigger, Stack } from "@mui/material";
// 👇 AQUÍ ESTÁ LA CORRECCIÓN: Añadimos useTheme
import { styled, useTheme, alpha } from "@mui/material/styles";
import Image from "next/image";
import NextLink from "next/link";
import {
  InfoOutlined as InfoOutlinedIcon, MailOutline as MailOutlineIcon, GitHub as GitHubIcon,
  Brightness4 as Brightness4Icon, Brightness7 as Brightness7Icon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { ColorModeContext } from "../ThemeRegistry"; 

// --- Constantes ---
const APP_NAME = "Recomendador de Filtros";

// --- Componentes Estilizados ---
const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'scrolled',
})<{ scrolled: boolean }>(({ theme, scrolled }) => ({
  position: "sticky",
  top: 0,
  zIndex: theme.zIndex.appBar,
  transition: theme.transitions.create(['background-color', 'box-shadow'], {
    duration: theme.transitions.duration.short,
  }),
  ...(scrolled && {
    backdropFilter: "blur(8px)",
    backgroundColor: alpha(theme.palette.background.paper, 0.85),
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[1],
  }),
  ...(!scrolled && {
    backgroundColor: 'transparent',
    borderBottom: `1px solid transparent`,
    boxShadow: 'none',
  }),
}));

const InfoTooltipContent: FC = () => (
    <Box sx={{ p: 1, maxWidth: 300 }}>
      <Typography variant="subtitle2" gutterBottom>¿Qué es esto?</Typography>
      <Typography variant="body2" color="text.secondary">
        Una herramienta que analiza tu acuario y te muestra los <b>mejores filtros</b> según volumen, caudal y eficiencia. 100% gratis y sin registros.
      </Typography>
    </Box>
);

const Branding: FC = React.memo(() => (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexGrow: 1, minWidth: 0 }}>
      <motion.div whileHover={{ scale: 1.05 }}>
        <NextLink href="/" aria-label="Ir a la página de inicio" style={{ display: 'flex' }}>
          <Image src="/logo.svg" alt="Logo de la aplicación" width={40} height={40} priority />
        </NextLink>
      </motion.div>
      <Tooltip title={<InfoTooltipContent />} arrow placement="bottom-start">
        <Stack direction="row" alignItems="center" spacing={1} sx={{ cursor: "help", overflow: 'hidden' }}>
          <Typography variant="h6" fontWeight={700} noWrap color="text.primary">{APP_NAME}</Typography>
          <InfoOutlinedIcon color="info" fontSize="small" />
        </Stack>
      </Tooltip>
    </Stack>
));
Branding.displayName = "Branding";

const ActionButtons: FC = React.memo(() => {
  const theme = useTheme();
  const { toggleColorMode } = useContext(ColorModeContext);

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Tooltip title="Sugerencias o correcciones">
        <IconButton component="a" href="mailto:contacto@tudominio.com" target="_blank" rel="noopener"><MailOutlineIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Código fuente en GitHub">
        <IconButton component="a" href="https://github.com/Magnustotal/Recomendador-Filtros" target="_blank" rel="noopener"><GitHubIcon /></IconButton>
      </Tooltip>
      <Tooltip title={`Cambiar a modo ${theme.palette.mode === 'dark' ? 'claro' : 'oscuro'}`}>
        <IconButton onClick={toggleColorMode}>
          {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
});
ActionButtons.displayName = "ActionButtons";

// --- Componente Principal ---
const Header: React.FC = () => {
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  return (
    <StyledAppBar scrolled={trigger}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 72 } }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ width: '100%', display: 'flex', alignItems: 'center' }}
          >
            <Branding />
            <ActionButtons />
          </motion.div>
        </Toolbar>
      </Container>
    </StyledAppBar>
  );
};

export default Header;