"use client";

import React, { FC, ReactNode } from "react";
import { Paper, Typography, Box, IconButton, Stack } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { motion, AnimatePresence } from "framer-motion";
// 👇 AQUÍ ESTÁ LA CORRECCIÓN
import { useCarousel } from "../hooks/useCarousel"; 

// --- DATOS ---
const tips: { icon: ReactNode; text: string }[] = [
  { icon: <CheckCircleOutlineIcon color="primary" />, text: "El caudal real de un filtro nunca es el que indica la caja; siempre es menor." },
  { icon: <InfoOutlinedIcon color="secondary" />, text: "Consulta el volumen del vaso filtrante: a mayor volumen, más material filtrante y mayor eficiencia." },
  { icon: <LightbulbOutlinedIcon color="success" />, text: "Prefiere filtros que permitan una buena combinación de materiales mecánicos, biológicos y químicos." },
  { icon: <ReportProblemOutlinedIcon color="warning" />, text: "Evita filtros demasiado potentes para acuarios pequeños para no generar corrientes excesivas." },
  { icon: <CheckCircleOutlineIcon color="primary" />, text: "Elige marcas con buena reputación, recambios fáciles de encontrar y buen soporte técnico." },
  { icon: <LightbulbOutlinedIcon color="success" />, text: "Limpia el filtro solo con agua del propio acuario para preservar las bacterias beneficiosas." },
  { icon: <ReportProblemOutlinedIcon color="warning" />, text: "No limpies todos los materiales filtrantes al mismo tiempo para no destruir la colonia bacteriana." },
];

// --- COMPONENTES ESTILIZADOS ---
const CarouselWrapper = styled(motion.div)(({ theme }) => ({
  position: "relative",
  maxWidth: 700,
  margin: `${theme.spacing(6)} auto`,
  "&:hover .nav-button": {
    opacity: 1,
  },
}));

const SlidePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  minHeight: 180,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  overflow: 'hidden',
  position: 'relative',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3, 2.5),
    minHeight: 220,
  },
}));

const NavButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 2,
  backgroundColor: alpha(theme.palette.background.paper, 0.5),
  border: `1px solid ${theme.palette.divider}`,
  backdropFilter: "blur(4px)",
  opacity: 0,
  transition: "opacity 0.2s ease-in-out",
  "&:hover": {
    backgroundColor: alpha(theme.palette.background.paper, 0.8),
  },
}));

const Dot: FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <Box
    component="button"
    onClick={onClick}
    aria-label={`Ir al consejo ${active ? 'actual' : ''}`}
    sx={{
      width: 10, height: 10, borderRadius: '50%', border: 'none', p: 0, cursor: 'pointer',
      bgcolor: active ? 'primary.main' : 'text.disabled',
      transition: 'background-color 0.2s ease',
      position: 'relative',
    }}
  >
    {active && (
      <motion.div
        layoutId="active-dot"
        style={{ position: 'absolute', inset: -4, border: '2px solid', borderColor: 'primary.main', borderRadius: '50%' }}
      />
    )}
  </Box>
);

// --- COMPONENTE PRINCIPAL ---
export default function TipsCarousel() {
  const { activeIndex, handlers } = useCarousel({ itemCount: tips.length });

  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? "100%" : "-100%", opacity: 0 }),
  };
  
  // Almacenar la dirección para la animación
  const [direction, setDirection] = React.useState(0);
  const handleNext = () => { setDirection(1); handlers.next(); };
  const handlePrev = () => { setDirection(-1); handlers.prev(); };

  return (
    <CarouselWrapper
      onMouseEnter={handlers.pause}
      onMouseLeave={handlers.resume}
      aria-roledescription="carousel"
      aria-label="Carrusel de consejos sobre acuariofilia"
    >
      <SlidePaper variant="outlined">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            style={{ position: "absolute", width: '100%', padding: '0 40px' }} // Padding para que el texto no toque los bordes
            aria-hidden={false}
          >
            <Stack spacing={2} alignItems="center">
              <Box sx={{ fontSize: 40 }}>{tips[activeIndex].icon}</Box>
              <Typography variant="h6" color="text.primary" fontWeight={600}>
                {tips[activeIndex].text}
              </Typography>
            </Stack>
          </motion.div>
        </AnimatePresence>
      </SlidePaper>

      {/* Navegación */}
      <NavButton className="nav-button" onClick={handlePrev} sx={{ left: 16 }} aria-label="Consejo anterior">
        <ArrowBackIosNewIcon fontSize="small" />
      </NavButton>
      <NavButton className="nav-button" onClick={handleNext} sx={{ right: 16 }} aria-label="Siguiente consejo">
        <ArrowForwardIosIcon fontSize="small" />
      </NavButton>
      
      {/* Indicadores */}
      <Stack direction="row" justifyContent="center" spacing={2} mt={2}>
        {tips.map((_, i) => (
          <Dot key={i} active={activeIndex === i} onClick={() => { setDirection(i > activeIndex ? 1 : -1); handlers.set(i); }} />
        ))}
      </Stack>
    </CarouselWrapper>
  );
}