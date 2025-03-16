"use client";
import React from "react";
import { Filtro } from "@/types/Filtro";
import { getFilterLevel } from "@/lib/filters";
import { TableRow, TableCell, Link, Chip, Box, Tooltip } from "@mui/material";

interface FilterTableRowProps {
  filtro: Filtro | { combination: Filtro[] };
  liters?: number;
  onClick: () => void;
}

// Componente para mostrar una fila de la tabla de filtros
const FilterTableRow: React.FC<FilterTableRowProps> = ({
  filtro,
  liters,
  onClick,
}) => {
  // Determinar si es una combinación de filtros
  const isCombination = "combination" in filtro;
  const filtersToDisplay = isCombination ? filtro.combination : [filtro];

  // Obtener el nivel del filtro (recomendado, mínimo o insuficiente)
  const filterLevel = React.useMemo(() => {
    if (!liters) return null;
    return getFilterLevel(filtersToDisplay[0], liters);
  }, [filtersToDisplay, liters]);

  // Texto y color del nivel del filtro
  const { levelText, colorScheme } = React.useMemo(() => {
    switch (filterLevel) {
      case "recommended":
        return { levelText: "Recomendado", colorScheme: "success" as const };
      case "minimum":
        return { levelText: "Mínimo", colorScheme: "warning" as const };
      default:
        return { levelText: "Insuficiente", colorScheme: "error" as const };
    }
  }, [filterLevel]);

  // Texto y enlace de Amazon
  const { amazonLinkText, amazonLink } = React.useMemo(() => {
    const targetFiltro = filtersToDisplay[0];
    if (!targetFiltro?.asin) return { amazonLinkText: "", amazonLink: "" };

    const linkText = targetFiltro.asin.startsWith("http")
      ? "Ver en Amazon"
      : "¡Consíguelo en Amazon! 🛒";

    const link = targetFiltro.asin.startsWith("http")
      ? targetFiltro.asin
      : `https://www.amazon.es/dp/${targetFiltro.asin}`;

    return { amazonLinkText: linkText, amazonLink: link };
  }, [filtersToDisplay]);

  // Calcular el caudal y volumen combinados
  const combinedCaudal = filtersToDisplay.reduce((acc, f) => acc + f.caudal, 0);
  const combinedVolumen = filtersToDisplay.reduce(
    (acc, f) => acc + f.volumen_vaso_filtro,
    0
  );

  // Color de fondo según el nivel del filtro
  const backgroundColor = React.useMemo(() => {
    switch (filterLevel) {
      case "recommended":
        return "rgba(0, 255, 0, 0.1)"; // Tono verdoso
      case "minimum":
        return "rgba(255, 255, 0, 0.1)"; // Tono amarillento
      default:
        return "transparent";
    }
  }, [filterLevel]);

  return (
    <TableRow
      onClick={onClick}
      hover // Efecto hover para hacer la fila interactiva
      sx={{
        "&:last-child td, &:last-child th": { border: 0 },
        cursor: "pointer",
        backgroundColor: backgroundColor,
        borderBottom: "2px solid rgba(0, 0, 0, 0.12)", // Márgenes más gruesos
        transition: "background-color 0.2s",
        "&:hover": {
          backgroundColor:
            filterLevel === "recommended"
              ? "rgba(0, 255, 0, 0.2)"
              : filterLevel === "minimum"
              ? "rgba(255, 255, 0, 0.2)"
              : "rgba(0, 0, 0, 0.05)",
        },
      }}
      aria-label={`Fila de filtro: ${isCombination ? "Combinación" : filtro.marca}`}
    >
      {/* Mostrar marca o "Combinación" según el tipo de filtro */}
      <TableCell component="th" scope="row">
        {isCombination ? "Combinación" : filtro.marca}
      </TableCell>

      {/* Mostrar el modelo o una lista de modelos combinados */}
      <TableCell align="center">
        {isCombination
          ? filtersToDisplay.map((f) => f.modelo).join(" + ")
          : filtro.modelo}
      </TableCell>

      {/* Mostrar caudal combinado */}
      <TableCell align="center">{combinedCaudal}</TableCell>

      {/* Mostrar volumen combinado */}
      <TableCell align="center">{combinedVolumen}</TableCell>

      {/* Mostrar el nivel del filtro como un Chip */}
      <TableCell align="center">
        <Chip label={levelText} color={colorScheme} variant="outlined" />
      </TableCell>

      {/* Enlace a Amazon si está disponible */}
      <TableCell align="center">
        {amazonLinkText && (
          <Tooltip title="Comprar en Amazon">
            <Link
              href={amazonLink}
              target="_blank"
              rel="noopener noreferrer"
              color="primary"
              underline="hover"
            >
              {amazonLinkText}
            </Link>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
};

export default React.memo(FilterTableRow);