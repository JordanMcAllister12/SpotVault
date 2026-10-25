// ─── Replayer debug overlay: ?replayerDebug=1 ───────────────────────────────
// Development-only visual overlay showing seat geometry, anchors, and bounding
// boxes. Never appears in production unless the query flag is present AND the
// user is staff/admin (checked at call site). The hook returns whether debug
// mode is active and the parsed flag value.

import { useMemo } from 'react';

export function useReplayerDebug(): boolean {
  return useMemo(() => {
    if (!import.meta.env.DEV) return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('replayerDebug') === '1';
    } catch {
      return false;
    }
  }, []);
}

export interface DebugSeatInfo {
  seatIndex: number;
  position?: string;
  top: string;
  left: string;
  ux: number;
  uy: number;
  betAnchor?: { top: string; left: string };
  labelAnchor?: { top: string; left: string };
  buttonAnchor?: { top: string; left: string };
}

// Renders a small debug badge at a coordinate. Used by PokerTable when debug
// mode is on. Kept minimal so it never affects layout.
export function DebugBadge({ x, y, label, color = '#fbbf24' }: { x: string; y: string; label: string; color?: string }) {
  return (
    <div style={{
      position: 'absolute',
      top: y, left: x,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 999,
      fontSize: 7,
      fontWeight: 700,
      fontFamily: 'monospace',
      color: '#000',
      background: color,
      borderRadius: 2,
      padding: '1px 3px',
      whiteSpace: 'nowrap',
      border: '1px solid rgba(0,0,0,0.5)',
    }}>
      {label}
    </div>
  );
}
