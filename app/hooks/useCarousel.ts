"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseCarouselProps {
  itemCount: number;
  intervalDuration?: number;
}

/**
 * Hook personalizado para gestionar la lógica de un carrusel.
 * @param itemCount - El número total de elementos en el carrusel.
 * @param intervalDuration - La duración en milisegundos para el auto-avance.
 * @returns El estado y los manejadores para controlar el carrusel.
 */
export function useCarousel({ itemCount, intervalDuration = 7000 }: UseCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const goToNext = useCallback(() => {
    setActiveIndex((prevIndex) => (prevIndex + 1) % itemCount);
  }, [itemCount]);

  const goToPrev = () => {
    setActiveIndex((prevIndex) => (prevIndex - 1 + itemCount) % itemCount);
  };

  const goToIndex = (index: number) => {
    setActiveIndex(index);
  };

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(goToNext, intervalDuration);
  }, [goToNext, intervalDuration]);

  // Efecto para controlar el auto-avance
  useEffect(() => {
    if (!isPaused) {
      startInterval();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, startInterval]);
  
  // Reiniciar el intervalo cuando el usuario interactúa
  const handleInteraction = () => {
    startInterval();
  };

  return {
    activeIndex,
    isPaused,
    handlers: {
      next: () => { handleInteraction(); goToNext(); },
      prev: () => { handleInteraction(); goToPrev(); },
      set: (index: number) => { handleInteraction(); goToIndex(index); },
      pause: () => setIsPaused(true),
      resume: () => setIsPaused(false),
    },
  };
}