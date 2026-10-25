import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';

const TARGET_WIDTH_RATIO = 0.92;
const MOBILE_BREAKPOINT = 768;

const NATURAL_SCENE_WIDTH = 720;
export const NATURAL_SCENE_HEIGHT = 446;
export const TABLE_BOTTOM_GAP = 16;

export function useTableScale<T extends HTMLElement = HTMLDivElement>(enabled = true, desktopScale = 1, fitToContainer = false) {
  const containerRef = useRef<T>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled]);

  const measure = useCallback(() => {
    if (!enabled) return;
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
      setContainerHeight(containerRef.current.clientHeight);
      setMeasured(true);
    }
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled) {
      setContainerWidth(0);
      setContainerHeight(0);
      setMeasured(false);
      return;
    }
    measure();
    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure, enabled]);

  const active = enabled && isMobile;
  const mobileScale = active && containerWidth > 0
    ? Math.max(0.15, Math.min(
        1,
        (containerWidth * TARGET_WIDTH_RATIO) / NATURAL_SCENE_WIDTH,
        ...(containerHeight >= NATURAL_SCENE_HEIGHT ? [Math.max(0, (containerHeight - TABLE_BOTTOM_GAP) * 0.92) / NATURAL_SCENE_HEIGHT] : []),
      ))
    : 1;

  const fitScale = (!active && fitToContainer && containerWidth > 0 && containerHeight > 0)
    ? Math.max(0.15, Math.min(
        (containerWidth * TARGET_WIDTH_RATIO) / NATURAL_SCENE_WIDTH,
        (Math.max(0, containerHeight - TABLE_BOTTOM_GAP) * 0.92) / NATURAL_SCENE_HEIGHT,
      ))
    : (!active ? desktopScale : 1);

  const scale = active ? mobileScale : fitScale;

  const scaledHeight = enabled ? NATURAL_SCENE_HEIGHT * scale : 0;

  const ready = !active || measured;

  return { containerRef, scale, scaledHeight, isMobile: active, ready };
}
