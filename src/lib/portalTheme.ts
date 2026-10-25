// Portal accent theme system.
// Each portal can have its own accent palette. Components consume these tokens
// instead of hardcoding gold/green values directly.
//
// To add a new partner theme: add an entry to PORTAL_THEMES and a new value to
// PortalThemeId. No component changes needed — they already read the tokens.

export type PortalThemeId = 'default' | 'stakekings';

export interface PortalAccentPalette {
  /** Primary accent color (replaces #d4a52c) */
  accent: string;
  /** Soft/light variant of accent (replaces #f5e6b0) */
  accentSoft: string;
  /** Darker shade of accent (replaces #c0911e) */
  accentDark: string;
  /** Accent at ~18% opacity for borders */
  border: string;
  /** Accent at ~10% opacity for backgrounds */
  backgroundTint: string;
  /** Accent at ~14% opacity for active backgrounds */
  backgroundActive: string;
  /** Accent at ~40% opacity for dim borders */
  borderDim: string;
  /** Accent at ~8% opacity for hover backgrounds */
  hoverTint: string;
  /** RGB string for rgba() usage, e.g. "212,165,44" */
  accentRgb: string;
  /** Glow color for box-shadow */
  glow: string;
}

export const PORTAL_THEMES: Record<PortalThemeId, PortalAccentPalette> = {
  default: {
    accent: '#d4a52c',
    accentSoft: '#f5e6b0',
    accentDark: '#c0911e',
    border: 'rgba(212,165,44,0.18)',
    backgroundTint: 'rgba(212,165,44,0.10)',
    backgroundActive: 'rgba(212,165,44,0.14)',
    borderDim: 'rgba(212,165,44,0.40)',
    hoverTint: 'rgba(212,165,44,0.08)',
    accentRgb: '212,165,44',
    glow: 'rgba(212,165,44,0.18)',
  },
  stakekings: {
    accent: '#39d98a',
    accentSoft: '#a7f3d0',
    accentDark: '#22a86b',
    border: 'rgba(57,217,138,0.18)',
    backgroundTint: 'rgba(57,217,138,0.10)',
    backgroundActive: 'rgba(57,217,138,0.14)',
    borderDim: 'rgba(57,217,138,0.40)',
    hoverTint: 'rgba(57,217,138,0.08)',
    accentRgb: '57,217,138',
    glow: 'rgba(57,217,138,0.18)',
  },
};

export function getPortalTheme(id: PortalThemeId): PortalAccentPalette {
  return PORTAL_THEMES[id] ?? PORTAL_THEMES.default;
}

export const STAKEKINGS_THEME_OPTIONS: { id: PortalThemeId; label: string; description: string }[] = [
  { id: 'default', label: 'SpotVault Default', description: 'Classic gold accent system' },
  { id: 'stakekings', label: 'StakeKings Theme', description: 'StakeKings green accent branding' },
];

// ── Lounge accent color presets ──
// Used by the Lounge Appearance settings to let users pick a frame/accent color.
// Each preset generates a full palette from a single hex color.

export interface LoungeAccentPreset {
  id: string;
  label: string;
  hex: string;
}

export const LOUNGE_ACCENT_PRESETS: LoungeAccentPreset[] = [
  { id: 'gold', label: 'Gold', hex: '#d4a52c' },
  { id: 'silver', label: 'Silver', hex: '#c0c8d0' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
];

/** Build a full PortalAccentPalette from a single hex color. */
export function buildAccentPalette(hex: string): PortalAccentPalette {
  const rgb = hexToRgb(hex);
  if (!rgb) return PORTAL_THEMES.default;
  const { r, g, b } = rgb;
  const rgbStr = `${r},${g},${b}`;
  return {
    accent: hex,
    accentSoft: lightenHex(hex, 0.35),
    accentDark: darkenHex(hex, 0.25),
    border: `rgba(${rgbStr},0.18)`,
    backgroundTint: `rgba(${rgbStr},0.10)`,
    backgroundActive: `rgba(${rgbStr},0.14)`,
    borderDim: `rgba(${rgbStr},0.40)`,
    hoverTint: `rgba(${rgbStr},0.08)`,
    accentRgb: rgbStr,
    glow: `rgba(${rgbStr},0.18)`,
  };
}

/** Resolve a lounge accent value (preset id or hex) to a full palette. */
export function resolveLoungeAccent(value: string | null | undefined): PortalAccentPalette {
  if (!value) return PORTAL_THEMES.default;
  const preset = LOUNGE_ACCENT_PRESETS.find((p) => p.id === value);
  if (preset) return buildAccentPalette(preset.hex);
  if (value.startsWith('#')) return buildAccentPalette(value);
  return PORTAL_THEMES.default;
}

// ── Color utilities ──

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function darkenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)));
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)));
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
