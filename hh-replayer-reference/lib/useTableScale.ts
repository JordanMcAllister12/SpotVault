import { useCallback, useEffect, useRef, useState } from 'react';

export type TableScaleMode = 'auto' | 'manual';

const MIN_SCALE = 0.55;
const MAX_SCALE = 1.25;
const STEP = 0.05;
const STORAGE_KEY = 'hh_replayer_table_scale';
const SEAT_STORAGE_KEY = 'hh_replayer_seat_scale';

const clampScale = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
const roundStep = (v: number) => Math.round(v / STEP) * STEP;

interface StoredPrefs {
  mode: TableScaleMode;
  manual: number;
  seat: number;
}

function loadPrefs(): StoredPrefs {
  const defaults: StoredPrefs = { mode: 'auto', manual: 0.9, seat: 0.9 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<StoredPrefs>;
    return {
      mode: p.mode === 'manual' ? 'manual' : 'auto',
      manual: typeof p.manual === 'number' ? clampScale(roundStep(p.manual)) : defaults.manual,
      seat: typeof p.seat === 'number' ? clampSeat(p.seat) : defaults.seat,
    };
  } catch {
    return defaults;
  }
}

const SEAT_OPTIONS = [0.7, 0.8, 0.9, 1.0, 1.1];
function clampSeat(v: number) {
  return SEAT_OPTIONS.reduce((best, o) => Math.abs(o - v) < Math.abs(best - v) ? o : best, SEAT_OPTIONS[2]);
}

export function useTableScale() {
  const initial = useRef(loadPrefs()).current;
  const [mode, setMode] = useState<TableScaleMode>(initial.mode);
  const [manualScale, setManualScale] = useState(initial.manual);
  const [seatScale, setSeatScale] = useState(initial.seat);
  const [autoScale, setAutoScale] = useState(initial.manual);

  // Persist on change
  useEffect(() => {
    const prefs: StoredPrefs = { mode, manual: manualScale, seat: seatScale };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [mode, manualScale, seatScale]);

  const recomputeAuto = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const availW = parent.clientWidth;
    const availH = parent.clientHeight;
    if (availW <= 0 || availH <= 0) return;
    // Natural scene size = unscaled content. Measure scrollWidth/Height of the inner element.
    const naturalW = el.scrollWidth || el.offsetWidth;
    const naturalH = el.scrollHeight || el.offsetHeight;
    if (naturalW <= 0 || naturalH <= 0) return;
    const pad = 24;
    const sx = (availW - pad) / naturalW;
    const sy = (availH - pad) / naturalH;
    const next = clampScale(Math.min(sx, sy, 1));
    setAutoScale(roundStep(next));
  }, []);

  // Recompute on resize
  useEffect(() => {
    const onResize = () => {
      // Defer to allow layout to settle
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[data-table-scene="main"]');
        recomputeAuto(el);
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recomputeAuto]);

  const effectiveScale = mode === 'manual' ? manualScale : autoScale;

  const setManual = useCallback((v: number) => {
    setMode('manual');
    setManualScale(clampScale(roundStep(v)));
  }, []);

  const stepUp = useCallback(() => setManual(manualScale + STEP), [manualScale, setManual]);
  const stepDown = useCallback(() => setManual(manualScale - STEP), [manualScale, setManual]);

  const resetToAuto = useCallback(() => {
    setMode('auto');
    const el = document.querySelector<HTMLElement>('[data-table-scene="main"]');
    recomputeAuto(el);
  }, [recomputeAuto]);

  const setSeat = useCallback((v: number) => {
    setSeatScale(clampSeat(v));
  }, []);

  return {
    mode,
    effectiveScale,
    manualScale,
    autoScale,
    seatScale,
    setManual,
    stepUp,
    stepDown,
    resetToAuto,
    setSeat,
    recomputeAuto,
  };
}

export { SEAT_OPTIONS, MIN_SCALE, MAX_SCALE, STEP };
