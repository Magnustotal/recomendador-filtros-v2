"use client";

import React from "react";
// 👇 AQUÍ ESTÁ LA CORRECCIÓN: Añadimos Fade a la importación
import {
  Box, Typography, Link, Container, Stack, Divider, Fab, Tooltip, Chip, IconButton, Fade
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import {
  GitHub as GitHubIcon, InfoOutlined as InfoOutlinedIcon, Favorite as FavoriteIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon, X as TwitterIcon, Email as EmailIcon
} from "@mui/icons-material";
import { motion } from "framer-motion";

// --- Constantes ---
const APP_VERSION = "v2.1"; // Versión semántica
const LAST_UPDATE = "junio 2025";
const socialLinks = [
  {
    href: "mailto:contacto@tu-dominio.com?subject=Recomendador Filtros",
    icon: <EmailIcon />,
    title: "Contacta por Email",
  },
  {
    href: "https://github.com/Magnustotal/Recomendador-Filtros",
    icon: <GitHubIcon />,
    title: "Código en GitHub",
  },
  {
    href: "https://twitter.com/tu_usuario",
    icon: <TwitterIcon />,
    title: "Síguenos en X",
  },
];

// --- Componentes Estilizados y Sub-componentes ---
const FooterWrapper = styled('footer')(({ theme }) => ({
  backgroundColor: alpha(theme.palette.background.paper, 0.7),
  backdropFilter: "blur(8px)",
  padding: theme.spacing(4, 0),
  borderTop: `1px solid ${theme.palette.divider}`,
  marginTop: theme.spacing(8),
  width: "100%",
}));

const SocialButton: React.FC<{ href: string; title: string; children: React.ReactNode }> = ({ href, title, children }) => (
  <Tooltip title={title} arrow>
    <IconButton component="a" href={href} target="_blank" rel="noopener noreferrer" aria-label={title}>
      {children}
    </IconButton>
  </Tooltip>
);

// --- Componente Principal ---
export default function Footer() {
  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Fade in appear timeout={800}>
      <FooterWrapper>
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            {/* Sección superior: Branding y Redes Sociales */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems="center"
              justifyContent="space-between"
              spacing={{ xs: 3, md: 2 }}
              pb={3}
            >
              <Stack direction="row" alignItems="center" gap={1.5}>
                <InfoOutlinedIcon color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Un proyecto <b>Open Source</b> para la comunidad acuariófila.
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1}>
                {socialLinks.map((link) => (
                  <SocialButton key={link.title} href={link.href} title={link.title}>
                    {link.icon}
                  </SocialButton>
                ))}
              </Stack>
            </Stack>

            <Divider />

            {/* Sección inferior: Legal, versión y autor */}
            <Stack
              direction={{ xs: 'column-reverse', md: 'row' }}
              alignItems="center"
              justifyContent="space-between"
              spacing={{ xs: 3, md: 2 }}
              pt={3}
            >
              <Typography variant="body2" color="text.secondary">
                Hecho con <FavoriteIcon color="error" sx={{ fontSize: 'inherit', verticalAlign: 'middle' }} /> por{' '}
                <Link href="https://github.com/Magnustotal" target="_blank" rel="noopener noreferrer" fontWeight="bold">
                  Magnustotal
                </Link>
                {' · '}
                <Link href="/privacidad" underline="hover" color="text.secondary">
                  Privacidad
                </Link>
              </Typography>

              <Stack direction="row" alignItems="center" spacing={2}>
                <Chip label={`${APP_VERSION} · ${LAST_UPDATE}`} size="small" variant="outlined"/>
                <Typography variant="caption" color="text.disabled">
                  &copy; {new Date().getFullYear()} MIT License
                </Typography>
              </Stack>

              <Tooltip title="Volver arriba" arrow>
                <Fab color="primary" size="small" onClick={handleScrollTop} aria-label="Volver arriba">
                  <KeyboardArrowUpIcon />
                </Fab>
              </Tooltip>
            </Stack>
          </motion.div>
        </Container>
      </FooterWrapper>
    </Fade>
  );
}