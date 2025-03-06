"use client";
// components/FilterForm.tsx
import { useState, useEffect } from "react";
import LitersInput from "./LitersInput";
import DimensionsInput from "./DimensionsInput";

interface FilterFormProps {
  onSubmit: (liters: number) => void;
  inputMode: "liters" | "dimensions" | null;
  showSubmitButton?: boolean; //  prop opcional
}

// Valor por defecto para showSubmitButton (true si no se proporciona)
export default function FilterForm({
  onSubmit,
  inputMode,
  showSubmitButton = true,
}: FilterFormProps) {
  const [litersError, setLitersError] = useState<string | null>(null);
  const [liters, setLiters] = useState<number | undefined>();

  useEffect(() => {
    setLitersError(null);
  }, [inputMode]);

    const handleLitersChange = (newValue: number | undefined) => {
        setLiters(newValue);
        setLitersError(null); // Limpiar error
    };
  const isFormValid = () => {
    return liters !== undefined;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
     if (liters !== undefined) {
        onSubmit(liters);
    } else {
        setLitersError("Por favor, introduce un valor válido.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="mb-4">
        {inputMode === "liters" && (
          <LitersInput
            label="Litros del Acuario:"
            value={liters} // El valor se controla desde el padre
            onChange={handleLitersChange}
            minValue={0}
          />
        )}
        {inputMode === "dimensions" && (
          <DimensionsInput onLitersChange={handleLitersChange} />
        )}
        {litersError && <p className="text-red-500">{litersError}</p>}
      </div>
      {/* Botón de submit, condicional */}
      {showSubmitButton && (
        <button
          type="submit"
          disabled={!isFormValid()}
          className={`bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded ${!isFormValid() ? "opacity-50 cursor-not-allowed" : ""
            }`}
        >
          ¿Qué filtro me recomiendas? 🔍
        </button>
      )}
    </form>
  );
}