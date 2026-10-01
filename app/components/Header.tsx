"use client";

import React, { FC } from "react";
import { AppBar, Toolbar, Typography, Box, Container, Tooltip, IconButton, useScrollTrigger, Stack } from "@mui/material";
import { styled, useColorScheme } from "@mui/material/styles";
import Image from "next/image";
import NextLink from "next/link";
import {
  InfoOutlined as InfoOutlinedIcon,
  Brightness4 as Brightness4Icon, Brightness7 as Brightness7Icon,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { paletteOf, withAlpha } from "../theme";

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
    backgroundColor: withAlpha(paletteOf(theme).background.paper, 85),
    borderBottom: `1px solid ${paletteOf(theme).divider}`,
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
        <NextLink href="/" aria-label="Ir a la página de inicio" style={{ display: 'flex', padding: 4 }}>
          <Image src="/logo.svg" alt="Logo de la aplicación" width={40} height={40} priority />
        </NextLink>
      </motion.div>
      <Tooltip title={<InfoTooltipContent />} arrow placement="bottom-start">
        <Stack direction="row" alignItems="center" spacing={1} sx={{ cursor: "help", minWidth: 0 }}>
          <Typography
            variant="h6"
            component="span"
            fontWeight={700}
            color="text.primary"
            sx={{ lineHeight: 1.25, fontSize: { xs: '1rem', sm: '1.25rem' } }}
          >
            {APP_NAME}
          </Typography>
          <InfoOutlinedIcon color="info" fontSize="small" sx={{ display: { xs: 'none', sm: 'block' } }} />
        </Stack>
      </Tooltip>
    </Stack>
));
Branding.displayName = "Branding";

const ActionButtons: FC = React.memo(() => {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Tooltip title="Cambiar entre modo claro y oscuro">
        <IconButton size="large" onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')} aria-label="Cambiar entre modo claro y oscuro">
          {/* Ambos iconos van en el HTML y el CSS elige el visible: así el servidor y el cliente coinciden. */}
          <Brightness4Icon sx={(theme) => ({ display: 'block', ...theme.applyStyles('dark', { display: 'none' }) })} />
          <Brightness7Icon sx={(theme) => ({ display: 'none', ...theme.applyStyles('dark', { display: 'block' }) })} />
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