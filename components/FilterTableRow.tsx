import { Filtro } from "@/types/Filtro";
import { getFilterLevel } from "@/lib/filters";

interface FilterTableRowProps {
  filtro: Filtro | { combination: Filtro[] };
  liters?: number;
  onClick: () => void;
}

const FilterTableRow: React.FC<FilterTableRowProps> = ({
  filtro,
  liters,
  onClick,
}) => {
  const filterLevel =
    liters !== undefined
      ? typeof filtro === "object" && "combination" in filtro
        ? getFilterLevel(filtro.combination[0], liters) // Usamos el primer filtro de la combinación para el nivel
        : getFilterLevel(filtro as Filtro, liters)
      : null;

  let levelText = "";
  let textColor = "";
  let bgColor = "";

  if (filterLevel === "recommended") {
    levelText = "Requisitos Recomendados";
    textColor = "text-green-700 dark:text-green-400";
    bgColor = "bg-green-100 dark:bg-green-900/70";
  } else if (filterLevel === "minimum") {
    levelText = "Requisitos Mínimos";
    textColor = "text-yellow-700 dark:text-yellow-400";
    bgColor = "bg-yellow-100 dark:bg-yellow-800/70";
  } else {
    levelText = "Insuficiente";
    textColor = "text-gray-600 dark:text-gray-400";
    bgColor = "bg-gray-50 dark:bg-gray-800";
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
    //Calculamos caudales y volúmenes.
  const combinedCaudal =
    typeof filtro === "object" && "combination" in filtro
      ? filtro.combination.reduce((acc, f) => acc + f.caudal, 0)
      : (filtro as Filtro).caudal;

      const combinedVolumen =
    typeof filtro === "object" && "combination" in filtro
      ? filtro.combination.reduce((acc, f) => acc + f.volumen_vaso_filtro, 0)
      : (filtro as Filtro).volumen_vaso_filtro;

  return (
    <tr
      className={`${bgColor} transition-colors cursor-pointer`}
      onClick={onClick}
    >
      <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">
        {typeof filtro === "object" && "combination" in filtro
          ? `Combinación`
          : (filtro as Filtro).marca}
      </td>
      <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">
      {typeof filtro === "object" && "combination" in filtro
          ? `${filtro.combination.map((f) => `${f.modelo}`).join(" + ")}`
          : (filtro as Filtro).modelo}
      </td>
      <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">
        {combinedCaudal}
      </td>
      <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">
        {combinedVolumen}
      </td>
      <td
        className={`border border-slate-300 dark:border-slate-700 px-4 py-2 ${textColor}`}
      >
        {levelText}
      </td>
      <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">
        {amazonLinkText && (
          <a
             href={
              typeof filtro === "object" && "combination" in filtro
              ? filtro.combination[0].asin.startsWith("http") ? filtro.combination[0].asin :  `https://www.amazon.es/dp/${filtro.combination[0].asin}`
              : (filtro as Filtro).asin.startsWith("http") ? (filtro as Filtro).asin : `https://www.amazon.es/dp/${(filtro as Filtro).asin}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline dark:text-blue-400"
          >
            {amazonLinkText}
          </a>
        )}
      </td>
    </tr>
  );
};

export default FilterTableRow;