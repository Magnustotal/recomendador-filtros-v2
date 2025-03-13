"use client";
import React from "react";
import { Filtro } from "@/types/Filtro";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Typography,
  Link,
  Box,
  Divider,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LocalMallIcon from "@mui/icons-material/LocalMall";
import { getFilterLevel } from "@/lib/filters";

interface FilterDetailsProps {
  filter: Filtro | { combination: Filtro[] }; // El filtro puede ser uno solo o una combinación de filtros
  onClose: () => void; // Función para cerrar el diálogo
  liters?: number; // Litros del acuario para verificar requisitos
}

// Componente para mostrar los detalles de un filtro
const FilterDetails: React.FC<FilterDetailsProps> = ({
  filter,
  onClose,
  liters,
}) => {
  if (!filter) return null; // Si no hay filtro, no mostrar nada

  const isCombination = "combination" in filter; // Verificar si es una combinación de filtros
  const filtersToDisplay = isCombination ? filter.combination : [filter]; // Selecciona los filtros a mostrar

  // Función para mostrar valores o "Sin datos" si no están definidos
  const displayValue = (value: any) => value ?? "Sin datos"; // Si el valor es nulo o indefinido, mostrar "Sin datos"

  // Función para calcular las cargas del filtro
  const calculateLoad = (filtro: Filtro, percentage: number, useRealVolume: boolean) => {
    const baseVolume = useRealVolume && filtro.volumen_vaso_real
      ? filtro.volumen_vaso_real
      : filtro.cestas && filtro.cestas > 0
      ? filtro.volumen_vaso_filtro * 0.59
      : filtro.volumen_vaso_filtro * 0.835; // Estimación del volumen
    return baseVolume ? (baseVolume * percentage).toFixed(1) : "N/D"; // Devuelve el cálculo o "N/D" si no se puede calcular
  };

  // Función para calcular la carga biológica o mecánica con un tooltip para valores estimados
  const calculateEstimatedLoad = (filtro: Filtro, percentage: number, useRealVolume: boolean) => {
    const baseVolume = useRealVolume && filtro.volumen_vaso_real
      ? filtro.volumen_vaso_real
      : filtro.cestas && filtro.cestas > 0
      ? filtro.volumen_vaso_filtro * 0.59
      : filtro.volumen_vaso_filtro * 0.835; // Estimación del volumen
    const estimated = baseVolume ? (baseVolume * percentage).toFixed(1) : "N/D";
    return (
      <Tooltip title="Valor estimado basado en el volumen del vaso">
        <span>{estimated} l</span>
      </Tooltip>
    );
  };

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 0 }}>
        <Typography variant="h5" component="span">🗂️ Ficha Técnica</Typography>
        <Button color="inherit" onClick={onClose} aria-label="Cerrar" sx={{ padding: 0 }}>
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent>
        {filtersToDisplay.map((f, index) => (
          <React.Fragment key={`filter-${index}`}>
            {isCombination && (
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="h6" component="span">
                  Filtro {index + 1} de {filtersToDisplay.length}
                  <Divider sx={{ mt: 1, mb: 1, borderWidth: 2 }} />
                </Typography>
              </Box>
            )}
            {!isCombination && (
              <Box sx={{ mt: 2, mb: 1 }}>
                <Typography variant="h6" component="span">
                  {f.marca} {f.modelo}
                  <Divider sx={{ mt: 1, mb: 1, borderWidth: 2 }} />
                </Typography>
              </Box>
            )}
            <TableContainer component={Paper} elevation={0} variant="outlined">
              <Table size="small" aria-label="detalles del filtro">
                <TableBody>
                  {/* Filas con detalles del filtro */}
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>🏢 Marca</TableCell>
                    <TableCell align="right">{displayValue(f.marca)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>🏷️ Modelo</TableCell>
                    <TableCell align="right">{displayValue(f.modelo)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>💧 Caudal</TableCell>
                    <TableCell align="right">{displayValue(f.caudal)} l/h</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>🛢️ Volumen del Vaso</TableCell>
                    <TableCell align="right">{displayValue(f.volumen_vaso_filtro)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>🛡️ Capacidad del Prefiltro</TableCell>
                    <TableCell align="right">{displayValue(f.volumen_prefiltro) || "No tiene"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>📏 Volumen Vaso Real</TableCell>
                    <TableCell align="right">
                      {f.volumen_vaso_real 
                        ? `${displayValue(f.volumen_vaso_real)} l` 
                        : calculateEstimatedLoad(f, 0.59, false)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>🧺 Número de Cestas</TableCell>
                    <TableCell align="right">{displayValue(f.cestas) || "No tiene"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>⚡ Consumo</TableCell>
                    <TableCell align="right">{displayValue(f.consumo)} W</TableCell>
                  </TableRow>

                  {/* Cargas recomendadas */}
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                      🦠 Carga Biológica Recomendada
                    </TableCell>
                    <TableCell align="right">
                      {f.volumen_vaso_real 
                        ? `${(f.volumen_vaso_real * 0.9).toFixed(1)} l` 
                        : calculateEstimatedLoad(f, 0.9, false)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>
                      ⚙️ Carga Mecánica Recomendada
                    </TableCell>
                    <TableCell align="right">
                      {f.volumen_vaso_real 
                        ? `${(f.volumen_vaso_real * 0.1).toFixed(1)} l` 
                        : calculateEstimatedLoad(f, 0.1, false)}
                    </TableCell>
                  </TableRow>

                  {/* Verificación de requisitos */}
                  {liters && (
                    <TableRow>
                      <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>✅ Cumple Requisitos</TableCell>
                      <TableCell align="right">
                        {getFilterLevel(f, liters) === "recommended" ? "Recomendado ✅" : 
                         getFilterLevel(f, liters) === "minimum" ? "Mínimo ⚠️" : "No recomendado ❌"}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Enlace de compra en Amazon */}
                  {f.asin && (
                    <TableRow>
                      <TableCell component="th" scope="row" sx={{ fontWeight: 'bold' }}>🛒 Enlace de compra</TableCell>
                      <TableCell align="right">
                        <Link
                          href={f.asin.startsWith("http") ? f.asin : `https://www.amazon.es/dp/${f.asin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="primary"
                          underline="hover"
                        >
                          <LocalMallIcon sx={{ mr: 1, verticalAlign: "middle" }} />
                          ¡Cómpralo aquí!
                        </Link>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </React.Fragment>
        ))}
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(FilterDetails);