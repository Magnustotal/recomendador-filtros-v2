"use client";

import { useState, useEffect, useCallback } from "react";

interface UseCarouselProps {
  itemCount: number;
  intervalDuration?: number;
  /** false desactiva por completo el auto-avance (p. ej. con "reducir movimiento"). */
  autoPlay?: boolean;
}

/**
 * Lógica de un carrusel con auto-avance que se pausa con ratón, foco de teclado
 * o el botón de pausa del usuario (WCAG 2.2.2: el movimiento automático debe
 * poder detenerse también en pantallas táctiles).
 */
export function useCarousel({ itemCount, intervalDuration = 7000, autoPlay = true }: UseCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  // Se incrementa con cada interacción manual para reiniciar el temporizador.
  const [tick, setTick] = useState(0);

  const isPlaying = autoPlay && !userPaused;
  const isPaused = !isPlaying || hoverPaused || focusPaused;

  const next = useCallback(() => {
    setDirection(1);
    setActiveIndex((i) => (i + 1) % itemCount);
    setTick((t) => t + 1);
  }, [itemCount]);

  const prev = useCallback(() => {
    setDirection(-1);
    setActiveIndex((i) => (i - 1 + itemCount) % itemCount);
    setTick((t) => t + 1);
  }, [itemCount]);

  const goTo = useCallback((index: number) => {
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
    setTick((t) => t + 1);
  }, [activeIndex]);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setDirection(1);
      setActiveIndex((i) => (i + 1) % itemCount);
    }, intervalDuration);
    return () => clearInterval(id);
  }, [isPaused, itemCount, intervalDuration, tick]);

  return {
    activeIndex,
    direction,
    isPlaying,
    handlers: {
      next,
      prev,
      goTo,
      togglePlay: () => setUserPaused((p) => !p),
      hoverStart: () => setHoverPaused(true),
      hoverEnd: () => setHoverPaused(false),
      focusStart: () => setFocusPaused(true),
      focusEnd: () => setFocusPaused(false),
    },
  };
}
