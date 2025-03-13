"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, IconButton, Typography, Paper, Tooltip } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

interface TipsProps {
  tips: string[];
}

// Componente para mostrar consejos con navegación
const Tips: React.FC<TipsProps> = ({ tips }) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        backgroundColor: "#fff9c4", // Color de fondo en tono amarillento
        borderRadius: 4,
        border: 1,
        borderColor: "divider",
      }}
    >
      <Tooltip title="Anterior consejo">
        <IconButton onClick={prevTip} size="large" aria-label="Previous tip">
          <ArrowBackIosNewIcon />
        </IconButton>
      </Tooltip>
      <Box sx={{ flexGrow: 1, textAlign: "center" }}>
        <Typography
          variant="h6"
          component="div"
          sx={{ fontWeight: "bold", color: "black", fontFamily: "Roboto" }}
        >
          Consejo:
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "black", mt: 1, fontFamily: "Roboto" }}
        >
          {tips[currentTipIndex]}
        </Typography>
      </Box>
      <Tooltip title="Siguiente consejo">
        <IconButton onClick={nextTip} size="large" aria-label="Next tip">
          <ArrowForwardIosIcon />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};

export default Tips;