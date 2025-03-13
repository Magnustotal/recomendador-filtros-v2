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
  // Obtener el nivel del filtro (recomendado, mínimo o insuficiente)
  const filterLevel = liters
    ? "combination" in filtro
      ? getFilterLevel(filtro.combination[0], liters)
      : getFilterLevel(filtro as Filtro, liters)
    : null;

  let levelText = "";
  let colorScheme: "default" | "success" | "warning" | "error" = "default";

  // Determinar el texto y color del nivel
  if (filterLevel === "recommended") {
    levelText = "Recomendado";
    colorScheme = "success";
  } else if (filterLevel === "minimum") {
    levelText = "Mínimo";
    colorScheme = "warning";
  } else {
    levelText = "Insuficiente";
    colorScheme = "error";
  }

  // Determinar el texto del enlace de Amazon
  const amazonLinkText =
    "combination" in filtro
      ? filtro.combination[0].asin
        ? filtro.combination[0].asin.startsWith("http")
          ? "Ver en Amazon"
          : "¡Consíguelo en Amazon! 🛒"
        : ""
      : (filtro as Filtro).asin
      ? (filtro as Filtro).asin.startsWith("http")
        ? "Ver en Amazon"
        : "¡Consíguelo en Amazon! 🛒"
      : "";

  // Calcular el caudal combinado si es una combinación de filtros
  const combinedCaudal =
    "combination" in filtro
      ? filtro.combination.reduce((acc, f) => acc + f.caudal, 0)
      : (filtro as Filtro).caudal;

  // Calcular el volumen combinado si es una combinación de filtros
  const combinedVolumen =
    "combination" in filtro
      ? filtro.combination.reduce((acc, f) => acc + f.volumen_vaso_filtro, 0)
      : (filtro as Filtro).volumen_vaso_filtro;

  // Color de fondo según el nivel del filtro
  const backgroundColor =
    filterLevel === "recommended"
      ? "rgba(0, 255, 0, 0.1)" // Tono verdoso
      : filterLevel === "minimum"
      ? "rgba(255, 255, 0, 0.1)" // Tono amarillento
      : "transparent";

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
          backgroundColor: filterLevel === "recommended"
            ? "rgba(0, 255, 0, 0.2)"
            : filterLevel === "minimum"
            ? "rgba(255, 255, 0, 0.2)"
            : "rgba(0, 0, 0, 0.05)",
        },
      }}
    >
      {/* Mostrar marca o "Combinación" según el tipo de filtro */}
      <TableCell component="th" scope="row">
        {"combination" in filtro ? "Combinación" : (filtro as Filtro).marca}
      </TableCell>

      {/* Mostrar el modelo o una lista de modelos combinados */}
      <TableCell align="center">
        {"combination" in filtro
          ? filtro.combination.map((f) => `${f.modelo}`).join(" + ")
          : (filtro as Filtro).modelo}
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
              href={
                "combination" in filtro
                  ? filtro.combination[0].asin.startsWith("http")
                    ? filtro.combination[0].asin
                    : `https://www.amazon.es/dp/${filtro.combination[0].asin}`
                  : (filtro as Filtro).asin.startsWith("http")
                  ? (filtro as Filtro).asin
                  : `https://www.amazon.es/dp/${(filtro as Filtro).asin}`
              }
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