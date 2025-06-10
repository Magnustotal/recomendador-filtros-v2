"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Container, Box, Stack, CircularProgress, Alert, Typography, Paper } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import InfoIcon from '@mui/icons-material/Info';
import CalculationForm from "./components/CalculationForm";
import ResultsList from "./components/ResultsList";
import CalculationExplanation from "./components/CalculationExplanation";
import TipsCarousel from "./components/TipsCarousel";
import { filtros } from "./data/filtros"; 

export default function HomePage() {
  const [litros, setLitros] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [specialMessage, setSpecialMessage] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const minCaudalInDB = useMemo(() => {
    return Math.min(...filtros.map(f => f.caudal ?? Infinity));
  }, []);

  useEffect(() => {
    if (litros !== null && !isCalculating) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [litros, isCalculating]);

  const handleLitrosSubmit = useCallback((newLiters: number) => {
    setIsCalculating(true);
    setLitros(null);
    setSpecialMessage(null);
    if (newLiters * 10 < minCaudalInDB) {
        setSpecialMessage(`Para acuarios de ${newLiters}L, un filtro de botella puede generar demasiada corriente. Considera alternativas como un filtro de mochila (HOB) o uno interno de bajo caudal.`);
    }
    setTimeout(() => {
      setLitros(newLiters);
      setIsCalculating(false);
    }, 300);
  }, [minCaudalInDB]);

  // Variantes para la animación orquestada
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Stack alignItems="center" spacing={8}>

          {/* --- Título Principal y Formulario --- */}
          <motion.div variants={itemVariants} style={{ width: '100%', maxWidth: '780px' }}>
            <Box textAlign="center" mb={4}>
              <Typography variant="h2" component="h1" fontWeight={800}>
                Encuentra el Filtro Perfecto
              </Typography>
              <Typography variant="h5" color="text.secondary" fontWeight={500} mt={1}>
                Para un acuario sano y cristalino
              </Typography>
            </Box>
            <Paper variant="outlined" sx={{p: {xs: 2, sm: 3, md: 4}}}>
              <CalculationForm onLitrosSubmit={handleLitrosSubmit} />
            </Paper>
          </motion.div>
          
          {/* --- Zona de Mensajes y Resultados --- */}
          <Box ref={resultsRef} width="100%" maxWidth="780px" minHeight={100}>
            <AnimatePresence>
                {specialMessage && (
                  <motion.div key="special-message" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ marginBottom: '16px' }}>
                      <Alert severity="info" icon={<InfoIcon />}>{specialMessage}</Alert>
                  </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {isCalculating && (
                <motion.div key="loader" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <CircularProgress />
                </motion.div>
              )}
              {litros !== null && !isCalculating && (
                <motion.div key="results-list" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                  <ResultsList filters={filtros} liters={litros} />
                </motion.div>
              )}
            </AnimatePresence>
          </Box>

          {/* --- Sección de Explicación y Consejos --- */}
          <motion.div variants={itemVariants} style={{ width: '100%', maxWidth: '780px' }}>
            <Stack spacing={8}>
              <CalculationExplanation calculatedLiters={litros} />
              <TipsCarousel />
            </Stack>
          </motion.div>

        </Stack>
      </motion.div>
    </Container>
  );
}