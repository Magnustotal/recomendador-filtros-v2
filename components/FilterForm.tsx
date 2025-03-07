// components/FilterForm.tsx
import { useState, useEffect } from "react";

interface FilterFormProps {
  onSubmit: (liters: number) => void;
  inputMode: "liters" | "dimensions";
  onLitersChange: (liters: number | undefined) => void; // Prop para notificar cambios en litros
  showSubmitButton: boolean;
}

const FilterForm: React.FC<FilterFormProps> = ({
  onSubmit,
  inputMode,
  onLitersChange,
  showSubmitButton
}) => {
  const [width, setWidth] = useState<number | undefined>();
  const [height, setHeight] = useState<number | undefined>();
  const [depth, setDepth] = useState<number | undefined>();
  const [liters, setLiters] = useState<number | undefined>();

    // useEffect para actualizar litros cuando cambian las dimensiones
  useEffect(() => {
    if (inputMode === "dimensions" && width && height && depth) {
      const calculatedLiters = (width * height * depth) / 1000;
      onLitersChange(calculatedLiters);
    }
  }, [width, height, depth, inputMode, onLitersChange]);

  // useEffect para actualizar litros cuando cambia el volumen directamente
  useEffect(() => {
    if (inputMode === "liters" && liters !== undefined) {
      onLitersChange(liters);
    } else if (inputMode === 'liters' && liters === undefined){
        onLitersChange(undefined);
    }
  }, [liters, inputMode, onLitersChange]);


  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputMode === "dimensions" && width && height && depth) {
      onSubmit((width * height * depth) / 1000);
    } else if (inputMode === "liters" && liters !== undefined) {
      onSubmit(liters);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {inputMode === "dimensions" && (
        <>
          <div>
            <label
              htmlFor="width"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Ancho (cm):
            </label>
            <input
              type="number"
              id="width"
              value={width || ""}
              onChange={(e) =>
                setWidth(e.target.value ? parseInt(e.target.value, 10) : undefined)
              }
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
              min="1"
              step="1"
            />
          </div>
          <div>
            <label
              htmlFor="height"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Alto (cm):
            </label>
            <input
              type="number"
              id="height"
              value={height || ""}
              onChange={(e) =>
                setHeight(
                  e.target.value ? parseInt(e.target.value, 10) : undefined,
                )
              }
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
              min="1"
              step="1"
            />
          </div>
          <div>
            <label
              htmlFor="depth"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Profundidad (cm):
            </label>
            <input
              type="number"
              id="depth"
              value={depth || ""}
              onChange={(e) =>
                setDepth(e.target.value ? parseInt(e.target.value, 10) : undefined)
              }
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
              min="1"
              step="1"
            />
          </div>
        </>
      )}

      {inputMode === "liters" && (
        <div>
          <label
            htmlFor="liters"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Volumen (litros):
          </label>
          <input
            type="number"
            id="liters"
            value={liters || ""}
            onChange={(e) =>
              setLiters(e.target.value ? parseInt(e.target.value, 10) : undefined)
            }
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            required
            min="1"
            step="1"
          />
        </div>
      )}

        {showSubmitButton && (
            <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
            Calcular Filtros
            </button>
        )}

    </form>
  );
};

export default FilterForm;