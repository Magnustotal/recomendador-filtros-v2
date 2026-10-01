"use client";

import React from "react";
import { Typography, Divider, Box, Stack, Chip, useMediaQuery } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import { paletteOf, withAlpha } from "../theme";
import CalculateIcon from "@mui/icons-material/Calculate";
import WaterIcon from "@mui/icons-material/Water";
import ScienceIcon from "@mui/icons-material/Science";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import SpaIcon from '@mui/icons-material/Spa';
import { motion } from "framer-motion";

// --- DATOS Y TIPOS ---
interface ExplanationItemData {
  icon: React.ReactNode;
  title: string;
  text: string;
  borderColorKey: "primary" | "info" | "secondary" | "success";
  customContent?: React.ReactNode;
}

// --- SUB-COMPONENTES INTERNOS ---

// Diagrama animado de la filtración
function FiltrationDiagram() {
  const p = paletteOf(useTheme());
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return (
    <Box sx={{ my: 2, display: 'flex', justifyContent: 'center' }}>
      <svg width="120" height="180" viewBox="0 0 120 180">
        <defs>
          <style>
            {`
              @keyframes flow {
                0% { transform: translateY(160px) scale(1); opacity: 1; }
                80% { transform: translateY(10px) scale(0.7); opacity: 1; }
                100% { transform: translateY(0px) scale(0.5); opacity: 0; }
              }
            `}
          </style>
        </defs>
        {/* Canister */}
        <rect x="10" y="10" width="100" height="160" rx="10" style={{ fill: withAlpha(p.action.hover, 50), stroke: p.divider }} strokeWidth="2" />
        
        {/* Capas de Esponjas (Filtración Mecánica) */}
        <rect x="20" y="115" width="80" height="20" style={{ fill: withAlpha(p.secondary.light, 60) }} />
        <rect x="20" y="90" width="80" height="20" style={{ fill: withAlpha(p.secondary.light, 80) }} />
        <rect x="20" y="65" width="80" height="20" style={{ fill: withAlpha(p.secondary.main, 80) }} />
        <text x="60" y="102" textAnchor="middle" fontSize="9" style={{ fill: p.text.secondary }}>Mecánico</text>

        {/* Material Biológico */}
        <rect x="20" y="25" width="80" height="35" style={{ fill: withAlpha(p.success.light, 70) }} />
        <text x="60" y="47" textAnchor="middle" fontSize="9" style={{ fill: p.text.secondary }}>Biológico</text>

        {/* Flujo de Agua Animado (se omite con "reducir movimiento") */}
        {!reduceMotion && [0, 1, 2, 3].map((delay) => (
          <circle key={delay} r="3" style={{ fill: p.info.main, animation: 'flow 4s linear infinite', animationDelay: `${delay}s` }}>
            <animateMotion dur="4s" repeatCount="indefinite" path="M 60 170 V 20" />
          </circle>
        ))}
      </svg>
    </Box>
  );
}

const CardWrapper = styled(motion.div)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(2.5),
  padding: theme.spacing(2.5, 0),
  transition: 'transform 0.2s ease-out',
  '&:hover .card-icon': {
      transform: 'scale(1.1)',
  },
}));

const ExplanationCard: React.FC<ExplanationItemData & { index: number }> = React.memo(
  ({ icon, title, text, customContent, borderColorKey, index }) => {
    const borderColor = paletteOf(useTheme())[borderColorKey].main;

    return (
      <CardWrapper
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 * index }}
        viewport={{ once: true }}
        sx={{ borderLeft: `4px solid ${borderColor}`, pl: 2.5 }}
      >
        <Box className="card-icon" aria-hidden="true" flexShrink={0} mt={0.5} sx={{ transition: "transform 0.2s ease-out", fontSize: 44 }}>
          {icon}
        </Box>
        <Box flex={1}>
          <Typography variant="h6" component="h3" fontWeight={700} color="text.primary" mb={0.5}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{text}</Typography>
          {customContent}
        </Box>
      </CardWrapper>
    );
  }
);
ExplanationCard.displayName = "ExplanationCard";

const ExampleBox: React.FC<{ calculatedLiters?: number | null }> = ({ calculatedLiters }) => {
    const exampleLiters = calculatedLiters || 100;
    const exampleFlow = exampleLiters * 10;
    
    return (
      <Box
        sx={(theme) => ({
          mt: 3, p: 2, borderRadius: theme.shape.borderRadius, bgcolor: withAlpha(paletteOf(theme).info.main, 10),
          borderLeft: `4px solid ${paletteOf(theme).info.main}`, display: "flex", alignItems: "center",
          gap: 2, maxWidth: 500, mx: "auto",
        })}
      >
        <TipsAndUpdatesIcon color="info" sx={{ fontSize: 32, flexShrink: 0 }} aria-hidden="true" />
        <Typography variant="body1" color="text.secondary">
          <Box component="span" fontWeight="bold" color="text.primary">
            {calculatedLiters ? "Tu ejemplo:" : "Ejemplo:"}
          </Box>{" "}
          Un acuario de <b>{exampleLiters} L</b> necesita un filtro de al menos <b>{exampleFlow} l/h</b>.
        </Typography>
      </Box>
    );
};

// Array con los datos de la explicación
const explanationItems: ExplanationItemData[] = [
  {
    icon: <CalculateIcon color="primary" />,
    title: "1. Cálculo del volumen real",
    text: "El volumen real del acuario (largo × ancho × alto en cm ÷ 1000) es la base para calcular el caudal necesario.",
    borderColorKey: "primary",
  },
  {
    icon: <WaterIcon color="primary" />,
    title: "2. Caudal recomendado",
    text: "Se aconseja filtrar al menos 10 veces el volumen total del acuario cada hora para mantener el agua limpia y saludable.",
    borderColorKey: "info",
  },
  {
    icon: <ScienceIcon color="primary" />,
    title: "3. Calidad y tecnología",
    text: "El filtro ideal combina un buen caudal con un gran volumen de vaso para albergar más material filtrante y mejorar la eficiencia.",
    borderColorKey: "secondary",
  },
  {
    icon: <SpaIcon color="primary" />,
    title: "4. El Material Biológico es Clave",
    text: "La clave de un filtro es su capacidad para alojar bacterias beneficiosas. Elige materiales porosos de calidad y renuévalos por partes para no destruir la colonia bacteriana.",
    borderColorKey: "success",
    customContent: <FiltrationDiagram />,
  },
];

// --- COMPONENTE PRINCIPAL ---
export default function CalculationExplanation({ calculatedLiters }: { calculatedLiters?: number | null }) {
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <CalculateIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" component="h2" fontWeight={700} color="text.primary">
          ¿Cómo calculamos el filtro recomendado?
        </Typography>
        <Chip label="Método experto" color="info" size="small" variant="outlined" sx={{ ml: "auto", display: { xs: "none", sm: "inline-flex" } }} icon={<ScienceIcon />} />
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5, maxWidth: 620 }}>
        Aplicamos recomendaciones de la comunidad acuariófila y fabricantes líderes para ofrecerte la mejor opción.
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Stack spacing={1} divider={<Divider />}>
        {explanationItems.map((item, index) => (
          <ExplanationCard key={item.title} index={index} {...item} />
        ))}
      </Stack>

      <ExampleBox calculatedLiters={calculatedLiters} />

    </Box>
  );
}