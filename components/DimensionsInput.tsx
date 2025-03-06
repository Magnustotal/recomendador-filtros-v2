// components/DimensionsInput.tsx
import React, { useState, useEffect } from "react";

interface DimensionsInputProps {
  onLitersChange: (liters: number | undefined) => void;
  onSubmit?: (liters: number) => void; // onSubmit es opcional ahora
}

const DimensionsInput: React.FC<DimensionsInputProps> = ({
  onLitersChange,
  onSubmit,
}) => {
  const [length, setLength] = useState<number | undefined>();
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (length !== undefined && width !== undefined && height !== undefined) {
      if (
        Number.isInteger(length) &&
        length > 0 &&
        Number.isInteger(width) &&
        width > 0 &&
        Number.isInteger(height) &&
        height > 0
      ) {
        const liters = (length * width * height) / 1000;
        onLitersChange(liters);
        if (onSubmit) { // Llamamos a onSubmit *si existe*
          onSubmit(liters);
        }
        setError(null);
      } else {
        setError("Introduce números enteros positivos.");
        onLitersChange(undefined);
      }
    } else {
      onLitersChange(undefined);
      setError(null);
    }
  }, [length, width, height, onLitersChange, onSubmit]); // Añadimos onSubmit a las dependencias

  return (
    <div className="mb-4">
      <div className="grid grid-cols-3 gap-4 mb-2">
        <input
          type="number"
          placeholder="Largo (cm)"
          value={length === undefined ? "" : length}
          onChange={(e) =>
            setLength(
              e.target.value === "" ? undefined : parseInt(e.target.value, 10),
            )
          }
          className="border rounded-md p-2"
        />
        <input
          type="number"
          placeholder="Ancho (cm)"
          value={width === undefined ? "" : width}
          onChange={(e) =>
            setWidth(
              e.target.value === "" ? undefined : parseInt(e.target.value, 10),
            )
          }
          className="border rounded-md p-2"
        />
        <input
          type="number"
          placeholder="Alto (cm)"
          value={height === undefined ? "" : height}
          onChange={(e) =>
            setHeight(
              e.target.value === "" ? undefined : parseInt(e.target.value, 10),
            )
          }
          className="border rounded-md p-2"
        />
      </div>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default DimensionsInput;