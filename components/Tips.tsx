"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, IconButton, Typography, Paper, Tooltip, useTheme } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

interface TipsProps {
  tips: string[];
}

// Componente para mostrar consejos con navegación
const Tips: React.FC<TipsProps> = ({ tips }) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const theme = useTheme();

  // Función para mostrar el siguiente consejo
  const nextTip = useCallback(() => {
    setCurrentTipIndex((prevIndex) => (prevIndex + 1) % tips.length);
  }, [tips.length]);

  // Función para mostrar el consejo anterior
  const prevTip = useCallback(() => {
    setCurrentTipIndex((prevIndex) =>
      prevIndex === 0 ? tips.length - 1 : prevIndex - 1
    );
  }, [tips.length]);

  // Efecto para cambiar el consejo cada 5 segundos
  useEffect(() => {
    intervalRef.current = setInterval(nextTip, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [nextTip]);

    // Define una paleta de colores personalizada
    const customPalette = {
        bicBlue: '#1E90FF', // Azul Bic
        paperBackground: '#fdf5e6', // Similar a #fafafa, pero un poco más "crema"
        paperLine: '#d3d3d3',  // Gris claro, más suave que #e0e0e0
    };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mb: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: customPalette.paperBackground, // Usar color crema
        borderRadius: "16px 16px 16px 0",
        border: `1px solid ${customPalette.paperLine}`, // Usar gris claro
        position: "relative",
        overflow: "hidden",
        fontFamily: '"Indie Flower", cursive',  // Fuente estilo "escrito a mano"
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `repeating-linear-gradient(
            to bottom,
            transparent,
            transparent 24px,
            ${customPalette.paperLine} 24px,  // Usar gris claro
            ${customPalette.paperLine} 25px   // Usar gris claro
          )`,
          zIndex: 0,
          opacity: 0.7, // Aumenté un poco la opacidad
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: -10,
          right: -10,
          width: "20px",
          height: "20px",
          backgroundColor: customPalette.paperBackground, // Usar color crema
          border: `1px solid ${customPalette.paperLine}`,   // Usar gris claro
          transform: "rotate(45deg)",
          zIndex: 1,
        },
        transform: "rotate(-1deg)",
        transition: "transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out",
        "&:hover": {
          transform: "rotate(0deg) scale(1.02)",
          boxShadow: theme.shadows[6],
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Tooltip title="Anterior consejo">
          <IconButton
            onClick={prevTip}
            size="large"
            aria-label="Previous tip"
            sx={{ color: theme.palette.text.primary }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1, textAlign: "center" }}>
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: "bold",
              color: "black", // Negro para "Consejo:"
              fontFamily: '"Indie Flower", cursive', // Fuente estilo "escrito a mano"
            }}
          >
            Consejo:
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: customPalette.bicBlue, // Azul Bic para el texto del consejo
              mt: 1,
              fontFamily: '"Indie Flower", cursive', // Fuente estilo "escrito a mano"
            }}
          >
            {tips[currentTipIndex]}
          </Typography>
        </Box>
        <Tooltip title="Siguiente consejo">
          <IconButton
            onClick={nextTip}
            size="large"
            aria-label="Next tip"
            sx={{ color: theme.palette.text.primary }}

          >
            <ArrowForwardIosIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};

export default Tips;