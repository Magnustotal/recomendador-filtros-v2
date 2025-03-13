"use client";
import { useState, useEffect, useCallback } from "react";
import { Box, Button, TextField, Alert, Typography } from "@mui/material";

interface FilterFormProps {
  onSubmit: (liters: number) => void;
  onLitersChange?: (liters: number | undefined) => void; // Prop opcional
  showSubmitButton: boolean;
}

// Componente para el formulario de filtro
const FilterForm: React.FC<FilterFormProps> = ({
  onSubmit,
  onLitersChange,
  showSubmitButton,
}) => {
  const [inputMode, setInputMode] = useState<"liters" | "dimensions" | null>(null); // Estado que indica si se está trabajando con litros o dimensiones
  const [liters, setLiters] = useState<number | undefined>(); // Litros del acuario
  const [width, setWidth] = useState<number | undefined>(); // Ancho en cm
  const [height, setHeight] = useState<number | undefined>(); // Alto en cm
  const [depth, setDepth] = useState<number | undefined>(); // Profundidad en cm
  const [error, setError] = useState<string | null>(null); // Para manejar errores
  const [calculatedLiters, setCalculatedLiters] = useState<number | undefined>(); // Litros calculados a partir de las dimensiones

  // Efecto para calcular el volumen del acuario cuando se cambian las dimensiones
  useEffect(() => {
    if (inputMode === "dimensions" && width && height && depth) {
      const liters = (width * height * depth) / 1000; // Cálculo del volumen en litros
      setCalculatedLiters(liters);
      if (onLitersChange) {
        onLitersChange(liters); // Actualiza el estado en el componente padre
      }
    } else {
      setCalculatedLiters(undefined); // Si no hay dimensiones, no calculamos litros
    }
  }, [width, height, depth, inputMode, onLitersChange]);

  // Maneja el cambio en el campo de litros
  const handleLitersChange = useCallback((value: string) => {
    if (value === "" || /^[0-9]*$/.test(value)) { // Permitir vacío o solo números enteros
      const newLiters = value === "" ? undefined : parseInt(value, 10);
      setLiters(newLiters);
      if (onLitersChange) {
        onLitersChange(newLiters); // Notificamos el cambio de litros
      }
      setError(null); // Limpiar errores anteriores
    } else {
      setError('Por favor, introduce un número entero positivo.'); // Mensaje de error si no es un número
    }
  }, [onLitersChange]);

  // Maneja el cambio en las dimensiones del acuario
  const handleWidthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setWidth(value === "" ? undefined : parseInt(value, 10)); // Si el campo está vacío, lo ponemos en undefined
    setError(null);
  }, []);

  const handleHeightChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setHeight(value === "" ? undefined : parseInt(value, 10));
    setError(null);
  }, []);

  const handleDepthChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDepth(value === "" ? undefined : parseInt(value, 10));
    setError(null);
  }, []);

  // Maneja el envío del formulario
  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (inputMode === "liters" && liters !== undefined) {
      onSubmit(liters); // Si estamos trabajando con litros, enviamos ese valor
    } else if (
      inputMode === "dimensions" &&
      width !== undefined &&
      height !== undefined &&
      depth !== undefined
    ) {
      onSubmit((width * height * depth) / 1000); // Si estamos trabajando con dimensiones, calculamos los litros y los enviamos
    } else {
      setError("Por favor, introduce el litraje o las dimensiones."); // Mensaje de error si no se ha introducido nada
    }
  }, [inputMode, liters, width, height, depth, onSubmit]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        "& .MuiTextField-root": { m: 1, width: "25ch" }, // Estilos para los campos de texto
      }}
      noValidate
      autoComplete="off"
    >
      {error && ( // Mostrar mensaje de error si hay algún problema
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Botones para elegir entre litros o dimensiones */}
      <Box textAlign="center" mb={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setInputMode("liters")}
          sx={{ mr: 2 }}
        >
          Introducir Litros
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setInputMode("dimensions")}
        >
          Introducir Dimensiones
        </Button>
      </Box>

      {inputMode === "liters" && ( // Si estamos trabajando con litros
        <>
          <TextField
            type="number"
            label="Litros del Acuario"
            value={liters === undefined ? "" : liters}
            onChange={(e) => handleLitersChange(e.target.value)}
            variant="outlined"
            fullWidth
            margin="normal"
            inputProps={{ min: 0, step: "1" }} // Permite solo enteros positivos
            error={Boolean(error)}
          />
          {calculatedLiters !== undefined && ( // Mostrar el cálculo de litros si está disponible
            <Typography variant="body1" align="center" paragraph>
              Volumen Calculado: {calculatedLiters} litros 🧮
            </Typography>
          )}
        </>
      )}

      {inputMode === "dimensions" && ( // Si estamos trabajando con dimensiones
        <>
          <TextField
            type="number"
            label="Largo (cm)"
            value={width || ""}
            onChange={handleWidthChange}
            variant="outlined"
            fullWidth
            margin="normal"
            inputProps={{ min: 1, step: "1" }} // Permite solo números positivos
            error={Boolean(error)}
          />
          <TextField
            type="number"
            label="Ancho (cm)"
            value={height || ""}
            onChange={handleHeightChange}
            variant="outlined"
            fullWidth
            margin="normal"
            inputProps={{ min: 1, step: "1" }}
            error={Boolean(error)}
          />
          <TextField
            type="number"
            label="Alto (cm)"
            value={depth || ""}
            onChange={handleDepthChange}
            variant="outlined"
            fullWidth
            margin="normal"
            inputProps={{ min: 1, step: "1" }}
            error={Boolean(error)}
          />
          {calculatedLiters !== undefined && (
            <Typography variant="body1" align="center" paragraph>
              Volumen Calculado: {calculatedLiters} litros 🧮
            </Typography>
          )}
        </>
      )}

      {showSubmitButton && ( // Mostrar el botón de envío si es necesario
        <Box textAlign="center">
          <Button
            type="submit"
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
            disabled={ // Deshabilitar el botón si no se han introducido suficientes datos
              inputMode === "liters"
                ? liters === undefined
                : width === undefined || height === undefined || depth === undefined
            }
          >
            ¿Qué filtro me recomiendas? 🔍
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default FilterForm;