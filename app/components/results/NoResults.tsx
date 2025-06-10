"use client";

import React from 'react';
import { Paper, Typography } from "@mui/material";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";

export const NoResults: React.FC<{ isCategory?: boolean }> = ({ isCategory }) => (
  <Paper variant="outlined" sx={{ my: 2, p: 4, textAlign: 'center' }}>
    <TipsAndUpdatesIcon color="info" sx={{ fontSize: 48, mb: 1 }} />
    <Typography>
      {isCategory ? "No hay modelos en esta categoría." : "No hay filtros adecuados para este volumen."}
    </Typography>
    <Typography color="text.secondary">
      {isCategory ? "Prueba con otra combinación." : "Prueba con otro volumen o verifica las especificaciones."}
    </Typography>
  </Paper>
);