// components/FilterDetails.tsx
import { Filtro } from "@/types/Filtro";

interface FilterDetailsProps {
  filter: Filtro | { combination: Filtro[] };
  onClose: () => void;
}

const FilterDetails: React.FC<FilterDetailsProps> = ({ filter, onClose }) => {
  const displayValue = (value: any) =>
    value !== undefined && value !== null ? value : "N/D";

  const isCombination = typeof filter === "object" && "combination" in filter;
  const filtersToDisplay = isCombination ? filter.combination : [filter];

  // Cálculo de carga y volumen estimado
  const calculateLoadsAndEstimate = (
    volumenReal: number | null | undefined,
    volumenVaso: number | null | undefined,
  ) => {
    let volumeToUse = volumenReal;
    let estimatedRealVolume: number | "N/D" = "N/D";

    if (volumeToUse === null || volumeToUse === undefined) {
      if (volumenVaso !== null && volumenVaso !== undefined) {
        volumeToUse = volumenVaso * 0.6; // Estimación del 60%
        estimatedRealVolume = volumeToUse.toFixed(1);
      } else {
        return {
          biologicalLoad: "N/D",
          mechanicalLoad: "N/D",
          estimatedRealVolume: "N/D",
        };
      }
    } else {
        estimatedRealVolume = "N/D"; // Si tenemos el volumen real no hace falta estimar.
    }

    const biologicalLoad = (volumeToUse * 0.9).toFixed(1);
    const mechanicalLoad = (volumeToUse * 0.1).toFixed(1);

    return { biologicalLoad, mechanicalLoad, estimatedRealVolume };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
          >
            &times;
          </button>
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-600 dark:text-blue-400">
          {isCombination ? `Combinación de Filtros` : `Detalles del Filtro 🔎`}
        </h2>

        {filtersToDisplay.map((f, index) => {
            const { biologicalLoad, mechanicalLoad, estimatedRealVolume } =
            calculateLoadsAndEstimate(f.volumen_vaso_real, f.volumen_vaso_filtro);

          return (
          <div
            key={f.id}
            className={
              index > 0
                ? "mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                : ""
            }
          >
            {isCombination && (
              <h3 className="text-xl font-semibold mb-2 text-center">
                {f.marca} {f.modelo}
              </h3>
            )}

            <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse border border-gray-300 dark:border-gray-700">
              <tbody>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Marca 🏷️
                  </td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {displayValue(f.marca)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Modelo 🆔
                  </td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {displayValue(f.modelo)}
                  </td>
                </tr>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Caudal 🌊
                  </td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {displayValue(f.caudal)} l/h
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Volumen del Vaso 🛢️
                  </td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {displayValue(f.volumen_vaso_filtro)} l
                  </td>
                </tr>
                {f.volumen_prefiltro !== null && f.volumen_prefiltro !== undefined && (
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                      Capacidad del Prefiltro 🛡️
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      {displayValue(f.volumen_prefiltro)} l
                    </td>
                  </tr>
                )}
                {f.volumen_vaso_real !== null && f.volumen_vaso_real !== undefined && (
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                      Volumen Vaso Real ✅
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      {displayValue(f.volumen_vaso_real)} l
                    </td>
                  </tr>
                )}

                {estimatedRealVolume !== "N/D" &&(
                    <tr className="bg-gray-100 dark:bg-gray-700">
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Volumen Vaso Real (Estimado) 📏
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {displayValue(estimatedRealVolume)} l
                    </td>
                </tr>
                )}

                {f.cestas !== null && f.cestas !== undefined && f.cestas !== 0 && (
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                      Número de Cestas 🧺
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      {displayValue(f.cestas)}
                    </td>
                  </tr>
                )}
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Consumo ⚡
                  </td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {displayValue(f.consumo)} W
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Carga Biológica Recomendada 🦠
                  </td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {biologicalLoad} l
                  </td>
                </tr>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                    Carga Mecánica Recomendada ⚙️
                  </td>
                  <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                    {mechanicalLoad} l
                  </td>
                </tr>
                {f.asin && (
                  <tr>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold">
                      Amazon 🛒
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <a
                        href={
                          f.asin.startsWith("http")
                            ? f.asin
                            : `https://www.amazon.es/dp/${f.asin}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline dark:text-blue-400"
                      >
                        ¡Consíguelo aquí!
                      </a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

export default FilterDetails;