"use client";

import React from 'react';
import { Card, Typography, Stack, Chip, Grid, Avatar, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import { 
  Water as WaterIcon, 
  Science as ScienceIcon, 
  CheckCircle as CheckCircleIcon, 
  WarningAmber as WarningAmberIcon,
  Power as PowerIcon,
  Bolt as EfficiencyIcon,
} from "@mui/icons-material";
import { motion } from 'framer-motion';
import { ExtendedFiltro } from '@/hooks/useProcessedFilters';
import { getBrandLogo } from '@/lib/branding'; // Ajusta la ruta si es necesario

// --- Componentes Estilizados ---
const StyledCard = styled(Card)(({ theme }) => ({
  transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out',
  position: 'relative',
  overflow: 'visible',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[6],
    borderColor: theme.palette.primary.main,
  },
}));

const Stat: React.FC<{ icon: React.ReactNode, label: string, value: string | number }> = ({ icon, label, value }) => (
  <Grid item xs={6} sm={3}>
    <Stack direction="row" alignItems="center" spacing={1}>
      <Tooltip title={label} placement="top">
        {icon}
      </Tooltip>
      <Typography variant="body2" noWrap>{value}</Typography>
    </Stack>
  </Grid>
);

// --- Componente Principal ---
interface FilterCardProps {
  filtro: ExtendedFiltro;
  level: 'recommended' | 'minimum';
  onDetailsClick: () => void;
  index: number;
}

export const FilterCard: React.FC<FilterCardProps> = ({ filtro, level, onDetailsClick, index }) => {
  const logoSrc = getBrandLogo(filtro.marca);

  // Calcula la eficiencia, evitando división por cero
  const eficiencia = (filtro.consumo && filtro.caudal) 
    ? (filtro.caudal / filtro.consumo).toFixed(1) 
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <StyledCard variant="outlined" sx={{ p: 2, cursor: 'pointer' }} onClick={onDetailsClick}>
        {/* --- Header de la Tarjeta --- */}
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          {logoSrc && (
            <Avatar 
              variant="rounded" 
              src={logoSrc} 
              alt={`${filtro.marca} logo`} 
              sx={{ width: 48, height: 48, bgcolor: 'background.paper', p: 0.5 }}
            />
          )}
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            {filtro.modelo}
            {!logoSrc && <Typography variant="caption" display="block" color="text.secondary">{filtro.marca}</Typography>}
          </Typography>
          <Chip 
            label={level === 'recommended' ? 'Recomendado' : 'Mínimo'} 
            color={level === 'recommended' ? 'success' : 'warning'} 
            size="small" 
            icon={level === 'recommended' ? <CheckCircleIcon/> : <WarningAmberIcon/>}
            sx={{ fontWeight: 'bold' }}
          />
        </Stack>

        {/* --- Grid de Estadísticas --- */}
        <Grid container spacing={{xs: 1.5, sm: 2}} alignItems="center">
          <Stat icon={<WaterIcon color="primary" fontSize="small" />} label="Caudal" value={`${filtro.caudal} l/h`} />
          <Stat icon={<ScienceIcon color="secondary" fontSize="small" />} label="Volumen Vaso" value={`${filtro.volumen_vaso_filtro} L`} />
          <Stat icon={<PowerIcon color="error" fontSize="small" />} label="Consumo" value={filtro.consumo ? `${filtro.consumo} W` : '—'} />
          <Stat icon={<EfficiencyIcon color="info" fontSize="small" />} label="Eficiencia" value={`${eficiencia} l/h·W`} />
        </Grid>
      </StyledCard>
    </motion.div>
  );
};