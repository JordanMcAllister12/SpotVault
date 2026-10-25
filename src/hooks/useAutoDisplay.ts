import { useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_SPEED_PX_PER_SEC = 14;
const START_DELAY = 2500;
const RESUME_DELAY = 6000;
const BOTTOM_PAUSE = 1600;

interface AutoScrollState {
  autoEnabled: boolean;
  setAutoEnabled: (value: boolean) => void;
  registerScrollContainer: (element: HTMLElement | null) => void;
}

export function useAutoScroll(active: boolean): AutoScrollState {
  const [autoEnabled, setAutoEnabled] = useState(true);
  const containerRef = useRef<HTMLElement | null>(null);
  const [, forceUpdate] = useState(0);

  const rafRef = useRef<number>(0);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef(0);
  const bottomPauseUntilRef = useRef(0);
  const autoScrollingRef = useRef(false);

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = performance.now();
  }, []);

  const registerScrollContainer = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
    forceUpdate((n) => n + 1);
  }, []);

  const container = containerRef.current;

  // Attach interaction listeners — only real user actions pause auto-scroll.
  useEffect(() => {
    if (!container || !active) return;

    const onWheel = () => markInteraction();
    const onTouchStart = () => markInteraction();
    const onTouchMove = () => markInteraction();
    const onMouseDown = () => markInteraction();
    const onScroll = () => {
      if (!autoScrollingRef.current) markInteraction();
    };

    container.addEventListener('wheel', onWheel, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('scroll', onScroll);
    };
  }, [container, active, markInteraction]);

  // Main auto-scroll loop
  useEffect(() => {
    if (!active || !autoEnabled || !container) return;

    let cancelled = false;
    let lastTime = 0;

    const startAutoScroll = () => {
      if (cancelled || !autoEnabled) return;
      lastTime = performance.now();

      const tick = (now: number) => {
        if (cancelled || !autoEnabled) {
          autoScrollingRef.current = false;
          return;
        }

        const delta = Math.min(now - lastTime, 100);
        lastTime = now;

        if (now - lastInteractionRef.current < RESUME_DELAY) {
          autoScrollingRef.current = false;
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (now < bottomPauseUntilRef.current) {
          autoScrollingRef.current = false;
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 1) {
          autoScrollingRef.current = false;
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (container.scrollTop < maxScroll - 1) {
          autoScrollingRef.current = true;
          container.scrollTop += (delta / 1000) * SCROLL_SPEED_PX_PER_SEC;
        } else {
          autoScrollingRef.current = false;
          bottomPauseUntilRef.current = now + BOTTOM_PAUSE;
          container.scrollTo({ top: 0, behavior: 'smooth' });
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    startTimerRef.current = setTimeout(startAutoScroll, START_DELAY);

    return () => {
      cancelled = true;
      autoScrollingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
  }, [active, autoEnabled, container]);

  // Reset interaction state when activated
  useEffect(() => {
    if (active) {
      lastInteractionRef.current = 0;
      bottomPauseUntilRef.current = 0;
    }
  }, [active]);

  return { autoEnabled, setAutoEnabled, registerScrollContainer };
}
