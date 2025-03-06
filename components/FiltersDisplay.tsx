import { Filtro } from "@/types/Filtro";
import FilterCard from "./FilterCard";
import { getFilterLevel } from "@/lib/filters";
import { useState } from "react";

interface FiltersDisplayProps {
  filters: Filtro[];
  displayMode: "cards" | "table";
  liters?: number;
}

const FiltersDisplay: React.FC<FiltersDisplayProps> = ({
  filters,
  displayMode,
  liters,
}) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Filtro | null;
    direction: "ascending" | "descending";
  }>({ key: null, direction: "ascending" });



  const sortedFilters = [...filters];

// Función auxiliar para ordenar
  const sortFilters = (filters: Filtro[]) => {
        const sorted = [...filters];
        sorted.sort((a, b) => {
            if (sortConfig.key) {
                const key = sortConfig.key;
                if (a[key] < b[key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[key] > b[key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
            }
             return a.caudal - b.caudal;

        });
        return sorted;
    };
   const sortedTableFilters = sortFilters(sortedFilters);


  const requestSort = (key: keyof Filtro) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Filtro) => {
    if (sortConfig.key !== key) {
      return "↕️";
    }
    return sortConfig.direction === "ascending" ? "⬆️" : "⬇️";
  };

  if (displayMode === "cards") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {" "}
        {/* Aumentado el gap */}
        {sortedFilters.map((filtro) => (
          <FilterCard key={filtro.id} filtro={filtro} liters={liters} />
        ))}
      </div>
    );
  }

    if (displayMode === "table") {
        return (
            <div className="overflow-x-auto">
                <table className="table-auto w-full border-collapse border border-slate-400 dark:border-slate-600 text-center">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="border border-slate-300 dark:border-slate-700 px-4 py-2 cursor-pointer" onClick={() => requestSort('marca')}>Marca {getSortIcon('marca')}</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-4 py-2 cursor-pointer" onClick={() => requestSort('modelo')}>Modelo {getSortIcon('modelo')}</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-4 py-2 cursor-pointer" onClick={() => requestSort('caudal')}>Caudal (l/h) {getSortIcon('caudal')}</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-4 py-2 cursor-pointer" onClick={() => requestSort('volumen_vaso_filtro')}>Volumen del Vaso (l) {getSortIcon('volumen_vaso_filtro')}</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-4 py-2">Cumple</th>
                            <th className="border border-slate-300 dark:border-slate-700 px-4 py-2">Amazon</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTableFilters.map((filtro) => {
                            const filterLevel = liters !== undefined ? getFilterLevel(filtro, liters) : null;
                            let levelText = "";
                            let textColor = "";
                            let bgColor = "";

                            if (filterLevel === "recommended") {
                                levelText = "Requisitos Recomendados";
                                textColor = "text-green-700 dark:text-green-400";  // Verde más oscuro
                                bgColor = "bg-green-100 dark:bg-green-900/70";
                            } else if (filterLevel === "minimum") {
                                levelText = "Requisitos Mínimos";
                                textColor = "text-yellow-700 dark:text-yellow-400";  // Amarillo más oscuro
                                bgColor = "bg-yellow-100 dark:bg-yellow-800/70";
                            } else {
                                levelText = "Insuficiente";
                                textColor = "text-gray-600 dark:text-gray-400";
                                bgColor = "bg-gray-50 dark:bg-gray-800";
                            }
                            const amazonLinkText = filtro.asin
                              ? filtro.asin.startsWith("http")
                                ? "Ver en Amazon"  //Si ya es una URL
                                : "¡Consíguelo en Amazon!" //Si es ASIN
                              : ""; // Si no hay ASIN

                            return (
                                <tr key={filtro.id} className={`${bgColor} transition-colors`}>
                                    <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">{filtro.marca}</td>
                                    <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">{filtro.modelo}</td>
                                    <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">{filtro.caudal}</td>
                                    <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">{filtro.volumen_vaso_filtro}</td>
                                    <td className={`border border-slate-300 dark:border-slate-700 px-4 py-2 ${textColor}`}>{levelText}</td>
                                    <td className="border border-slate-300 dark:border-slate-700 px-4 py-2">
                                        {filtro.asin && (
                                            <a
                                                href={filtro.asin.startsWith("http") ? filtro.asin :  `https://www.amazon.es/dp/${filtro.asin}`}
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
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

  return <div>Modo de visualización no implementado</div>;
};

export default FiltersDisplay;