export default function ResultsTable({
    filters,
    recommended,
    adequate,
    recommendedCombinations,
    adequateCombinations,
    sortConfig,
    onSort,
    onFilterClick
}: ResultsTableProps) {
    return (
        <div className="mt-8 overflow-x-auto rounded-lg shadow-md">
            <table className="min-w-full bg-white/90 divide-y divide-gray-200">
              <caption className="sr-only">Filtros Recomendados</caption>
                <thead className="bg-gray-50">
                    <tr>
                        {['marca', 'modelo', 'caudal', 'volumen_vaso_filtro'].map((column) => (
                            <th
                                key={column}
                                scope="col"
                                className="group px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                                onClick={() => onSort(column)}
                            >
                                <div className="flex items-center space-x-1">
                                    <span>
                                        {column === 'marca'
                                            ? 'Marca'
                                            : column === 'modelo'
                                                ? 'Modelo'
                                                : column === 'caudal'
                                                    ? 'Caudal (l/h)'
                                                    : <>Volumen Vaso <span className="sr-only">litros</span>(l)</>}
                                    </span>
                                    {sortConfig.key === column && (
                                        <span className="text-gray-700">
                                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                                        </span>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filters.map((filter) => {
                        let isRecommended = false;
                        let isAdequate = false;

                        try {
                            isRecommended = !!recommended.find(f => f.id === filter.id) || !!recommendedCombinations.find(f => f.id === filter.id);
                            isAdequate = !!adequate.find(f => f.id === filter.id) || !!adequateCombinations.find(f => f.id === filter.id);
                        } catch (error) {
                            console.error("Error al buscar filtro:", error);
                        }

                        return (
                            <tr
                                key={filter.id}
                                className={`hover:bg-gray-100 transition-colors duration-200 ${
                                    isRecommended ? 'bg-emerald-50' : ''
                                } ${isAdequate ? 'bg-yellow-50' : ''}`}
                                onClick={() => onFilterClick(filter.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {filter.marca}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {filter.modelo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {filter.caudal}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {filter.volumen_vaso_filtro}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}