import React, { useState, useEffect, useCallback } from "react";
import { TextField, Box, Typography } from "@mui/material";

interface LitersInputProps {
  label: string;
  value: number | undefined;
  onChange: (newValue: number | undefined) => void;
  minValue?: number;
}

// Componente para la entrada de litros con validación
const LitersInput: React.FC<LitersInputProps> = ({
  label,
  value,
  onChange,
  minValue = 0,
}) => {
  const [localValue, setLocalValue] = useState<string>(
    value === undefined ? "" : String(value) // Inicializar el valor local con el valor prop o vacío
  );
  const [error, setError] = useState<string | null>(null); // Estado para gestionar los errores

  // Actualizar el valor local cuando el valor prop cambie
  useEffect(() => {
    setLocalValue(value === undefined ? "" : String(value));
  }, [value]);

  // Manejar cambios en el campo de entrada
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setLocalValue(inputValue);

    // Si el campo está vacío, se limpia el error y se pasa undefined al padre
    if (inputValue === "") {
      onChange(undefined);
      setError(null);
      return;
    }

    const numValue = parseInt(inputValue, 10);

    // Validar si el valor introducido es un número
    if (Number.isNaN(numValue)) {
      setError("Introduce un número válido.");
      onChange(undefined);
    }
    // Validar si el valor es menor que el mínimo
    else if (numValue < minValue) {
      setError(`El valor debe ser mayor o igual a ${minValue}.`);
      onChange(undefined);
    } else {
      setError(null); // Si no hay errores, se limpia el error
      onChange(numValue); // Se pasa el valor válido al padre
    }
  }, [minValue, onChange]);

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        {label}
      </Typography>
      <TextField
        type="number"
        value={localValue}
        onChange={handleChange}
        variant="outlined"
        fullWidth
        margin="normal"
        inputProps={{ min: minValue }} // Asegura que el valor mínimo se respete en el input
        error={Boolean(error)} // Muestra el error si existe
        helperText={error} // Muestra el texto del error debajo del input
      />
    </Box>
  );
};

export default LitersInput;