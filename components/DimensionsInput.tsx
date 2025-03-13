import React, { useState, useEffect, useCallback } from "react";
import { TextField, Box, Typography, Grid, Paper } from "@mui/material";

interface DimensionsInputProps {
  onLitersChange: (liters: number | undefined) => void;
}

// Componente para ingresar las dimensiones del acuario y calcular el volumen
const DimensionsInput: React.FC<DimensionsInputProps> = ({ onLitersChange }) => {
  const [length, setLength] = useState<number | undefined>();
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [calculatedLiters, setCalculatedLiters] = useState<number | undefined>();

  useEffect(() => {
    if (length && width && height) {
      if (
        Number.isInteger(length) &&
        length > 0 &&
        Number.isInteger(width) &&
        width > 0 &&
        Number.isInteger(height) &&
        height > 0
      ) {
        const liters = (length * width * height) / 1000;
        setCalculatedLiters(liters);
        onLitersChange(liters);
        setError(null);
      } else {
        setError("Introduce números enteros positivos.");
        onLitersChange(undefined);
        setCalculatedLiters(undefined);
      }
    } else {
      onLitersChange(undefined);
      setError(null);
      setCalculatedLiters(undefined);
    }
  }, [length, width, height, onLitersChange]);

  const handleChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<number | undefined>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value === "" ? undefined : parseInt(e.target.value, 10));
    },
    []
  );

  return (
    <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
      <Typography variant="h6" gutterBottom align="center">
        Ingresar Dimensiones del Acuario
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            type="number"
            label="Largo (cm)"
            value={length === undefined ? "" : length}
            onChange={handleChange(setLength)}
            variant="outlined"
            fullWidth
            margin="normal"
            inputProps={{ min: 1, step: "1" }}
            error={Boolean(error)}
            helperText={error ? error : ""}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            type="number"
            label="Ancho (cm)"
            value={width === undefined ? "" : width}
            onChange={handleChange(setWidth)}
            variant="outlined"
            fullWidth
            margin="normal"
            inputProps={{ min: 1, step: "1" }}
            error={Boolean(error)}
            helperText={error ? error : ""}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            type="number"
            label="Alto (cm)"
            value={height === undefined ? "" : height}
            onChange={handleChange(setHeight)}
            variant="outlined"
            fullWidth
            margin="normal"
            inputProps={{ min: 1, step: "1" }}
            error={Boolean(error)}
            helperText={error ? error : ""}
          />
        </Grid>
      </Grid>
      {calculatedLiters !== undefined && (
        <Typography variant="body1" align="center" paragraph sx={{ mt: 2 }}>
          Volumen Calculado: {calculatedLiters} litros 🧮
        </Typography>
      )}
    </Paper>
  );
};

export default DimensionsInput;