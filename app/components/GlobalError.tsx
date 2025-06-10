"use client";

import React, { useEffect } from "react";
import {
  Box, Typography, Button, Container, Paper, Fade, Stack, Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import HomeIcon from "@mui/icons-material/Home";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

// --- TIPOS ---
interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// --- COMPONENTES ESTILIZADOS ---
const ErrorContainer = styled(Container)(({ theme }) => ({
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.palette.background.default,
}));

const ErrorPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4, 5),
  width: "100%",
  maxWidth: 580,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(3, 2.5),
  },
}));

// --- COMPONENTE PRINCIPAL ---
const GlobalError: React.FC<GlobalErrorProps> = ({ error, reset }) => {
  const router = useRouter();

  useEffect(() => {
    // Aquí puedes integrar un servicio de logging como Sentry, LogRocket, etc.
    console.error("Error capturado por el Error Boundary:", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';
  const errorMessage = error.message && error.message.length < 180
    ? error.message
    : "Ha ocurrido un error inesperado. Nuestro equipo ha sido notificado.";

  return (
    <ErrorContainer component="main" maxWidth={false}>
      <Fade in appear timeout={500}>
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <ErrorPaper variant="outlined">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: [-5, 5, -2, 2, 0] }}
              transition={{ duration: 0.6, type: "spring", stiffness: 150, delay: 0.2 }}
            >
              <ErrorOutlineIcon color="error" sx={{ fontSize: 72, mb: 2 }} />
            </motion.div>

            <Typography variant="h4" component="h1" fontWeight={700} sx={{ mb: 1.5 }}>
              ¡Vaya! Algo no ha salido bien.
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 450 }}>
                {errorMessage}
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" width="100%">
              <Button
                variant="contained"
                color="primary"
                onClick={() => reset()}
                startIcon={<ReplayIcon />}
                size="large"
              >
                Reintentar
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<HomeIcon />}
                onClick={() => router.push("/")}
                size="large"
              >
                Ir al inicio
              </Button>
            </Stack>

            {isDev && (
                <Accordion variant="outlined" sx={{ mt: 4, width: '100%', textAlign: 'left' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="button">Detalles del Error (DEV)</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY: 'auto' }}>
                        <Typography variant="caption" component="pre">
                            <strong>Message:</strong> {error.message}\n
                            <strong>Digest:</strong> {error.digest}\n\n
                            <strong>Stack:</strong>\n{error.stack}
                        </Typography>
                    </AccordionDetails>
                </Accordion>
            )}

            <Typography variant="caption" color="text.disabled" sx={{ mt: isDev ? 2 : 4 }}>
                Si el problema persiste, por favor, contacta con soporte.
            </Typography>

          </ErrorPaper>
        </motion.div>
      </Fade>
    </ErrorContainer>
  );
};

export default GlobalError;