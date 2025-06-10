"use client";

import React, { useReducer, useRef, useEffect, FC, useCallback } from "react";
import { Box, Button, TextField, Paper, Typography, Tabs, Tab, Divider, Fade, Tooltip, Chip, Stack, Zoom, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import OpacityIcon from "@mui/icons-material/Opacity";
import StraightenIcon from "@mui/icons-material/Straighten";
import CalculateIcon from "@mui/icons-material/Calculate";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import { motion } from "framer-motion";

// --- Constantes y Lógica de Negocio ---
const ACUARIO_TIPICOS = [20, 30, 60, 90, 120, 200, 240, 300, 450];
const numberOnly = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1");

function validateField(name: keyof FormState['medidas'] | 'litros', value: string): string {
    const numValue = parseFloat(value);
    if (!value) return "Este campo es requerido.";
    if (isNaN(numValue) || numValue <= 0) return "Debe ser un número positivo.";
    if (name === 'litros' && numValue > 5000) return "Valor demasiado grande.";
    if (name !== 'litros' && numValue > 500) return "Medida demasiado grande.";
    return "";
}

// --- Tipos y Estado con Reducer ---
type Mode = "litros" | "medidas";
interface FormState {
  mode: Mode;
  values: { litros: string; largo: string; ancho: string; alto: string; };
  errors: { litros: string; largo: string; ancho: string; alto: string; };
  resultadoMedidas: number | null;
  pasteError: string;
}

type FormAction =
  | { type: "SET_MODE"; payload: Mode }
  | { type: "CHANGE_VALUE"; payload: { field: keyof FormState['values']; value: string } }
  | { type: "PASTE_MEDIDAS"; payload: { largo: string; ancho: string; alto: string } }
  | { type: "SET_PASTE_ERROR"; payload: string }
  | { type: "SET_RESULTADO_MEDIDAS"; payload: number | null }
  | { type: "RESET" };

const initialState: FormState = {
  mode: "litros",
  values: { litros: "", largo: "", ancho: "", alto: "" },
  errors: { litros: "", largo: "", ancho: "", alto: "" },
  resultadoMedidas: null,
  pasteError: "",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_MODE":
      return { ...initialState, mode: action.payload };
    case "CHANGE_VALUE": {
      const { field, value } = action.payload;
      const error = validateField(field, value);
      return {
        ...state,
        values: { ...state.values, [field]: value },
        errors: { ...state.errors, [field]: error },
        pasteError: "", // Limpiar error de pegado al escribir
      };
    }
    case "PASTE_MEDIDAS":
      return { ...state, values: { ...state.values, ...action.payload }, errors: initialState.errors, pasteError: "" };
    case "SET_PASTE_ERROR":
      return { ...state, pasteError: action.payload };
    case "SET_RESULTADO_MEDIDAS":
      return { ...state, resultadoMedidas: action.payload };
    case "RESET":
      return { ...initialState, mode: state.mode };
    default:
      return state;
  }
}

// --- Componentes Estilizados ---
const FormWrapper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3, 4),
    backdropFilter: "blur(10px)",
    [theme.breakpoints.down("sm")]: {
        padding: theme.spacing(3, 2),
    },
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  "& .MuiTab-root": {
    minHeight: 52,
    fontWeight: 700,
  },
}));

// --- Sub-componentes de Paneles ---
interface PanelProps {
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  onSubmit: (litros: number) => void;
}

const LitrosPanel: FC<PanelProps> = ({ state, dispatch, onSubmit }) => {
  const litrosRef = useRef<HTMLInputElement>(null);
  useEffect(() => { litrosRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const error = validateField('litros', state.values.litros);
    if (!error) {
      onSubmit(parseFloat(state.values.litros));
    } else {
        dispatch({ type: "CHANGE_VALUE", payload: { field: 'litros', value: state.values.litros } });
    }
  };

  return (
    <Fade in>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Typography variant="subtitle1" color="text.secondary" fontWeight={500} mb={2}>
          Introduce el volumen total de tu acuario en litros.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-start">
          <TextField fullWidth
            label="Litros del acuario"
            type="number"
            value={state.values.litros}
            onChange={(e) => dispatch({ type: "CHANGE_VALUE", payload: { field: 'litros', value: numberOnly(e.target.value) } })}
            error={!!state.errors.litros}
            helperText={state.errors.litros || "Ej: 120 (típico: 60, 120, 240...)"}
            inputRef={litrosRef}
            inputProps={{ min: 1, step: "any", pattern: "\\d*", inputMode: "decimal" }}
            required
          />
          <Button type="submit" variant="contained" size="large" startIcon={<CalculateIcon />} sx={{ fontWeight: 700, width: { xs: "100%", sm: "auto" } }}>
            Calcular
          </Button>
        </Stack>
        {!state.errors.litros && ACUARIO_TIPICOS.includes(Number(state.values.litros)) && (
          <Chip label="Volumen típico" color="success" size="small" variant="outlined" sx={{ mt: 1.5, fontWeight: 600 }} />
        )}
      </Box>
    </Fade>
  );
};

const MedidasPanel: FC<PanelProps> = ({ state, dispatch, onSubmit }) => {
    const largoRef = useRef<HTMLInputElement>(null);
    useEffect(() => { largoRef.current?.focus(); }, []);

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const parts = text.match(/\d+(\.\d+)?/g);
            if (parts && parts.length >= 3) {
                dispatch({ type: "PASTE_MEDIDAS", payload: { largo: parts[0], ancho: parts[1], alto: parts[2] } });
            } else {
                dispatch({ type: "SET_PASTE_ERROR", payload: "No se detectaron 3 medidas válidas." });
            }
        } catch {
            dispatch({ type: "SET_PASTE_ERROR", payload: "No se pudo acceder al portapapeles." });
        }
    };
    
    // Calcula automáticamente cuando cambian los valores
    useEffect(() => {
        const { largo, ancho, alto } = state.values;
        const [l, a, h] = [parseFloat(largo), parseFloat(ancho), parseFloat(alto)];
        const hasErrors = !!(state.errors.largo || state.errors.ancho || state.errors.alto);

        if (!hasErrors && [l, a, h].every(n => n > 0)) {
            const litrosCalculados = Math.round((l * a * h) / 1000);
            dispatch({ type: "SET_RESULTADO_MEDIDAS", payload: litrosCalculados });
        } else {
            dispatch({ type: "SET_RESULTADO_MEDIDAS", payload: null });
        }
    }, [state.values, state.errors, dispatch]);

  return (
    <Fade in>
      <Box>
        <Typography variant="subtitle1" color="text.secondary" fontWeight={500} mb={2}>
          Introduce las <b>medidas interiores</b> del acuario (en cm).
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
            {(['largo', 'ancho', 'alto'] as const).map((key) => (
                <TextField fullWidth key={key}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    value={state.values[key]}
                    onChange={(e) => dispatch({ type: "CHANGE_VALUE", payload: { field: key, value: numberOnly(e.target.value) }})}
                    error={!!state.errors[key]}
                    helperText={state.errors[key]}
                    type="number"
                    inputRef={key === "largo" ? largoRef : null}
                    inputProps={{ min: 1, step: "any", pattern: "\\d*", inputMode: "decimal" }}
                    required
                />
            ))}
            <Tooltip title="Pegar medidas (ej: 100x40x50)" arrow>
                <IconButton size="large" color="primary" onClick={handlePaste} aria-label="Pegar medidas">
                    <ContentPasteIcon />
                </IconButton>
            </Tooltip>
        </Stack>
        {state.pasteError && <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }} role="alert">{state.pasteError}</Typography>}
        
        <Zoom in={state.resultadoMedidas !== null}>
            <Stack direction="row" spacing={2} alignItems="center" mt={2} p={1.5} bgcolor="action.hover" borderRadius={2}>
                <Typography fontWeight="bold" flexGrow={1}>Volumen: {state.resultadoMedidas} litros</Typography>
                <Button variant="contained" onClick={() => onSubmit(state.resultadoMedidas!)} disabled={state.resultadoMedidas === null}>
                    Usar este volumen
                </Button>
            </Stack>
        </Zoom>
      </Box>
    </Fade>
  );
};


// --- Componente Principal ---
const CalculationForm: FC<{ onLitrosSubmit: (litros: number) => void }> = ({ onLitrosSubmit }) => {
  const [state, dispatch] = useReducer(formReducer, initialState);

  return (
    <Box maxWidth={500} mx="auto" my={4} px={{ xs: 1, sm: 2 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
        <FormWrapper variant="outlined">
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
            <StyledTabs value={state.mode} onChange={(_, value) => dispatch({ type: "SET_MODE", payload: value })} aria-label="Modo de cálculo">
              <Tab label={<Stack direction="row" alignItems="center" spacing={1}><OpacityIcon />Litros</Stack>} value="litros" id="litros-tab" />
              <Tab label={<Stack direction="row" alignItems="center"spacing={1}><StraightenIcon />Medidas</Stack>} value="medidas" id="medidas-tab" />
            </StyledTabs>
            <Stack direction="row" gap={0.5}>
              <Tooltip title="Mide el interior del acuario (cm): largo × ancho × alto / 1000 = litros." arrow>
                <IconButton color="info" aria-label="Ayuda sobre medidas"><HelpOutlineIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Limpiar formulario" arrow>
                <IconButton color="secondary" onClick={() => dispatch({ type: "RESET" })} aria-label="Limpiar formulario"><RestartAltIcon /></IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          <Divider sx={{ mb: 2.5 }} />

          {state.mode === "litros" ? (
            <LitrosPanel state={state} dispatch={dispatch} onSubmit={onLitrosSubmit} />
          ) : (
            <MedidasPanel state={state} dispatch={dispatch} onSubmit={onLitrosSubmit} />
          )}
        </FormWrapper>
      </motion.div>
    </Box>
  );
};

export default CalculationForm;