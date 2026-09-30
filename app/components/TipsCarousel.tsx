"use client";

import React, { FC, ReactNode } from "react";
import { Paper, Typography, Box, IconButton, Stack, ButtonBase } from "@mui/material";
import { styled } from "@mui/material/styles";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { motion, AnimatePresence, useReducedMotion, PanInfo } from "framer-motion";
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

const SWIPE_DISTANCE = 50;
const SWIPE_VELOCITY = 500;

// --- COMPONENTES ESTILIZADOS ---
const CarouselWrapper = styled('section')(({ theme }) => ({
  position: "relative",
  maxWidth: 700,
  margin: `${theme.spacing(4)} auto`,
}));

const SlidePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  minHeight: 200,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  overflow: 'hidden',
  position: 'relative',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3, 2),
    minHeight: 260,
  },
}));

// Zona táctil de 24×48 px con el punto visible de 10 px en el centro.
const Dot: FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <ButtonBase onClick={onClick} aria-label={label} aria-current={active ? "true" : undefined} sx={{ width: 24, height: 48, borderRadius: 1 }}>
    <Box
      sx={{
        width: 10, height: 10, borderRadius: '50%',
        bgcolor: active ? 'primary.main' : 'text.disabled',
        outline: active ? '2px solid' : 'none', outlineColor: 'primary.main', outlineOffset: 3,
        transition: 'background-color 0.2s ease',
      }}
    />
  </ButtonBase>
);

// --- COMPONENTE PRINCIPAL ---
export default function TipsCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const { activeIndex, direction, isPlaying, handlers } = useCarousel({
    itemCount: tips.length,
    autoPlay: !prefersReducedMotion,
  });

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) handlers.next();
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) handlers.prev();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); handlers.prev(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); handlers.next(); }
  };

  return (
    <CarouselWrapper
      // Solo el ratón real o el foco de teclado pausan: en táctil, el "hover"
      // sintético y el foco tras tocar dejarían el carrusel parado sin motivo.
      onPointerEnter={(e) => { if (e.pointerType === "mouse") handlers.hoverStart(); }}
      onPointerLeave={handlers.hoverEnd}
      onFocus={(e) => { if (e.target.matches(":focus-visible")) handlers.focusStart(); }}
      onBlur={handlers.focusEnd}
      onKeyDown={handleKeyDown}
      aria-roledescription="carousel"
      aria-label="Carrusel de consejos sobre acuariofilia"
    >
      <SlidePaper variant="outlined" aria-live={isPlaying ? "off" : "polite"}>
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
            role="group"
            aria-roledescription="slide"
            aria-label={`${activeIndex + 1} de ${tips.length}`}
            style={{ position: "absolute", width: '100%', padding: '0 24px', cursor: 'grab' }}
          >
            <Stack spacing={2} alignItems="center">
              <Box sx={{ fontSize: 40 }}>{tips[activeIndex].icon}</Box>
              <Typography variant="h6" component="p" color="text.primary" fontWeight={600}>
                {tips[activeIndex].text}
              </Typography>
            </Stack>
          </motion.div>
        </AnimatePresence>
      </SlidePaper>

      {/* Controles siempre visibles (no dependen de :hover) */}
      <Stack direction="row" justifyContent="center" alignItems="center" mt={1}>
        <IconButton size="large" onClick={handlers.prev} aria-label="Consejo anterior" sx={{ width: 48, height: 48 }}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>

        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 56, textAlign: 'center', display: { xs: 'block', sm: 'none' } }}>
          {activeIndex + 1} / {tips.length}
        </Typography>
        <Stack direction="row" sx={{ display: { xs: 'none', sm: 'flex' } }}>
          {tips.map((_, i) => (
            <Dot key={i} active={activeIndex === i} label={`Ir al consejo ${i + 1}`} onClick={() => handlers.goTo(i)} />
          ))}
        </Stack>

        <IconButton size="large" onClick={handlers.next} aria-label="Consejo siguiente" sx={{ width: 48, height: 48 }}>
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>

        {!prefersReducedMotion && (
          <IconButton
            size="large"
            onClick={handlers.togglePlay}
            aria-label={isPlaying ? "Pausar rotación automática" : "Reanudar rotación automática"}
            sx={{ ml: 0.5 }}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        )}
      </Stack>
    </CarouselWrapper>
  );
}
