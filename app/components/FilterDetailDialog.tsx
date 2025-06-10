"use client";

import React, { useMemo, FC, ReactNode } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button, Box, Link, Tooltip, Alert, Stack, Divider, Chip, IconButton, Paper
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import {
  Water as WaterIcon, Science as ScienceIcon, Layers as LayersIcon, Category as CategoryIcon, Power as PowerIcon, Info as InfoIcon,
  Shop as ShopIcon, Public as PublicIcon, OpenInNew as OpenInNewIcon, Close as CloseIcon, ErrorOutline as ErrorOutlineIcon
} from "@mui/icons-material";
import { Filtro } from "@/types/Filtro";

// --- TIPOS ---
interface ExtendedFiltro extends Filtro {
  web_oficial?: string;
  isPair?: boolean;
  baseCaudal?: number;
  baseVolumenVaso?: number;
}

interface FilterDetailDialogProps {
  open: boolean;
  filtro: ExtendedFiltro | null;
  onClose: () => void;
}

interface DetailRowData {
  label: string;
  icon: ReactNode;
  individual: number | null;
  total: number | null;
  tooltip: string;
  isEstimated?: boolean;
  unit?: string;
}

// --- UTILIDADES ---
const formatValue = (val: number | null | undefined, fixed = 2) =>
  val != null && val !== 0 ? Number(val).toFixed(fixed).replace(/\.00$/, "") : "—";

// --- HOOK DE LÓGICA ---
const useFilterDetails = (filtro: ExtendedFiltro | null) => {
  return useMemo(() => {
    if (!filtro) return null;

    const isPair = filtro.isPair === true;
    const ESTIMATION_FACTOR = 0.5382;

    const caudalIndividual = isPair ? filtro.baseCaudal : filtro.caudal;
    const volumenIndividual = isPair ? filtro.baseVolumenVaso : filtro.volumen_vaso_filtro;
    const consumoIndividual = isPair && filtro.consumo != null ? filtro.consumo / 2 : filtro.consumo;
    const prefiltroIndividual = isPair && filtro.volumen_prefiltro != null ? filtro.volumen_prefiltro / 2 : filtro.volumen_prefiltro;
    const cestasIndividual = isPair && filtro.cestas != null ? filtro.cestas / 2 : filtro.cestas;

    let volumenRealIndividual: number | null = null;
    let isVolumenRealEstimated = false;

    if (isPair) {
      if (filtro.baseVolumenVaso != null) {
        volumenRealIndividual = filtro.baseVolumenVaso * ESTIMATION_FACTOR;
        isVolumenRealEstimated = filtro.volumen_vaso_real == null;
      }
    } else if (filtro.volumen_vaso_real != null) {
      volumenRealIndividual = filtro.volumen_vaso_real;
    } else if (filtro.volumen_vaso_filtro != null) {
      volumenRealIndividual = filtro.volumen_vaso_filtro * ESTIMATION_FACTOR;
      isVolumenRealEstimated = true;
    }
    
    const volumenRealTotal = volumenRealIndividual != null ? (isPair ? volumenRealIndividual * 2 : volumenRealIndividual) : null;

    const detailsRows: DetailRowData[] = [
      { label: "Caudal", icon: <WaterIcon color="primary" />, individual: caudalIndividual, total: filtro.caudal, tooltip: "Agua movida por hora por la bomba.", unit: "l/h" },
      { label: "Volumen vaso", icon: <ScienceIcon color="secondary" />, individual: volumenIndividual, total: filtro.volumen_vaso_filtro, tooltip: "Capacidad total del vaso filtrante.", unit: "L" },
      { label: "Volumen real", icon: <LayersIcon color="info" />, individual: volumenRealIndividual, total: volumenRealTotal, tooltip: "Volumen útil para material biológico. (Estimado si no hay dato oficial)", isEstimated: isVolumenRealEstimated, unit: "L" },
      { label: "Prefiltro", icon: <LayersIcon sx={{color: "info.light"}} />, individual: prefiltroIndividual, total: filtro.volumen_prefiltro, tooltip: "Volumen del área de pre-filtración mecánica.", unit: "L" },
      { label: "Cestas", icon: <CategoryIcon color="success" />, individual: cestasIndividual, total: filtro.cestas, tooltip: "Número de bandejas para material filtrante.", unit: "" },
      { label: "Consumo", icon: <PowerIcon color="error" />, individual: consumoIndividual, total: filtro.consumo, tooltip: "Potencia eléctrica consumida.", unit: "W" },
    ].filter(row => row.total != null); // Filtrar filas sin datos

    return { ...filtro, isPair, detailsRows };
  }, [filtro]);
};


// --- COMPONENTES DE VISTA ---
const DialogHeader: FC<{ title: ReactNode, onClose: () => void }> = ({ title, onClose }) => (
  <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2, px: 2.5 }}>
    <CategoryIcon color="primary" sx={{ fontSize: 32 }} />
    <Typography variant="h6" component="div" fontWeight={700} noWrap sx={{ flex: 1 }}>
      {title}
    </Typography>
    <IconButton onClick={onClose} aria-label="Cerrar diálogo"><CloseIcon /></IconButton>
  </DialogTitle>
);

const DetailRow: FC<{ row: DetailRowData, isPair: boolean }> = ({ row, isPair }) => (
    <Stack direction="row" alignItems="center" justifyContent="space-between" py={1.5}>
        <Tooltip title={row.tooltip} placement="right">
            <Stack direction="row" alignItems="center" gap={1.5}>
                {row.icon}
                <Typography variant="subtitle2" fontWeight={600}>{row.label}</Typography>
                {row.isEstimated && <ErrorOutlineIcon fontSize="inherit" color="warning" />}
            </Stack>
        </Tooltip>
        <Stack direction="row" spacing={2} alignItems="baseline">
            {isPair && <Typography variant="body2" color="text.secondary">{formatValue(row.individual, row.unit === 'L' ? 2 : 0)}</Typography>}
            <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{minWidth: isPair ? '50px' : 'auto', textAlign: 'right'}}>
                {formatValue(row.total, row.unit === 'L' ? 2 : 0)} {row.unit}
            </Typography>
        </Stack>
    </Stack>
);

// --- COMPONENTE PRINCIPAL ---
export default function FilterDetailDialog({ open, filtro, onClose }: FilterDetailDialogProps) {
  const processedData = useFilterDetails(filtro);

  if (!open || !processedData) return null;

  const { marca, modelo, isPair, detailsRows, otras_caracteristicas, enlace_amazon, web_oficial } = processedData;

  return (
    <Dialog PaperComponent={Paper} PaperProps={{variant: 'outlined'}} open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="filter-dialog-title">
      <DialogHeader title={<>{marca} <strong>{modelo}</strong></>} onClose={onClose} />
      
      <DialogContent sx={{ pt: 0 }}>
        {isPair && (
          <Alert severity="info" variant="outlined" icon={<InfoIcon />} sx={{ my: 1.5 }}>
            <b>Combinación de 2 filtros:</b> Se muestran valores individuales y totales.
          </Alert>
        )}
        
        {/* Tabla de detalles */}
        <Stack divider={<Divider flexItem />}>
            {isPair && (
                <Stack direction="row" justifyContent="flex-end" spacing={2} pr={1} pb={0.5}>
                    <Chip label="Individual" size="small" variant="outlined" sx={{width: '90px'}}/>
                    <Chip label="Total (×2)" size="small" color="primary" sx={{width: '90px'}}/>
                </Stack>
            )}
            {detailsRows.map((row) => (
                <DetailRow key={row.label} row={row} isPair={isPair} />
            ))}
        </Stack>
        
        {/* Otras características y enlaces */}
        <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: (theme) => alpha(theme.palette.action.hover, 0.5) }}>
            <Stack spacing={1.5}>
                {otras_caracteristicas && <Typography variant="body2" color="text.secondary"><InfoIcon fontSize="inherit" sx={{verticalAlign: 'bottom', mr:1}}/>{otras_caracteristicas}</Typography>}
                
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  {web_oficial && (
                      <Button component={Link} href={web_oficial} target="_blank" rel="noopener noreferrer" startIcon={<PublicIcon/>} size="small">
                          Web Oficial
                      </Button>
                  )}
                  {enlace_amazon && (
                      <Button component={Link} href={enlace_amazon} target="_blank" rel="noopener noreferrer" startIcon={<ShopIcon/>} size="small" color="secondary">
                          Ver en Amazon
                      </Button>
                  )}
                </Stack>
            </Stack>
        </Paper>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary" sx={{ fontWeight: 600, width: '100%' }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}