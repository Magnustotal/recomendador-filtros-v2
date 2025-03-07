// components/FilterCard.tsx
import { Filtro } from "@/types/Filtro";
import Image from "next/image";
import { getFilterLevel } from "@/lib/filters";

interface FilterCardProps {
  filtro: Filtro | { combination: Filtro[] };
  liters?: number;
  onClick: () => void; // Recibimos la función onClick
}

export default function FilterCard({
  filtro,
  liters,
  onClick, // Agregamos la prop
}: FilterCardProps) {
  const filterLevel =
    liters !== undefined
      ? typeof filtro === "object" && "combination" in filtro
        ? getFilterLevel(filtro.combination[0], liters) // Usamos el primer filtro de la combinación para el nivel
        : getFilterLevel(filtro as Filtro, liters)
      : null;

  let bgColor = "bg-gray-100 dark:bg-gray-800"; // Fondo por defecto con soporte dark mode
  let borderColor = "border-gray-300";
  let textColor = "text-gray-700 dark:text-gray-300"; // Color de texto por defecto

  if (filterLevel === "recommended") {
    bgColor = "bg-green-100 dark:bg-green-900/70"; // Fondo verde claro y verde oscuro/opaco
    borderColor = "border-green-500";
    textColor = "text-green-700 dark:text-green-400"; // Color de texto para recomendado
  } else if (filterLevel === "minimum") {
    bgColor = "bg-yellow-100 dark:bg-yellow-800/70"; // Fondo amarillo claro y amarillo oscuro/opaco
    borderColor = "border-yellow-500";
    textColor = "text-yellow-700 dark:text-yellow-400"; // Color de texto para mínimo
  }

  const amazonLinkText =
    typeof filtro === "object" && "combination" in filtro
      ? filtro.combination[0].asin
        ? filtro.combination[0].asin.startsWith("http")
          ? "Ver en Amazon"
          : "¡Consíguelo en Amazon!"
        : ""
      : (filtro as Filtro).asin
      ? (filtro as Filtro).asin.startsWith("http")
        ? "Ver en Amazon"
        : "¡Consíguelo en Amazon!"
      : "";

  const combinedCaudal =
    typeof filtro === "object" && "combination" in filtro
      ? filtro.combination.reduce((acc, f) => acc + f.caudal, 0)
      : (filtro as Filtro).caudal;

      const combinedVolumen =
    typeof filtro === "object" && "combination" in filtro
      ? filtro.combination.reduce((acc, f) => acc + f.volumen_vaso_filtro, 0)
      : (filtro as Filtro).volumen_vaso_filtro;

  return (
    <div
      className={`border rounded-lg p-4 shadow-md cursor-pointer ${borderColor} ${bgColor} transition-colors`} // cursor-pointer
      onClick={onClick} // Manejamos el clic aquí
    >
      <h2 className={`text-lg font-semibold mb-2 ${textColor}`}>
        {typeof filtro === "object" && "combination" in filtro
          ? `Combinación: ${filtro.combination
              .map((f) => `${f.marca} ${f.modelo}`)
              .join(" + ")}`
          : `${(filtro as Filtro).marca} ${(filtro as Filtro).modelo}`}
      </h2>
      <p className={`text-gray-700 dark:text-gray-300 ${textColor}`}>
        Caudal: {combinedCaudal} l/h
      </p>
      <p className={`text-gray-700 dark:text-gray-300 ${textColor}`}>
        Volumen del vaso: {combinedVolumen} l
      </p>
      {amazonLinkText && (
        <a
           href={
            typeof filtro === "object" && "combination" in filtro
            ? filtro.combination[0].asin.startsWith("http") ? filtro.combination[0].asin :  `https://www.amazon.es/dp/${filtro.combination[0].asin}`
            : (filtro as Filtro).asin.startsWith("http") ? (filtro as Filtro).asin : `https://www.amazon.es/dp/${(filtro as Filtro).asin}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {amazonLinkText}
        </a>
      )}
    </div>
  );
}