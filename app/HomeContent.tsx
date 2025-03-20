"use client";

import { useState, useEffect, useCallback } from "react";
import FilterCard from "@/components/FilterCard";
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
  useTheme,
  Grid,
  InputAdornment,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";

import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import StraightenIcon from '@mui/icons-material/Straighten';
import FilterListIcon from '@mui/icons-material/FilterList';
import ReplayIcon from '@mui/icons-material/Replay';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';


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
  const [inputMode, setInputMode] = useState<"liters" | "dimensions" | null>(null);
  const [liters, setLiters] = useState<number | undefined>();
  const [dimensions, setDimensions] = useState<{
    length: number;
    width: number;
    height: number;
  }>({ length: 0, width: 0, height: 0 });
  const [calculatedLiters, setCalculatedLiters] = useState<number | undefined>();
  const [displayMode, setDisplayMode] = useState<"cards" | "table">("cards");
  const [hasSearched, setHasSearched] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [visibleFilters, setVisibleFilters] = useState<number>(20);
  const [selectedFilter, setSelectedFilter] = useState<
    Filtro | { combination: Filtro[] } | null
  >(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const theme = useTheme();

    //Calculo del caudal máximo.
    const maxCaudal =
    filters.length > 0 ? Math.max(...filters.map((f) => f.caudal)) : 0;

    //Variable para controlar si se debe mostrar el mensaje de priorizar combinaciones.
    const showCombinationPriorityMessage = calculatedLiters !== undefined && calculatedLiters >= 200 && calculatedLiters <= (maxCaudal * 2) / 10;


  const calculateLiters = useCallback(() => {
      if (dimensions.length && dimensions.width && dimensions.height) {
          const liters = (dimensions.length * dimensions.width * dimensions.height) / 1000;
          setCalculatedLiters(liters);
          return liters;
      }
      return undefined;
  }, [dimensions]);


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
                const validFilters = data.filter((filter: Filtro) => filter.volumen_vaso_filtro && filter.caudal);
                setFilters(validFilters);

            } catch (err: any) {
                setError(err.message || "Error al cargar los filtros");
            } finally {
                setIsLoading(false);
            }
        };

        fetchFilters();
    }, []);

    const handleFilterSubmit = useCallback(
        (litersInput: number | undefined) => {
            const litersToUse = litersInput !== undefined ? litersInput : calculatedLiters;

            if (litersToUse === undefined) {
                setError("Por favor, introduce el volumen o las dimensiones del acuario.");
                return;
            }

            // Comprobar si se deben mostrar resultados.
            if (litersToUse > (maxCaudal * 2) / 10) {
              setHasSearched(true);
              setShowForm(false);
              setFilteredFilters([]); // No hay resultados de filtros.
              setShowNoFiltersMessage(false);
              return; // Importante salir para no ejecutar el resto.
            }

            setCalculatedLiters(litersToUse);

            let newFilteredFilters: (Filtro | { combination: Filtro[] })[] =
            getFilteredFilters({
                liters: litersToUse,
                filters,
            });

            // Filtrar para obtener solo filtros individuales
            const individualFilters = newFilteredFilters.filter(
                (filtro) => "id" in filtro
            ) as Filtro[];

            // Filtrar para 'recommended' y 'minimum', y ordenarlos
            const recommendedFilters = individualFilters.filter(
                (filtro) => getFilterLevel(filtro, litersToUse) === "recommended"
            );
            const minimumFilters = individualFilters.filter(
                (filtro) => getFilterLevel(filtro, litersToUse) === "minimum"
            );

            recommendedFilters.sort((a, b) => a.caudal - b.caudal);
            minimumFilters.sort((a, b) => a.caudal - b.caudal);


            // Combinaciones (solo si >= 200 litros)
            if (litersToUse >= 200) {
                const combinations = generateFilterCombinations(filters, litersToUse);
                newFilteredFilters = [...combinations, ...minimumFilters, ...recommendedFilters,];

            } else {
                newFilteredFilters = [...minimumFilters, ...recommendedFilters];
            }

            setFilteredFilters(newFilteredFilters);
            setShowNoFiltersMessage(newFilteredFilters.length === 0);
            setInputMode(null);
            setHasSearched(true);
            setShowForm(false);
            setVisibleFilters(20);
            setSelectedFilter(null);
        },
        [filters, calculatedLiters, maxCaudal]
    );



  const handleNewQuery = useCallback(() => {
    setShowForm(true);
    setInputMode(null);
    setLiters(undefined);
    setDimensions({ length: 0, width: 0, height: 0 });
    setCalculatedLiters(undefined);
    setFilteredFilters([]);
    setHasSearched(false);
    setShowNoFiltersMessage(false);
    setVisibleFilters(20);
    setSelectedFilter(null);
    setShowExplanation(false);
    setError(null);
  }, []);


    const handleLitersChange = useCallback((newLitros: number | undefined) => {
        setLiters(newLitros);
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
        <Typography variant="caption" display="block" align="center" sx={{ mb: 3, color: 'text.secondary' }}>
          * Solo se consideran para los cálculos los filtros con datos completos de volumen del vaso y caudal.
        </Typography>

      <Box textAlign="center" mb={4}>
                <Button
                    onClick={toggleExplanation}
                    variant="outlined"
                    color="primary"
                    startIcon={<HelpOutlineIcon />}
                >
                    {showExplanation
                        ? "Ocultar explicación de los cálculos"
                        : "¿Cómo se realizan los cálculos?"}
                </Button>
            </Box>

            <Collapse in={showExplanation}>
                <CalculationExplanation />
            </Collapse>

      <Tips tips={tips} />

        <Paper elevation={3} sx={{ p: 2, mb: 4, textAlign: "center" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Filtros en la base de datos: {filters.length} 🗄️
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          (Base de datos en constante actualización)
        </Typography>
      </Paper>

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
              variant={inputMode === "liters" ? "contained" : "outlined"}
              color="primary"
              startIcon={<WaterDropIcon />}
            >
              Introducir Volumen (L)
            </Button>
            <Button
              onClick={() => setInputMode("dimensions")}
              variant={inputMode === "dimensions" ? "contained" : "outlined"}
              color="primary"
              startIcon={<StraightenIcon />}
            >
              Introducir Dimensiones (cm)
            </Button>
          </Box>

          {inputMode === "liters" && (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                handleFilterSubmit(liters);
              }}
            >
                <TextField
                label="Volumen en litros"
                type="number"
                inputProps={{ min: 1 }}
                value={liters || ""}
                onChange={(e) => handleLitersChange(parseInt(e.target.value, 10))}
                fullWidth
                required
                sx={{ mb: 4 }}
                InputProps={{
                    startAdornment: (
                    <InputAdornment position="start">
                        <WaterDropIcon />
                    </InputAdornment>
                    ),
                }}
                />

              <Box textAlign="center">
                <Button type="submit" variant="contained" color="primary">
                  Calcular
                </Button>
              </Box>
            </Box>
          )}

            {inputMode === "dimensions" && (
                <Box
                component="form"
                onSubmit={(e) => {
                    e.preventDefault();
                    const liters = calculateLiters();
                    if (liters !== undefined) {
                      handleFilterSubmit(liters);
                    }
                }}
                >
                <Grid container spacing={2} mb={4}>
                    <Grid item xs={12} sm={4}>
                    <TextField
                        label="Largo (cm)"
                        type="number"
                        inputProps={{ min: 1 }}
                        value={dimensions.length || ""}
                        onChange={(e) =>
                        setDimensions({
                            ...dimensions,
                            length: parseInt(e.target.value, 10),
                        })
                        }
                        fullWidth
                        required
                        InputProps={{
                            startAdornment: (
                            <InputAdornment position="start">
                                <StraightenIcon />
                            </InputAdornment>
                            ),
                        }}
                    />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                    <TextField
                        label="Ancho (cm)"
                        type="number"
                        inputProps={{ min: 1 }}
                        value={dimensions.width || ""}
                        onChange={(e) =>
                        setDimensions({
                            ...dimensions,
                            width: parseInt(e.target.value, 10),
                        })
                        }
                        fullWidth
                        required
                        InputProps={{
                            startAdornment: (
                            <InputAdornment position="start">
                                <StraightenIcon />
                            </InputAdornment>
                            ),
                        }}
                    />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                          label="Alto (cm)"
                          type="number"
                          inputProps={{ min: 1 }}
                          value={dimensions.height || ""}
                          onChange={(e) =>
                              setDimensions({
                                  ...dimensions,
                                  height: parseInt(e.target.value, 10),
                              })
                          }
                          fullWidth
                          required
                          InputProps={{
                              startAdornment: (
                                  <InputAdornment position="start">
                                      <StraightenIcon />
                                  </InputAdornment>
                              ),
                          }}
                      />
                  </Grid>
                </Grid>
                <Box textAlign="center">
                  <Button type="submit" variant="contained" color="primary">
                  ¿Qué filtros me recomiendas?
                  </Button>
                </Box>
              </Box>
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
        </>  // Cierre del fragment que engloba el formulario
        )}

      {hasSearched && (
        <>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            width="100%"
            mt={6}
            mb={2}
          >
            <Button
              onClick={handleNewQuery}
              variant="contained"
              color="primary"
              startIcon={<ReplayIcon />}
            >
              Nueva Consulta 🔄
            </Button>
          </Box>
          <Paper elevation={3} sx={{ p: 2, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Leyenda:
            </Typography>
            <Box display="flex" alignItems="center" mb={1}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: "green",
                  mr: 1,
                }}
              />
              <Typography variant="body2">
                Recomendados ✅ (Caudal ≥{" "}
                {calculatedLiters ? calculatedLiters * 10 : "-"} l/h, Volumen ≥{" "}
                {calculatedLiters ? (calculatedLiters * 0.05 / 0.9).toFixed(1) : "-"} l)
              </Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: "yellow",
                  mr: 1,
                }}
              />
              <Typography variant="body2">
                Mínimos ⚠️ (Caudal ≥{" "}
                {calculatedLiters ? calculatedLiters * 10 : "-"} l/h, Volumen ≥{" "}
                {calculatedLiters
                  ? (calculatedLiters * 0.025 / 0.9).toFixed(1)
                  : "-"} l)
              </Typography>
            </Box>
          </Paper>

          {showCombinationPriorityMessage && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Para acuarios de 200 litros o más, recomendamos priorizar las
              combinaciones de filtros para una mejor circulación del agua.
            </Alert>
          )}

          <Box display="flex" justifyContent="center" gap={2} mb={6}>
            <Button
              onClick={() => setDisplayMode("cards")}
              variant={displayMode === "cards" ? "contained" : "outlined"}
              color="primary"
              startIcon={<ViewModuleIcon />}
            >
              Tarjetas 🎴
            </Button>
            <Button
              onClick={() => setDisplayMode("table")}
              variant={displayMode === "table" ? "contained" : "outlined"}
              color="primary"
              startIcon={<TableChartIcon />}
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

          {/* Mensajes de recomendación de Sump */}
          {calculatedLiters &&
            calculatedLiters >= 450 &&
            calculatedLiters <= (maxCaudal * 2) / 10 && (
              <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2, mb: 2 }}>
                A partir de 450 litros, considere seriamente la filtración por
                sump como una alternativa superior a los filtros externos.
              </Alert>
            )}

          {calculatedLiters && calculatedLiters > (maxCaudal * 2) / 10 && (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2, mb: 2 }}>
              Para este volumen de acuario ({calculatedLiters} litros), la
              filtración con filtros externos NO es adecuada. Debe utilizar
              EXCLUSIVAMENTE filtración por sump.
            </Alert>
          )}

          {!isLoading &&
            !error &&
            filteredFilters.length > 0 && (
              <>
                <FiltersDisplay
                  filters={filteredFilters.slice(0, visibleFilters)}
                  displayMode={displayMode}
                  liters={calculatedLiters}
                  onFilterClick={handleFilterClick}
                />
                {filteredFilters.length > visibleFilters && (
                  <Box textAlign="center" mt={4}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleShowMore}
                      startIcon={<FilterListIcon />}
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
              liters={calculatedLiters}
            />
          )}
        </>
      )}
    </Container>
  );
}