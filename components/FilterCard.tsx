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

  const filterLevel =
    liters !== undefined
      ? typeof filtro === "object" && "combination" in filtro
        ? getFilterLevel(filtro.combination[0], liters)
        : getFilterLevel(filtro as Filtro, liters)
      : null;

  const backgroundColor =
    filterLevel === "recommended"
      ? theme.palette.success.light
      : filterLevel === "minimum"
      ? theme.palette.warning.light
      : "#fff9c4"; // Fondo en tono amarillento

  const isCombination = typeof filtro === "object" && "combination" in filtro;
  const filtersToDisplay = isCombination ? filtro.combination : [filtro];

  const combinedCaudal = filtersToDisplay.reduce((acc, f) => acc + f.caudal, 0);
  const combinedVolumen = filtersToDisplay.reduce(
    (acc, f) => acc + f.volumen_vaso_filtro,
    0
  );

  const amazonLinkText =
    typeof filtro === "object" && "combination" in filtro
      ? filtro.combination[0].asin && filtro.combination[0].asin.startsWith("http")
        ? "Ver en Amazon"
        : filtro.combination[0].asin
        ? "¡Consíguelo en Amazon! 🛒"
        : ""
      : (filtro as Filtro).asin && (filtro as Filtro).asin.startsWith("http")
      ? "Ver en Amazon"
      : (filtro as Filtro).asin
      ? "¡Consíguelo en Amazon! 🛒"
      : "";

  const amazonLink =
    typeof filtro === "object" && "combination" in filtro
      ? filtro.combination[0].asin && filtro.combination[0].asin.startsWith("http")
        ? filtro.combination[0].asin
        : `https://www.amazon.es/dp/${filtro.combination[0].asin}`
      : (filtro as Filtro).asin && (filtro as Filtro).asin.startsWith("http")
      ? (filtro as Filtro).asin
      : `https://www.amazon.es/dp/${(filtro as Filtro).asin}`;

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
    >
      <CardContent>
        {filtersToDisplay.map((f, index) => (
          <Box key={f.id} mb={index < filtersToDisplay.length - 1 ? 2 : 0}>
            <Typography
              variant="h6"
              component="div"
              gutterBottom
              sx={{ color: "black" }}
            >
              {isCombination ? `Combinación:` : `${f.marca} ${f.modelo}`}
              <FilterAltIcon sx={{ ml: 1, color: "text.secondary" }} />
            </Typography>

            {isCombination ? null : (
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
              <Typography variant="body2" color="textSecondary">
                Combinado con:
              </Typography>
            )}
            <Divider sx={{ my: 1 }} />
          </Box>
        ))}

        <Box display="flex" alignItems="center" mb={1}>
          <WaterIcon sx={{ mr: 1, color: "info.main" }} />
          <Typography variant="body1" sx={{ color: "black" }}>
            Caudal: {combinedCaudal} l/h
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" mb={1}>
          🛢️
          <Typography variant="body1" sx={{ color: "black", ml: 1 }}>
            Volumen del vaso: {combinedVolumen} l
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