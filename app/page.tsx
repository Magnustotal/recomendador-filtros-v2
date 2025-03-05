// app/page.tsx
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '../components/Layout';
import ModeSelector from '../components/ModeSelector';
import DimensionsInput from '../components/DimensionsInput';
import ResultsTable from '../components/ResultsTable';
import LoadingState from '../components/LoadingState';
import AlertMessage from '../components/AlertMessage';
import FilterDetails from '../components/FilterDetails';
import tips from '../data/tips';
import useDebounce from '../hooks/useDebounce';
import { Filter, Dimensions, SortConfig, FilteredResults } from '../types';

export default function Home() {
  const [dimensionsMode, setDimensionsMode] = useState<boolean | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({ length: 0, width: 0, height: 0 });
  const [calculatedVolume, setCalculatedVolume] = useState<number>(0);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filteredResults, setFilteredResults] = useState<FilteredResults>({
    recommended: [],
    adequate: [],
    notAdequate: [],
    recommendedCombinations: [],
    adequateCombinations: [],
  });
  const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'caudal', direction: 'ascending' });
  const [showFiltersCount, setShowFiltersCount] = useState<boolean>(false);
  const [maxVolume, setMaxVolume] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<Filter | null>(null);

  const debouncedDimensions = useDebounce(dimensions, 500);

  useEffect(() => {
    const fetchFilters = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/filters');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al cargar los filtros');
        }
        const data: Filter[] = await response.json();
        setFilters(data);
        const maxCaudalLocal = Math.max(...data.map(filter => filter.caudal));
        setMaxVolume((2 * maxCaudalLocal) / 10);
      } catch (err: any) {
        setError(err.message || 'Error al cargar los filtros. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (debouncedDimensions.length && debouncedDimensions.width && debouncedDimensions.height) {
      const vol = (debouncedDimensions.length * debouncedDimensions.width * debouncedDimensions.height) / 1000;
      setCalculatedVolume(vol);
    }
  }, [debouncedDimensions]);

  const handleDimensionChange = useCallback((field: keyof Dimensions, value: number) => {
    setDimensions(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = e.target.value;
    if (newVolume === '' || parseFloat(newVolume) >= 0) {
      setCalculatedVolume(newVolume === '' ? 0 : parseFloat(newVolume));
    }
  }, []);

  const resetForm = useCallback(() => {
    setDimensionsMode(null);
    setDimensions({ length: 0, width: 0, height: 0 });
    setCalculatedVolume(0);
    setFilteredResults({
      recommended: [],
      adequate: [],
      notAdequate: [],
      recommendedCombinations: [],
      adequateCombinations: [],
    });
    setShowFiltersCount(false);
    setShowDetails(false);
    setSelectedFilterId(null);
    setSelectedFilter(null);
  }, []);

  const navigateTip = useCallback((direction: 'next' | 'prev') => {
    setCurrentTipIndex(prevIndex =>
      direction === 'next'
        ? (prevIndex + 1) % tips.length
        : (prevIndex - 1 + tips.length) % tips.length
    );
  }, []);

  const requestSort = useCallback((key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'ascending'
        ? 'descending'
        : 'ascending',
    }));
  }, []);

  const classifyFilters = useCallback(() => {
    if (!calculatedVolume || filters.length === 0) return;

    if (calculatedVolume > maxVolume) {
      setError(`Este recomendador ha sido creado para acuarios de un volumen inferior a ${maxVolume.toFixed(1)} litros.`);
      return;
    } else {
      setError(null);
    }

    let recommended: Filter[] = [];
    let adequate: Filter[] = [];
    let notAdequate: Filter[] = [];
    let recommendedCombinations: Filter[] = [];
    let adequateCombinations: Filter[] = [];

    const minFlowRate = calculatedVolume * 10;
    const maxCaudalLocal = Math.max(...filters.map(filter => filter.caudal));
    const combinationThreshold = maxCaudalLocal / 10;

    filters.forEach(filter => {
      const { caudal, volumen_vaso_filtro } = filter;

      if (caudal < minFlowRate) {
        notAdequate.push(filter);
        return;
      }

      if (caudal >= minFlowRate && volumen_vaso_filtro >= calculatedVolume * 0.05) {
        recommended.push(filter);
      } else if (caudal >= minFlowRate && volumen_vaso_filtro >= calculatedVolume * 0.025) {
        adequate.push(filter);
      } else {
        notAdequate.push(filter);
      }
    });

    const sortByRatio = (a: Filter, b: Filter) => {
      const ratioA = a.caudal / a.volumen_vaso_filtro;
      const ratioB = b.caudal / b.volumen_vaso_filtro;
      return ratioB - ratioA;
    };

    recommended.sort(sortByRatio);
    adequate.sort(sortByRatio);

    if (calculatedVolume > 200) {
      filters.forEach((filter1, index) => {
        filters.slice(index + 1).forEach(filter2 => {
          if (filter1.modelo === filter2.modelo) {
            const combinedFilter: Filter = {
              id: `${filter1.id}-${filter2.id}`,
              marca: filter1.marca,
              modelo: `${filter1.modelo} x2`,
              caudal: filter1.caudal + filter2.caudal,
              volumen_vaso_filtro: filter1.volumen_vaso_filtro + filter2.volumen_vaso_filtro,
              volumen_prefiltro: null,
              volumen_vaso_real: null,
              cestas: null,
              consumo: null,
              asin: null,
            };

            if (combinedFilter.caudal >= minFlowRate &&
                combinedFilter.volumen_vaso_filtro >= calculatedVolume * 0.05) {
              recommendedCombinations.push(combinedFilter);
            } else if (combinedFilter.caudal >= minFlowRate &&
                       combinedFilter.volumen_vaso_filtro >= calculatedVolume * 0.025) {
              adequateCombinations.push(combinedFilter);
            }
          }
        });
      });

      recommendedCombinations.sort(sortByRatio);
      adequateCombinations.sort(sortByRatio);
    }

    setFilteredResults({
      recommended,
      adequate,
      notAdequate,
      recommendedCombinations,
      adequateCombinations,
    });
    setShowFiltersCount(true);
  }, [calculatedVolume, filters, maxVolume]);

  useEffect(() => {
    if (calculatedVolume > 0) {
      classifyFilters();
    }
  }, [classifyFilters, calculatedVolume]);

  const sortedFilters = useMemo(() => {
    const { recommended, adequate, recommendedCombinations, adequateCombinations } = filteredResults;
    const allFilters = [...recommended, ...adequate, ...recommendedCombinations, ...adequateCombinations];

    return allFilters.sort((a, b) => {
      const keyA = a[sortConfig.key as keyof Filter];
      const keyB = b[sortConfig.key as keyof Filter];

      if (keyA < keyB) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (keyA > keyB) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
  }, [filteredResults, sortConfig]);

  const maxCaudal = Math.max(...filters.map(filter => filter.caudal || 0));
  const showSumpMessage = calculatedVolume * 10 > maxCaudal;
  const showSumpCriticalMessage = calculatedVolume * 20 > maxCaudal * 2;

  const handleFilterClick = useCallback(async (filterId: string) => {
    setSelectedFilterId(filterId);
    setShowDetails(true);
    setLoading(true);

    try {
      const response = await fetch(`/api/filters/${filterId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cargar los detalles del filtro');
      }
      const data: Filter = await response.json();
      setSelectedFilter(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los detalles del filtro');
      setShowDetails(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCloseDetails = useCallback(() => {
    setShowDetails(false);
    setSelectedFilterId(null);
    setSelectedFilter(null);
  }, []);

  return (
    <Layout>
      {/* Sección de Consejos */}
      <div className="max-w-4xl mx-auto mb-8 transform hover:scale-102 transition-transform duration-300">
        <div className="glass-card p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 text-2xl">💡</div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white mb-2">Consejo del día</h2>
              <p className="text-gray-300">{tips[currentTipIndex]}</p>
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => navigateTip('prev')}
                  className="btn-primary"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => navigateTip('next')}
                  className="btn-primary"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Modo */}
      <ModeSelector
        dimensionsMode={dimensionsMode}
        onModeSelect={setDimensionsMode}
      />

      {/* Panel Principal */}
      <div className="max-w-4xl mx-auto">
        {dimensionsMode === true ? (
          <DimensionsInput
            dimensions={dimensions}
            onChange={handleDimensionChange}
          />
        ) : dimensionsMode === false ? (
          <div className="glass-card p-6">
            <h3 className="text-lg font-medium text-white mb-4">
              Volumen del Acuario
            </h3>
            <input
              type="number"
              value={calculatedVolume}
              onChange={handleVolumeChange}
              className="input-field"
              placeholder="Volumen en litros"
              min="0"
            />
          </div>
        ) : null}

        {/* Volumen Calculado */}
        {calculatedVolume > 0 && (
          <div className="mt-6 text-center">
            <div className="inline-block bg-blue-500/20 px-6 py-3 rounded-full">
              <span className="text-blue-300">Volumen Calculado:</span>
              <span className="ml-2 text-white font-bold">
                {calculatedVolume.toFixed(1)} litros
              </span>
            </div>
          </div>
        )}

        {/* Botones de Acción */}
        {(dimensionsMode === true || dimensionsMode === false) && (
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={classifyFilters}
              className="btn-primary"
            >
              ¿Qué filtros me recomiendas? 🐠
            </button>
            <button
              onClick={resetForm}
              className="btn-secondary"
            >
              Reiniciar
            </button>
          </div>
        )}

        {/* Estado de Carga */}
        {loading && <LoadingState />}

        {/* Mensajes de Error */}
        {error && (
          <AlertMessage
            type="error"
            title="Error"
            message={error}
          />
        )}

        {/* Tabla de Resultados */}
        {sortedFilters.length > 0 && (
          <ResultsTable
            filters={sortedFilters}
            recommended={filteredResults.recommended}
            adequate={filteredResults.adequate}
            recommendedCombinations={filteredResults.recommendedCombinations}
            adequateCombinations={filteredResults.adequateCombinations}
            sortConfig={sortConfig}
            onSort={requestSort}
            onFilterClick={handleFilterClick}
          />
        )}

        {/* Mensajes Informativos (Sump y Filtración) */}
        {showFiltersCount && (
          <>
            {showSumpCriticalMessage ? (
              <AlertMessage
                type="warning"
                title="¡Atención!"
                message="Tu acuario necesita un sistema de filtración muy potente, o un sump, para mantener una buena calidad del agua."
              />
            ) : showSumpMessage ? (
              <AlertMessage
                type="info"
                title="Considera un Sump"
                message="Para acuarios de este volumen, un sump podría mejorar significativamente la filtración y el mantenimiento."
              />
            ) : null}
          </>
        )}

        {/* Ficha de Detalles */}
        {showDetails && selectedFilter && (
          <FilterDetails filter={selectedFilter} onClose={handleCloseDetails} />
        )}
      </div>
    </Layout>
  );
}