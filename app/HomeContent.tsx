"use client";
import { useState, useEffect, useCallback } from "react";
import FilterCard from "@/components/FilterCard";
import FilterForm from "@/components/FilterForm";
import {
  getFilteredFilters,
  getFilterLevel,
  generateFilterCombinations,
} from "@/lib/filters";
import { combinarFiltros } from "@/utils/combinarFiltros";
import { Filtro } from "@/types/Filtro";
import FiltersDisplay from "@/components/FiltersDisplay";
import Tips from "@/components/Tips";
import FilterDetails from "@/components/FilterDetails";
import CalculationExplanation from "@/components/CalculationExplanation";
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  TextField,
  Paper,
  Divider,
} from "@mui/material";

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

export default function HomeContent() {
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
  const [showExplanation, setShowExplanation] = useState(false);

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

  const handleFilterSubmit = useCallback((liters: number) => {
    setCalculatedLiters(liters);
    let newFilteredFilters: (Filtro | { combination: Filtro[] })[] = getFilteredFilters({
      liters,
      filters,
    });

    // Separar por nivel de cumplimiento
    const recommendedFilters = newFilteredFilters.filter(
      (filtro) => getFilterLevel(filtro, liters) === "recommended",
    ) as Filtro[];
    const minimumFilters = newFilteredFilters.filter(
      (filtro) => getFilterLevel(filtro, liters) === "minimum",
    ) as Filtro[];

    // Ordenar cada grupo por caudal (ascendente)
    recommendedFilters.sort((a, b) => a.caudal - b.caudal);
    minimumFilters.sort((a, b) => a.caudal - b.caudal);

    // Combinaciones de filtros (si no hay suficientes filtros individuales y >= 200 litros)
    if (liters >= 200 && newFilteredFilters.length < 20) {
      const combinations = generateFilterCombinations(filters, liters);

      // Filtrar combinaciones por nivel.
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

      // Añadir combinaciones, respetando el límite. Primero mínimos, luego recomendados.
      newFilteredFilters = [
        ...minimumFilters,
        ...minimumCombinations,
        ...recommendedFilters.slice(
          0,
          20 - minimumFilters.length - minimumCombinations.length,
        ),
        ...recommendedCombinations.slice(
          0,
          20 -
            minimumFilters.length -
            minimumCombinations.length -
            recommendedFilters.length,
        ),
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
  }, [filters]);

  const handleNewQuery = useCallback(() => {
    setShowForm(true);
    setInputMode(null);
    setLiters(undefined);
    setCalculatedLiters(undefined);
    setFilteredFilters([]);
    setHasSearched(false);
    setShowNoFiltersMessage(false);
    setVisibleFilters(20);
    setSelectedFilter(null);
    setShowExplanation(false);
  }, []);

  const handleLitersChange = useCallback((newLitros: number | undefined) => {
    setLiters(newLitros);
    setCalculatedLiters(newLitros);
  }, []);

  const handleShowMore = useCallback(() => {
    setVisibleFilters((prevVisibleFilters) => prevVisibleFilters + 20);
  }, []);

  const handleFilterClick = useCallback(
    (filter: Filtro | { combination: Filtro[] }) => {
      setSelectedFilter(filter);
    },
    [],
  );

  const maxCaudal =
    filters.length > 0 ? Math.max(...filters.map((f) => f.caudal)) : 0;

  const toggleExplanation = useCallback(() => {
    setShowExplanation((prev) => !prev);
  }, []);

  return (
    <Container maxWidth="md" sx={{ pt: 4, pb: 8 }}>
      <Typography
        variant="h4"
        align="center"
        gutterBottom
        sx={{ color: "primary.main" }}
      >
        🌊 Encuentra el Filtro Ideal para tu Acuario 🐠
      </Typography>
      <Typography variant="body1" align="center" paragraph>
        Esta aplicación ha sido diseñada por y para aficionados a la
        acuariofilia.
      </Typography>
      {/* Botón para mostrar/ocultar explicación */}
      <Box textAlign="center" mb={4}>
        <Button
          onClick={toggleExplanation}
          variant="outlined"
          color="primary"
        >
          {showExplanation ? "Ocultar explicación de los cálculos" : "¿Cómo se realizan los cálculos?"}
        </Button>
      </Box>

      {/* Explicación de los cálculos (condicional) */}
      {showExplanation && <CalculationExplanation />}
      <Tips tips={tips} />
      {filters.length > 0 && (
        <Box textAlign="center" mb={4} p={2} component={Paper} elevation={3}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Filtros en la base de datos: {filters.length} 🗄️
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            (Base de datos en constante actualización)
          </Typography>
        </Box>
      )}
      {showForm && (
        <>
          <Typography
            variant="body1"
            align="center"
            paragraph
            sx={{ color: "text.secondary", mb: 6 }}
          >
            Para poder recomendarte el filtro perfecto, necesitamos que nos
            indiques las dimensiones de tu acuario o su volumen en litros.
          </Typography>

          <Box display="flex" justifyContent="center" gap={4} mb={6}>
            <Button
              onClick={() => setInputMode("liters")}
              variant= {inputMode === "liters" ? "contained" : "outlined"}
              color="primary"
              startIcon={<span >💧</span>}
            >
              Introducir Volumen (L)
            </Button>
            <Button
              onClick={() => setInputMode("dimensions")}
              variant= {inputMode === "dimensions" ? "contained" : "outlined"}
              color="primary"
              startIcon={<span>📏</span>}
            >
              Introducir Dimensiones (cm)
            </Button>
          </Box>

          {inputMode === "liters" && (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); handleFilterSubmit(liters!); }}>
              <TextField
                label="Volumen en litros"
                type="number"
                inputProps={{ min: 1 }}
                value={liters}
                onChange={(e) => setLiters(parseInt(e.target.value))}
                fullWidth
                required
                sx={{ mb: 4 }}
              />
              <Box textAlign="center">
                <Button type="submit" variant="contained" color="primary">
                  Calcular
                </Button>
              </Box>
            </Box>
          )}

          {inputMode === "dimensions" && (
            <FilterForm
              onSubmit={handleFilterSubmit}
              inputMode={inputMode}
              onLitersChange={handleLitersChange}
              showSubmitButton={false} // No mostrar el botón de submit en el formulario de dimensiones
            />
          )}

          {calculatedLiters !== undefined && (
            <Typography
              variant="body1"
              align="center"
              paragraph
              sx={{ color: "text.secondary" }}
            >
              Volumen Calculado: {calculatedLiters} litros 🧮
            </Typography>
          )}
        </>
      )}

      {hasSearched && (
        <>
        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" mt={6} mb={2}>
          <Button
            onClick={handleNewQuery}
            variant="contained"
            color="primary"
          >
            Nueva Consulta 🔄
          </Button>
          </Box>
          <Box display="flex" justifyContent="center" gap={2} mb={4}>
            <Box component={Paper} elevation={3} p={2}>
              <Typography variant="h6" gutterBottom>
                Leyenda:
              </Typography>
              <Box display="flex" alignItems="center" mb={1}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: 'green',
                    mr: 1,
                  }}
                />
                <Typography variant="body2">
                  Recomendados ✅ (Caudal ≥ {liters ? liters * 10 : "-"} l/h, Volumen ≥ {liters ? (liters * 0.05 / 0.9).toFixed(1) : "-"} l)
                </Typography>
              </Box>
              <Box display="flex" alignItems="center">
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: 'yellow',
                    mr: 1,
                  }}
                />
                <Typography variant="body2">
                  Mínimos ⚠️ (Caudal ≥ {liters ? liters * 10 : "-"} l/h, Volumen ≥ {liters ? (liters * 0.025 / 0.9).toFixed(1) : "-"} l)
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box display="flex" justifyContent="center" gap={2} mb={6}>
            <Button
              onClick={() => setDisplayMode("cards")}
              variant={displayMode === "cards" ? "contained" : "outlined"}
              color="primary"
            >
              Tarjetas 🎴
            </Button>
            <Button
              onClick={() => setDisplayMode("table")}
              variant={displayMode === "table" ? "contained" : "outlined"}
              color="primary"
            >
              Tabla 📊
            </Button>
          </Box>

          {isLoading && (
            <Box display="flex" justifyContent="center" mt={4}>
              <CircularProgress />
            </Box>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {liters && liters * 10 > maxCaudal * 2 && (
            <Typography align="center" color="error" fontWeight="bold" paragraph>
              Para un acuario de ese volumen, recomendamos encarecidamente el uso
              de filtración mediante sump como alternativa al uso de filtros
              externos. 📢
            </Typography>
          )}

          {liters && liters * 10 > maxCaudal && liters * 10 <= maxCaudal * 2 && (
            <Typography align="center" color="warning.main" fontWeight="bold" paragraph>
              Para un acuario de ese volumen, podríamos considerar el uso de
              filtración mediante sump como alternativa al uso de filtros
              externos. 🤔
            </Typography>
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
                  <Box textAlign="center" mt={4}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleShowMore}
                    >
                      Mostrar Más Resultados ➕
                    </Button>
                  </Box>
                )}
              </>
            )}
          {showNoFiltersMessage && !isLoading && !error && (
            <Typography variant="body1" align="center" mt={4}>
              No se encontraron filtros para los criterios seleccionados. 🙁
            </Typography>
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
    </Container>
  );
}