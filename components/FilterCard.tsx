// components/FilterCard.tsx
import { Filtro } from "@/types/Filtro";
import Image from "next/image";
import { getFilterLevel } from "@/lib/filters";

interface FilterCardProps {
  filtro: Filtro;
  liters?: number;
}

export default function FilterCard({ filtro, liters }: FilterCardProps) {
  const filterLevel =
    liters !== undefined ? getFilterLevel(filtro, liters) : null;

  let bgColor = "bg-gray-100 dark:bg-gray-800"; // Fondo por defecto con soporte dark mode
  let borderColor = "border-gray-300";

  if (filterLevel === "recommended") {
    bgColor = "bg-green-100 dark:bg-green-900/70"; // Fondo verde claro y verde oscuro/opaco
    borderColor = "border-green-500";
  } else if (filterLevel === "minimum") {
    bgColor = "bg-yellow-100 dark:bg-yellow-800/70"; // Fondo amarillo claro y amarillo oscuro/opaco
    borderColor = "border-yellow-500";
  }

    const amazonLinkText = filtro.asin
    ? filtro.asin.startsWith("http")
      ? "Ver en Amazon"  //Si ya es una URL
      : "¡Consíguelo en Amazon!" //Si es ASIN
    : ""; // Si no hay ASIN

  return (
    <div
      className={`border rounded-lg p-4 shadow-md ${borderColor} ${bgColor} transition-colors`}  // Aplicamos bgColor y transition
    >
      <h2 className="text-lg font-semibold mb-2">
        {filtro.marca} {filtro.modelo}
      </h2>
      {/*<Image
        src={filtro.imagen}
        alt={`${filtro.marca} ${filtro.modelo}`}
        width={300}
        height={200}
        className="mb-4 rounded-md object-cover"
        priority={true}
      />*/}
      <p className="text-gray-700 dark:text-gray-300">Caudal: {filtro.caudal} l/h</p> {/*Texto dark mode*/}
      <p className="text-gray-700 dark:text-gray-300">
        Volumen del vaso: {filtro.volumen_vaso_filtro} l
      </p>  {/*Texto dark mode*/}
      {filtro.asin && (
        <a
          href={filtro.asin.startsWith("http") ? filtro.asin :  `https://www.amazon.es/dp/${filtro.asin}`}
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