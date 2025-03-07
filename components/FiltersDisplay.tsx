import { Filtro } from "@/types/Filtro";
import FilterCard from "./FilterCard";
import FilterTableRow from "./FilterTableRow"; // Importamos el nuevo componente
import { getFilterLevel } from "@/lib/filters";
import { useState } from "react";

interface FiltersDisplayProps {
  filters: (Filtro | { combination: Filtro[] })[];
  displayMode: "cards" | "table";
  liters?: number;
  onFilterClick: (filter: Filtro | { combination: Filtro[] }) => void; // Recibimos la función
}

const FiltersDisplay: React.FC<FiltersDisplayProps> = ({
  filters,
  displayMode,
  liters,
  onFilterClick, // Agregamos la prop
}) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Filtro | null;
    direction: "ascending" | "descending";
  }>({ key: null, direction: "ascending" });

  const sortedFilters = [...filters];

  // Función auxiliar para ordenar
  const sortFilters = (filters: (Filtro | { combination: Filtro[] })[]) => {
    //Función para ordenar los filtros. Primero comprueba si hay una clave para ordenar, si la hay, ordena alfabeticamente, si no, ordena por caudal.
    const sorted = [...filters];
    sorted.sort((a, b) => {
      const keyA = sortConfig.key ? (typeof a === 'object' && 'combination' in a ? a.combination[0][sortConfig.key] : (typeof a === 'object' && sortConfig.key in a ? a[sortConfig.key] : null)): null;
      const keyB = sortConfig.key ? (typeof b === 'object' && 'combination' in b ? b.combination[0][sortConfig.key] : (typeof b === 'object' && sortConfig.key in b ? b[sortConfig.key] : null)): null;

      if (sortConfig.key && keyA !== null && keyB !== null) {

        if (keyA < keyB) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (keyA > keyB) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
      }
      //Si no hay clave de ordenación, ordenamos por caudal.
      const caudalA = typeof a === 'object' && 'combination' in a ? a.combination.reduce((acc, curr) => acc + curr.caudal, 0) : (typeof a === 'object' && 'caudal' in a ? a.caudal : 0);
      const caudalB = typeof b === 'object' && 'combination' in b ? b.combination.reduce((acc, curr) => acc + curr.caudal, 0) : (typeof b === 'object' && 'caudal' in b ? b.caudal : 0);
      return caudalA - caudalB;

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
        {sortedFilters.map((filtro, index) => (
          <FilterCard
            key={
              typeof filtro === "object" && "combination" in filtro
                ? filtro.combination[0].id
                : (filtro as Filtro).id
            }
            filtro={filtro}
            liters={liters}
            onClick={() => onFilterClick(filtro)} // Usamos la función
          />
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

                    {sortedTableFilters.map((filtro, index) => (

                            <FilterTableRow
                                key={typeof filtro === "object" && 'combination' in filtro ?  filtro.combination.map(f => f.id).join('-') : (filtro as Filtro).id}
                                filtro={filtro}
                                liters={liters}
                                onClick={() => onFilterClick(filtro)}

                            />
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

  return <div>Modo de visualización no implementado</div>;
};

export default FiltersDisplay;