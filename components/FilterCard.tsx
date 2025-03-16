import React from "react";
import { Filtro } from "@/types/Filtro";
import { getFilterLevel } from "@/lib/filters";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Link,
  useTheme,
  Divider,
} from "@mui/material";
import WaterIcon from "@mui/icons-material/Water";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

interface FilterCardProps {
  filtro: Filtro | { combination: Filtro[] };
  onClick: () => void;
  liters?: number;
}

// Componente para mostrar una tarjeta de filtro con información relevante
const FilterCard: React.FC<FilterCardProps> = ({ filtro, onClick, liters }) => {
  const theme = useTheme();

  // Determina el nivel de filtrado basado en los litros
  const filterLevel = React.useMemo(() => {
    if (liters === undefined) return null;
    const targetFiltro = Array.isArray(filtro) ? filtro[0] : filtro;
    return getFilterLevel(targetFiltro as Filtro, liters);
  }, [filtro, liters]);

  // Define el color de fondo basado en el nivel de filtrado
  const backgroundColor = React.useMemo(() => {
    switch (filterLevel) {
      case "recommended":
        return theme.palette.success.light;
      case "minimum":
        return theme.palette.warning.light;
      default:
        return "#fff9c4"; // Fondo en tono amarillento
    }
  }, [filterLevel, theme]);

  // Verifica si es una combinación de filtros
  const isCombination = Array.isArray(filtro);
  const filtersToDisplay = isCombination ? filtro : [filtro];

  // Calcula el caudal y volumen combinados
  const combinedCaudal = filtersToDisplay.reduce((acc, f) => acc + f.caudal, 0);
  const combinedVolumen = filtersToDisplay.reduce(
    (acc, f) => acc + f.volumen_vaso_filtro,
    0
  );

  // Texto y enlace de Amazon
  const amazonLinkText = React.useMemo(() => {
    const targetFiltro = filtersToDisplay[0];
    if (!targetFiltro?.asin) return "";
    return targetFiltro.asin.startsWith("http")
      ? "Ver en Amazon"
      : "¡Consíguelo en Amazon! 🛒";
  }, [filtersToDisplay]);

  const amazonLink = React.useMemo(() => {
    const targetFiltro = filtersToDisplay[0];
    if (!targetFiltro?.asin) return "";
    return targetFiltro.asin.startsWith("http")
      ? targetFiltro.asin
      : `https://www.amazon.es/dp/${targetFiltro.asin}`;
  }, [filtersToDisplay]);

  return (
    <Card
      sx={{
        mb: 2,
        cursor: "pointer",
        transition: "transform 0.2s",
        "&:hover": { transform: "scale(1.03)" },
        backgroundColor: backgroundColor,
      }}
      onClick={onClick}
      data-testid="filter-card"
      aria-label="Tarjeta de filtro"
    >
      <CardContent>
        {filtersToDisplay.map((f, index) => (
          <Box key={f.id} mb={index < filtersToDisplay.length - 1 ? 2 : 0}>
            <Typography
              variant="h6"
              component="div"
              gutterBottom
              sx={{ color: "text.primary" }}
            >
              {isCombination ? `Combinación:` : `${f.marca} ${f.modelo}`}
              <FilterAltIcon sx={{ ml: 1, color: "text.secondary" }} />
            </Typography>

            {!isCombination && (
              <Chip
                label={
                  filterLevel === "recommended"
                    ? "Recomendado"
                    : filterLevel === "minimum"
                    ? "Mínimo"
                    : "No Recomendado"
                }
                color={
                  filterLevel === "recommended"
                    ? "success"
                    : filterLevel === "minimum"
                    ? "warning"
                    : "error"
                }
                sx={{ mb: 1 }}
                variant="outlined"
              />
            )}

            {index < filtersToDisplay.length - 1 && (
              <Typography variant="body2" color="text.secondary">
                Combinado con:
              </Typography>
            )}
            <Divider sx={{ my: 1 }} />
          </Box>
        ))}

        <Box display="flex" alignItems="center" mb={1}>
          <WaterIcon sx={{ mr: 1, color: "info.main" }} />
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Caudal: {combinedCaudal} l/h
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" mb={1}>
          <Typography variant="body1" sx={{ color: "text.primary", ml: 1 }}>
            🛢️ Volumen del vaso: {combinedVolumen} l
          </Typography>
        </Box>

        {amazonLinkText && (
          <Link
            href={amazonLink}
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            sx={{ mt: 1, display: "inline-block" }}
          >
            {amazonLinkText}
          </Link>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(FilterCard);