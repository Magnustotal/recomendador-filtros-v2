"use client";
import { useState, useEffect } from "react";
import FilterCard from "@/components/FilterCard";
import FilterForm from "@/components/FilterForm";
import {
  getFilteredFilters,
  getFilterLevel,
  generateFilterCombinations,
} from "@/lib/filters";
import { Filtro } from "@/types/Filtro";
import FiltersDisplay from "@/components/FiltersDisplay";
import Tips from "@/components/Tips";
import FilterDetails from "@/components/FilterDetails";
import CalculationExplanation from "@/components/CalculationExplanation";

const tips = [
  "💧 Realiza cambios parciales de agua regularmente (10-20% cada semana).",
  "🐟 No sobrealimentes a tus peces. Alimenta solo la cantidad que puedan comer en 2-3 minutos.",
  "🧹 Utiliza un sifón para limpiar el fondo del acuario y eliminar los restos de comida y excrementos.",
  "🧪 Controla los niveles de amoníaco, nitrito y nitrato regularmente.",
  "⚙️ Asegúrate de realizar el mantenimiento de tu filtro periodicamente y tal y como marca el fabricante.",
  "🧼 Limpia el material filtrante del filtro regularmente, pero no lo reemplaces todo a la vez.",
  "🐠 Introduce los peces nuevos gradualmente para evitar picos de amoníaco.",
  "📚 Investiga las necesidades específicas de cada especie de pez que tengas.",
  "🚰 Utiliza un acondicionador de agua para eliminar el cloro y las cloraminas del agua del grifo.",
  "👀 Observa a tus peces regularmente para detectar signos de enfermedad.",
  "🌡️ Mantén la temperatura del agua estable y adecuada para las especies que tengas.",
  "🌿 Las plantas vivas ayudan a mantener la calidad del agua y proporcionan refugio a los peces.",
  "☀️ Evita la luz solar directa sobre el acuario, ya que puede provocar un crecimiento excesivo de algas.",
  "🐌 Los caracoles y otros invertebrados pueden ayudar a controlar las algas y mantener limpio el acuario.",
  "🪨 Asegúrate de que las rocas y decoraciones sean seguras para acuarios y no alteren la química del agua.",
  "⏳ No tengas prisa al montar un acuario nuevo. El ciclado del acuario es fundamental.",
  "📝 Lleva un registro de los parámetros del agua y de cualquier cambio que realices.",
  "👥 Únete a un foro o grupo de acuariofilia para aprender de otros aficionados y compartir experiencias.",
  "🚑 Ten a mano un botiquín básico para peces, con tratamientos para enfermedades comunes.",
  "⚡️ Asegúrate de que todos los equipos eléctricos estén conectados a una regleta con protección para sobretensiones.",
];

export default function Home() {
  const [filters, setFilters] = useState<Filtro[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filteredFilters, setFilteredFilters] = useState<(
    Filtro | { combination: Filtro[] }
  )[]>([]);
  const [showNoFiltersMessage, setShowNoFiltersMessage] = useState(false);
  const [inputMode, setInputMode] = useState<"liters" | "dimensions" | null>(
    null,
  );
  const [liters, setLiters] = useState<number | undefined>();
  const [calculatedLiters, setCalculatedLiters] =
    useState<number | undefined>();
  const [displayMode, setDisplayMode] = useState<"cards" | "table">("cards");
  const [hasSearched, setHasSearched] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [visibleFilters, setVisibleFilters] = useState<number>(20);
  const [selectedFilter, setSelectedFilter] = useState<
    Filtro | { combination: Filtro[] } | null
  >(null);
    const [showExplanation, setShowExplanation] = useState(false); // Nuevo estado

  useEffect(() => {
    const fetchFilters = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/filters");
        if (!response.ok) {
          throw new Error(
            `Error al obtener los filtros: ${response.status} ${response.statusText}`,
          );
        }
        const data = await response.json();
        // TODO: Validar data con Zod aquí
        setFilters(data);
      } catch (err: any) {
        setError(err.message || "Error al cargar los filtros");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilters();
  }, []);

  const handleFilterSubmit = (liters: number) => {
    setCalculatedLiters(liters);
    let newFilteredFilters = getFilteredFilters({
      liters,
      filters,
    });

    // Separar por nivel de cumplimiento
    const recommendedFilters = newFilteredFilters.filter(
      (filtro) => getFilterLevel(filtro, liters) === "recommended",
    );
    const minimumFilters = newFilteredFilters.filter(
      (filtro) => getFilterLevel(filtro, liters) === "minimum",
    );

    // Ordenar cada grupo por caudal (ascendente)
    recommendedFilters.sort((a, b) => a.caudal - b.caudal);
    minimumFilters.sort((a, b) => a.caudal - b.caudal);

    // Combinaciones de filtros (si no hay suficientes filtros individuales)
    if (newFilteredFilters.length < 20) {
      const combinations = generateFilterCombinations(filters, liters);

      // Filtrar combinaciones por nivel.  Importante para evitar duplicados.
      const recommendedCombinations = combinations.filter((combo) =>
        combo.combination.every(
          (f) => getFilterLevel(f, liters) === "recommended",
        ),
      );
      const minimumCombinations = combinations.filter(
        (combo) =>
          !recommendedCombinations.some(
            (recCombo) => recCombo.combination[0].id === combo.combination[0].id,
          ) && //Evitar duplicados.
          combo.combination.every(
            (f) =>
              getFilterLevel(f, liters) === "minimum" ||
              getFilterLevel(f, liters) === "recommended",
          ),
      );

      // Añadir combinaciones, respetando el límite de 20 resultados.  Primero mínimos, luego recomendados.

      newFilteredFilters = [
        ...minimumFilters,
        ...minimumCombinations,
        ...recommendedFilters.slice(
          0,
          20 - minimumFilters.length - minimumCombinations.length,
        ), // Limitar recomendados si es necesario
        ...recommendedCombinations.slice(
          0,
          20 -
            minimumFilters.length -
            minimumCombinations.length -
            recommendedFilters.length,
        ), // Limitar combinaciones recomendadas
      ];
    } else {
      // Combinar: primero los mínimos, luego los recomendados
      newFilteredFilters = [...minimumFilters, ...recommendedFilters];
    }

    setFilteredFilters(newFilteredFilters);
    setShowNoFiltersMessage(newFilteredFilters.length === 0);
    setInputMode(null);
    setLiters(liters);
    setHasSearched(true);
    setShowForm(false);
    setVisibleFilters(20);
    setSelectedFilter(null);
  };

  const handleNewQuery = () => {
    setShowForm(true);
    setInputMode(null);
    setLiters(undefined);
    setCalculatedLiters(undefined);
    setFilteredFilters([]);
    setHasSearched(false);
    setShowNoFiltersMessage(false);
    setVisibleFilters(20);
    setSelectedFilter(null);
    setShowExplanation(false); // Ocultar explicación
  };

  const handleLitersChange = (newLitros: number | undefined) => {
    setLiters(newLitros);
    setCalculatedLiters(newLitros);
  };

  const handleShowMore = () => {
    setVisibleFilters((prevVisibleFilters) => prevVisibleFilters + 20);
  };

  const handleFilterClick = (
    filter: Filtro | { combination: Filtro[] },
  ) => {
    setSelectedFilter(filter);
  };

  const maxCaudal =
    filters.length > 0 ? Math.max(...filters.map((f) => f.caudal)) : 0;

    const toggleExplanation = () => {
    setShowExplanation(!showExplanation);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4 text-center text-blue-600 dark:text-blue-400">
        🌊 Encuentra el Filtro Ideal para tu Acuario 🐠
      </h1>
      <p className="text-center mb-4 text-gray-600 dark:text-gray-400">
        Esta aplicación ha sido diseñada por y para aficionados a la
        acuariofilia.
      </p>
      {/* Botón para mostrar/ocultar explicación */}
      <div className="text-center mb-4">
        <button
          onClick={toggleExplanation}
          className="text-blue-500 hover:underline dark:text-blue-400"
        >
          {showExplanation ? "Ocultar explicación de los cálculos" : "¿Cómo se realizan los cálculos?"}
        </button>
      </div>

      {/* Explicación de los cálculos (condicional) */}
      {showExplanation && <CalculationExplanation />}
      <Tips tips={tips} />
      {filters.length > 0 && (
        <p className="text-center mb-4 text-gray-600 dark:text-gray-400">
          Filtros en la base de datos: {filters.length} 🗄️
        </p>
      )}
      {showForm && (
        <>
          <p className="text-center mb-6 text-gray-600 dark:text-gray-400">
            Para poder recomendarte el filtro perfecto, necesitamos que nos
            indiques las dimensiones de tu acuario o su volumen en litros.
          </p>

          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={() => setInputMode("liters")}
              className={`px-6 py-3 rounded-full  text-white font-semibold focus:outline-none transition duration-200 ${
                inputMode === "liters"
                  ? "bg-blue-700"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              Introducir Volumen (L) 💧
            </button>
            <button
              onClick={() => setInputMode("dimensions")}
              className={`px-6 py-3 rounded-full text-white font-semibold focus:outline-none transition duration-200 ${
                inputMode === "dimensions"
                  ? "bg-blue-700"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              Introducir Dimensiones (cm) 📏
            </button>
          </div>

          {inputMode && (
            <>
              <FilterForm
                onSubmit={handleFilterSubmit}
                inputMode={inputMode}
                onLitersChange={handleLitersChange}
                showSubmitButton={true}
              />
              {calculatedLiters !== undefined && (
                <p className="text-center mb-4 text-gray-600 dark:text-gray-400">
                  Volumen Calculado: {calculatedLiters} litros 🧮
                </p>
              )}
            </>
          )}
        </>
      )}

      {hasSearched && (
        <>
        <div className="flex justify-center mt-6">
          <button
            onClick={handleNewQuery}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded mb-4"
          >
            Nueva Consulta 🔄
          </button>
        </div>
          <div className="flex justify-center space-x-4  mb-6">
            <div className="flex items-center">
              <span className="w-4 h-4 bg-green-500 rounded-full mr-2"></span>
              <span>
                Recomendado ✅ (Caudal ≥ {liters ? liters * 10 : "-"} l/h,
                Volumen ≥ {liters ? (liters * 0.05 / 0.9).toFixed(1) : "-"} l)
              </span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 bg-yellow-500 rounded-full mr-2"></span>
              <span>
                Mínimo ⚠️ (Caudal ≥ {liters ? liters * 10 : "-"} l/h, Volumen
                ≥ {liters ? (liters * 0.025 / 0.9).toFixed(1) : "-"} l)
              </span>
            </div>
          </div>

          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={() => setDisplayMode("cards")}
              className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring transition ${
                displayMode === "cards"
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
              }`}
            >
              Tarjetas 🎴
            </button>
            <button
              onClick={() => setDisplayMode("table")}
              className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring transition ${
                displayMode === "table"
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400"
              }`}
            >
              Tabla 📊
            </button>
          </div>

          {isLoading && (
            <p className="text-gray-500 dark:text-gray-400">Cargando... ⏳</p>
          )}
          {error && <p className="text-red-500">Error: {error} ❌</p>}

          {liters && liters * 10 > maxCaudal * 2 && (
            <p className="text-center text-red-500 dark:text-red-400 font-bold">
              Para un acuario de ese volumen, recomendamos encarecidamente el uso
              de filtración mediante sump como alternativa al uso de filtros
              externos. 📢
            </p>
          )}

          {liters && liters * 10 > maxCaudal && liters * 10 <= maxCaudal * 2 && (
            <p className="text-center text-yellow-500 dark:text-yellow-400 font-bold">
              Para un acuario de ese volumen, podríamos considerar el uso de
              filtración mediante sump como alternativa al uso de filtros
              externos. 🤔
            </p>
          )}

          {!isLoading &&
            !error &&
            filteredFilters.length > 0 && (
              <>
                <FiltersDisplay
                  filters={filteredFilters.slice(0, visibleFilters)}
                  displayMode={displayMode}
                  liters={liters}
                  onFilterClick={handleFilterClick}
                />
                {filteredFilters.length > visibleFilters && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={handleShowMore}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
                    >
                      Mostrar Más Resultados ➕
                    </button>
                  </div>
                )}
              </>
            )}
          {showNoFiltersMessage && !isLoading && !error && (
            <p className="text-center text-gray-600 dark:text-gray-400">
              No se encontraron filtros para los criterios seleccionados. 🙁
            </p>
          )}

          {selectedFilter && (
            <FilterDetails
              filter={selectedFilter}
              onClose={() => setSelectedFilter(null)}
              liters={liters}
            />
          )}
        </>
      )}
    </div>
  );
}