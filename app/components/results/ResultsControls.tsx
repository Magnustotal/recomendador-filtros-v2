"use client";

import React from 'react';
import { Tabs, Tab, Box, FormControl, InputLabel, Select, MenuItem, Chip, Stack } from "@mui/material";
import { CheckCircle as CheckCircleIcon, WarningAmber as WarningAmberIcon, Person as PersonIcon, Group as GroupIcon, Sort as SortIcon } from "@mui/icons-material";

const sortOptions = [
  { value: "caudal", label: "Caudal" },
  { value: "volumen", label: "Volumen" },
  { value: "marca", label: "Marca" },
  { value: "modelo", label: "Modelo" },
];

interface ResultsControlsProps {
  mainTab: number;
  setMainTab: (value: number) => void;
  subTab: number;
  setSubTab: (value: number) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  counts: { recommended: number; minimum: number; recInd: number; recPair: number; minInd: number; minPair: number };
}

export const ResultsControls: React.FC<ResultsControlsProps> = ({ mainTab, setMainTab, subTab, setSubTab, sortBy, setSortBy, counts }) => (
  <Stack spacing={2} sx={{ p: 2 }}>
    {/* Main Tabs */}
    <Stack direction={{xs: 'column', md: 'row'}} justifyContent="space-between" alignItems="center" spacing={2}>
      <Tabs
        value={mainTab}
        onChange={(_, v) => setMainTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Nivel de recomendación"
        sx={{ borderBottom: 1, borderColor: 'divider', minWidth: 0, maxWidth: '100%' }}
      >
        <Tab icon={<CheckCircleIcon color="success" />} iconPosition="start" label={`Recomendados (${counts.recommended})`} />
        <Tab icon={<WarningAmberIcon color="warning" />} iconPosition="start" label={`Mínimos (${counts.minimum})`} />
      </Tabs>
      <FormControl sx={{ minWidth: 180, width: { xs: '100%', md: 'auto' } }}>
        <InputLabel id="sort-by-label">Ordenar por</InputLabel>
        <Select labelId="sort-by-label" value={sortBy} label="Ordenar por" onChange={(e) => setSortBy(e.target.value)} startAdornment={<SortIcon sx={{mr:1}}/>}>
          {sortOptions.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
        </Select>
      </FormControl>
    </Stack>
    {/* Sub Tabs */}
    <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Tipo de filtro">
      <Tab icon={<PersonIcon />} iconPosition="start" label={`Individual (${mainTab === 0 ? counts.recInd : counts.minInd})`} />
      <Tab icon={<GroupIcon />} iconPosition="start" label={`Combinación ×2 (${mainTab === 0 ? counts.recPair : counts.minPair})`} />
    </Tabs>
  </Stack>
);