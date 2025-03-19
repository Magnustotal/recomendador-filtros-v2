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

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mb: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fafafa", // Fondo ligeramente amarillento (papel envejecido)
        borderRadius: "16px 16px 16px 0", // Bordes redondeados solo en la parte superior e izquierda
        border: "1px solid #e0e0e0", // Borde sutil
        position: "relative",
        overflow: "hidden",
        fontFamily: "inherit", // Usa la misma fuente que el resto de la aplicación
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
            #e0e0e0 24px,
            #e0e0e0 25px
          )`, // Líneas horizontales para simular un cuaderno
          zIndex: 0,
          opacity: 0.5,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: -10,
          right: -10,
          width: "20px",
          height: "20px",
          backgroundColor: "#fafafa",
          border: "1px solid #e0e0e0",
          transform: "rotate(45deg)", // Esquina arrancada
          zIndex: 1,
        },
        transform: "rotate(-1deg)", // Inclinación para simular una hoja arrancada
        transition: "transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out",
        "&:hover": {
          transform: "rotate(0deg) scale(1.02)", // Efecto al hacer hover
          boxShadow: theme.shadows[6], // Sombra más pronunciada al hacer hover
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 2, // Asegura que el contenido esté por encima de las líneas
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
              color: "text.primary",
              fontFamily: "inherit", // Usa la misma fuente que el resto de la aplicación
            }}
          >
            Consejo:
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              mt: 1,
              fontFamily: "inherit", // Usa la misma fuente que el resto de la aplicación
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