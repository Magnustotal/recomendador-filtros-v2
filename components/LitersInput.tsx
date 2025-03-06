// components/LitersInput.tsx
import React, { useState, useEffect } from "react";

interface LitersInputProps {
  label: string;
  value: number | undefined;
  onChange: (newValue: number | undefined) => void;
  minValue?: number;
}

const LitersInput: React.FC<LitersInputProps> = ({
  label,
  value,
  onChange,
  minValue = 0,
}) => {
  const [localValue, setLocalValue] = useState<string | undefined>(
    value === undefined ? "" : String(value),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(value === undefined ? "" : String(value));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setLocalValue(inputValue);

    if (inputValue === "") {
      onChange(undefined);
      setError(null);
      return;
    }

    const numValue = parseInt(inputValue, 10);

    if (Number.isNaN(numValue)) {
      setError("Introduce un número válido.");
      onChange(undefined);
    } else if (numValue < minValue) {
      setError(`El valor debe ser mayor o igual a ${minValue}.`);
      onChange(undefined);
    } else {
      setError(null);
      onChange(numValue);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-gray-700 text-sm font-bold mb-2">
        {label}
      </label>
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        className="border rounded-md p-2 w-full"
        min={minValue}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default LitersInput;