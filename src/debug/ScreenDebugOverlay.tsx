// Development-only console logging. No visible UI.
// Default OFF. Enable via VITE_SCREEN_DEBUG=true in .env

export const SHOW_SCREEN_DEBUG = import.meta.env.VITE_SCREEN_DEBUG === 'true';

export const __debugSubView: { value: string | null } = { value: null };

export interface ScreenDebugState {
  canonicalScreen?: string;
  authState?: string;
  navPortal?: string;
  navLevel?: string;
  lastNavigation?: string;
  lastTrigger?: string;
  selectedPortal?: string;
  loginUsername?: string;
  portalContentView?: string | null;
  hubView?: string | null;
  isMobile?: boolean;
  viewportWidth?: number;
}

export function ScreenDebugOverlay({ debug }: { debug?: ScreenDebugState | null; onReset?: () => void }) {
  if (!SHOW_SCREEN_DEBUG) return null;
  if (debug?.canonicalScreen) {
    console.log('[SPOTVAULT DEBUG] Screen:', debug.canonicalScreen, 'Portal:', debug.navPortal, 'View:', debug.hubView);
  }
  return null;
}
