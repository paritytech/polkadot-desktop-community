import { createState, persistLocalStorage } from '@/shared/rxstate';

const ZOOM_STORAGE_KEY = 'webview-zoom-levels';

// Electron zoom *level* units. level 0 = 100%, each step ≈ ×1.2. Clamp keeps the
// guest content readable (~23%) and bounded (~516%).
export const MIN_ZOOM_LEVEL = -8;
export const MAX_ZOOM_LEVEL = 9;

// Per-product zoom level, keyed by product id (= tab id, stable across relaunch).
// Persisted so each product reopens at the zoom the user left it at.
const levels$ = createState<Record<string, number>>({});

persistLocalStorage(levels$, { key: ZOOM_STORAGE_KEY });

function clampLevel(level: number): number {
  return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, level));
}

export function levelToPercent(level: number): number {
  return Math.round(1.2 ** level * 100);
}

// Only emits when the clamped level actually changes — pressing zoom at a limit (or
// resetting an already-100% product) is a no-op, so consumers (the indicator) never
// react to it. This is what keeps the indicator silent unless the zoom truly changed.
function setLevel(productId: string, next: number) {
  const clamped = clampLevel(next);
  if ((levels$.get()[productId] ?? 0) === clamped) return;
  levels$.set(prev => ({ ...prev, [productId]: clamped }));
}

const zoomIn = (productId: string) => setLevel(productId, (levels$.get()[productId] ?? 0) + 1);
const zoomOut = (productId: string) => setLevel(productId, (levels$.get()[productId] ?? 0) - 1);
const reset = (productId: string) => setLevel(productId, 0);

export const webviewZoom = {
  levels$,
  zoomIn,
  zoomOut,
  reset,
};
