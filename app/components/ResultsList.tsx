"use client";

import React, { useState } from "react";
import { Box, Paper, Button, Stack } from "@mui/material";
import { AnimatePresence } from "framer-motion";
// 👇 AQUÍ ESTÁ LA CORRECCIÓN
import { useProcessedFilters, ExtendedFiltro } from "../hooks/useProcessedFilters"; 
import FilterDetailDialog from "./FilterDetailDialog";
import { FilterCard } from "./results/FilterCard";
import { ResultsControls } from "./results/ResultsControls";
import { NoResults } from "./results/NoResults";

const MAX_RESULTS_VISIBLE = 10;

interface ResultsListProps {
  filters: ExtendedFiltro[];
  liters: number;
}

const ResultsList: React.FC<ResultsListProps> = ({ filters, liters }) => {
  const [mainTab, setMainTab] = useState<0 | 1>(0);
  const [subTab, setSubTab] = useState<0 | 1>(0);
  const [showMore, setShowMore] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ExtendedFiltro | null>(null);
  const [sortBy, setSortBy] = useState<string>("caudal");

  const { recommended, minimum, hasResults } = useProcessedFilters(filters, liters, sortBy);

  if (!hasResults) {
    return <NoResults />;
  }
  
  const activeList = mainTab === 0 
    ? (subTab === 0 ? recommended.individual : recommended.pairs)
    : (subTab === 0 ? minimum.individual : minimum.pairs);
  
  const level = mainTab === 0 ? 'recommended' : 'minimum';
  const visibleList = showMore ? activeList : activeList.slice(0, MAX_RESULTS_VISIBLE);

  return (
    <>
      <Paper variant="outlined" sx={{ mt: 4 }}>
        <ResultsControls
          mainTab={mainTab} setMainTab={setMainTab}
          subTab={subTab} setSubTab={setSubTab}
          sortBy={sortBy} setSortBy={setSortBy}
          counts={{ 
            recommended: recommended.total,
            minimum: minimum.total,
            recInd: recommended.individual.length,
            recPair: recommended.pairs.length,
            minInd: minimum.individual.length,
            minPair: minimum.pairs.length,
          }}
        />

        <Box p={{ xs: 1, sm: 2 }}>
            {visibleList.length === 0 ? (
                <NoResults isCategory />
            ) : (
                <Stack spacing={2}>
                    <AnimatePresence>
                        {visibleList.map((filtro, index) => (
                            <FilterCard
                                key={`${filtro.marca}-${filtro.modelo}`}
                                filtro={filtro}
                                level={level}
                                index={index}
                                onDetailsClick={() => setSelectedFilter(filtro)}
                            />
                        ))}
                    </AnimatePresence>
                </Stack>
            )}

            {activeList.length > MAX_RESULTS_VISIBLE && (
              <Box textAlign="center" mt={3}>
                <Button onClick={() => setShowMore(s => !s)} variant="text">
                  {showMore ? "Mostrar menos" : `Mostrar ${activeList.length - MAX_RESULTS_VISIBLE} más`}
                </Button>
              </Box>
            )}
        </Box>
      </Paper>

      <FilterDetailDialog
        open={!!selectedFilter}
        filtro={selectedFilter}
        onClose={() => setSelectedFilter(null)}
      />
    </>
  );
};

export default ResultsList;