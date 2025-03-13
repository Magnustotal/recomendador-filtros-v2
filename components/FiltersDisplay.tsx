import React, { useState, useCallback } from "react";
import { Filtro } from "@/types/Filtro";
import FilterCard from "./FilterCard";
import { getFilterLevel } from "@/lib/filters";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  tableCellClasses,
} from "@mui/material";
import FilterTableRow from "./FilterTableRow";

interface FiltersDisplayProps {
  filters: (Filtro | { combination: Filtro[] })[]; // Filtros individuales o combinaciones de filtros
  displayMode: "cards" | "table"; // Modo de visualización: tarjetas o tabla
  liters?: number; // Litros del acuario (opcional)
  onFilterClick: (filter: Filtro | { combination: Filtro[] }) => void; // Acción cuando se hace clic en un filtro
}

// Componente para mostrar los filtros en diferentes modos
const FiltersDisplay: React.FC<FiltersDisplayProps> = ({
  filters,
  displayMode,
  liters,
  onFilterClick,
}) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Filtro | null; // Clave para ordenar
    direction: "ascending" | "descending"; // Dirección de la ordenación
  }>({ key: null, direction: "ascending" });

  // Función para ordenar los filtros según una clave
  const sortFilters = useCallback(
    (filters: (Filtro | { combination: Filtro[] })[]) => {
      const sorted = [...filters];
      sorted.sort((a, b) => {
        const keyA = getKey(a);
        const keyB = getKey(b);

        if (keyA !== null && keyB !== null) {
          if (keyA < keyB) {
            return sortConfig.direction === "ascending" ? -1 : 1;
          }
          if (keyA > keyB) {
            return sortConfig.direction === "ascending" ? 1 : -1;
          }
        }

        // Si no se especifica clave, ordenamos por caudal
        const caudalA = getCaudal(a);
        const caudalB = getCaudal(b);
        return caudalA - caudalB;
      });
      return sorted;
    },
    [sortConfig]
  );

  // Función para obtener el valor de la clave de ordenación
  const getKey = useCallback((item: Filtro | { combination: Filtro[] }) => {
    if ("combination" in item) {
      return item.combination[0]?.marca; // Extraemos la marca de la combinación de filtros
    }
    return item.marca; // Extraemos la marca del filtro individual
  }, []);

  // Función para obtener el caudal total de un filtro o combinación
  const getCaudal = useCallback((item: Filtro | { combination: Filtro[] }) => {
    if ("combination" in item) {
      return item.combination.reduce((acc, curr) => acc + curr.caudal, 0); // Sumar caudales si es combinación
    }
    return item.caudal; // Caudal de un filtro individual
  }, []);

  const sortedFilters = sortFilters(filters);

  // Función para cambiar el orden de los filtros según la columna
  const requestSort = (key: keyof Filtro) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Obtener el icono de ordenación según la dirección
  const getSortIcon = (key: keyof Filtro) => {
    if (sortConfig.key !== key) {
      return "↕️";
    }
    return sortConfig.direction === "ascending" ? "⬆️" : "⬇️";
  };

  // Mostrar filtros como tarjetas
  if (displayMode === "cards") {
    return (
      <div>
        {sortedFilters.map((filtro) => (
          <FilterCard
            key={
              "combination" in filtro
                ? filtro.combination[0].id // Si es una combinación, usamos el ID del primer filtro
                : (filtro as Filtro).id // Si es un filtro individual, usamos su ID
            }
            filtro={filtro}
            liters={liters}
            onClick={() => onFilterClick(filtro)}
          />
        ))}
      </div>
    );
  }

  // Mostrar filtros en forma de tabla
  if (displayMode === "table") {
    return (
      <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
        <Table
          sx={{
            width: "100%",
            borderCollapse: "collapse",
            [`& .${tableCellClasses.root}`]: {
              border: 1,
              borderColor: "divider",
              px: 2,
              py: 1,
            },
            "& .MuiTableCell-head": {
              backgroundColor: "primary.main",
              color: "primary.contrastText",
              fontWeight: "bold",
              cursor: "pointer",
              textAlign: "center",
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell onClick={() => requestSort("marca")}>
                Marca {getSortIcon("marca")}
              </TableCell>
              <TableCell onClick={() => requestSort("modelo")}>
                Modelo {getSortIcon("modelo")}
              </TableCell>
              <TableCell onClick={() => requestSort("caudal")}>
                Caudal (l/h) {getSortIcon("caudal")}
              </TableCell>
              <TableCell onClick={() => requestSort("volumen_vaso_filtro")}>
                Volumen del Vaso (l) {getSortIcon("volumen_vaso_filtro")}
              </TableCell>
              <TableCell>Cumple</TableCell>
              <TableCell>Amazon</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedFilters.map((filtro) => (
              <FilterTableRow
                key={
                  "combination" in filtro
                    ? filtro.combination.map((f) => f.id).join("-") // ID de la combinación de filtros
                    : (filtro as Filtro).id // ID de un filtro individual
                }
                filtro={filtro}
                liters={liters}
                onClick={() => onFilterClick(filtro)}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return <div>Modo de visualización no implementado</div>;
};

export default React.memo(FiltersDisplay);