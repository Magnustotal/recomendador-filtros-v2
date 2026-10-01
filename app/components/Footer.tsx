"use client";

import React from "react";
import {
  Typography, Link, Container, Stack, Divider, Fab, Tooltip, Chip, Fade
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { paletteOf, withAlpha } from "../theme";
import { APP_VERSION, LAST_UPDATE } from "@/lib/version";
import {
  InfoOutlined as InfoOutlinedIcon, Favorite as FavoriteIcon, KeyboardArrowUp as KeyboardArrowUpIcon
} from "@mui/icons-material";
import { motion } from "framer-motion";

const AUTHOR_LINKEDIN = "https://www.linkedin.com/in/javier-barrero-vazquez-/";

// --- Componentes Estilizados y Sub-componentes ---
const FooterWrapper = styled('footer')(({ theme }) => ({
  backgroundColor: withAlpha(paletteOf(theme).background.paper, 70),
  backdropFilter: "blur(8px)",
  padding: theme.spacing(4, 0),
  borderTop: `1px solid ${paletteOf(theme).divider}`,
  marginTop: theme.spacing(8),
  width: "100%",
}));

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
              justifyContent="center"
              spacing={{ xs: 3, md: 2 }}
              pb={3}
            >
              <Stack direction="row" alignItems="center" gap={1.5}>
                <InfoOutlinedIcon color="primary" />
                <Typography variant="body2" color="text.secondary">
                  Un proyecto <b>Open Source</b> para la comunidad acuariófila.
                </Typography>
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
              <Stack spacing={0.5} alignItems={{ xs: 'center', md: 'flex-start' }} textAlign={{ xs: 'center', md: 'left' }}>
                <Typography variant="body2" color="text.secondary">
                  Hecho con <FavoriteIcon color="error" sx={{ fontSize: 'inherit', verticalAlign: 'middle' }} /> para el equipo cadete del C.&nbsp;D.&nbsp;Almena
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Diseño y desarrollo:{' '}
                  <Link href={AUTHOR_LINKEDIN} target="_blank" rel="noopener noreferrer" fontWeight="bold">
                    Javier B. V.
                  </Link>
                  {' · '}
                  <Link href="/privacidad" underline="hover" color="text.secondary">
                    Privacidad
                  </Link>
                </Typography>
              </Stack>

              <Stack direction="row" alignItems="center" spacing={2}>
                <Chip label={`v${APP_VERSION} · ${LAST_UPDATE}`} size="small" variant="outlined"/>
                <Typography variant="caption" color="text.disabled">
                  &copy; {new Date().getFullYear()} MIT License
                </Typography>
              </Stack>

              <Tooltip title="Volver arriba" arrow>
                <Fab color="primary" size="medium" onClick={handleScrollTop} aria-label="Volver arriba">
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