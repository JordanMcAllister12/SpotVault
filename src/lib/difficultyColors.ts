export type ContentDepthLevel = 'quick_read' | 'detailed' | 'advanced_analysis';

export interface ContentDepthStyle {
  bg: string;
  text: string;
  border: string;
  glow: string;
  label: string;
}

const DEPTH_STYLES: Record<ContentDepthLevel, ContentDepthStyle> = {
  quick_read: {
    bg: 'rgba(22,199,132,0.12)',
    text: '#16C784',
    border: 'rgba(22,199,132,0.72)',
    glow: '0 0 18px rgba(22,199,132,0.16)',
    label: 'Quick Read',
  },
  detailed: {
    bg: 'rgba(245,197,66,0.12)',
    text: '#F5C542',
    border: 'rgba(245,197,66,0.72)',
    glow: '0 0 18px rgba(245,197,66,0.16)',
    label: 'Detailed',
  },
  advanced_analysis: {
    bg: 'rgba(240,68,68,0.12)',
    text: '#F04444',
    border: 'rgba(240,68,68,0.72)',
    glow: '0 0 18px rgba(240,68,68,0.16)',
    label: 'Advanced Analysis',
  },
};

const LEGACY_DIFFICULTY_MAP: Record<string, ContentDepthLevel> = {
  beginner: 'quick_read',
  easy: 'quick_read',
  medium: 'detailed',
  advanced: 'advanced_analysis',
  intermediate: 'detailed',
  expert: 'advanced_analysis',
  hard: 'advanced_analysis',
};

const DEPTH_KEY_MAP: Record<string, ContentDepthLevel> = {
  quick_read: 'quick_read',
  detailed: 'detailed',
  advanced_analysis: 'advanced_analysis',
  ...LEGACY_DIFFICULTY_MAP,
};

export function normalizeContentDepth(
  difficulty: string | null | undefined,
  tagsDifficulty?: string | null,
): ContentDepthLevel | null {
  const raw = difficulty?.trim().toLowerCase();
  if (raw && DEPTH_KEY_MAP[raw]) return DEPTH_KEY_MAP[raw];

  const tag = tagsDifficulty?.trim().toLowerCase();
  return tag ? DEPTH_KEY_MAP[tag] ?? null : null;
}

export function getContentDepthStyle(level: string): ContentDepthStyle | null {
  const normalized = normalizeContentDepth(level);
  return normalized ? DEPTH_STYLES[normalized] : null;
}

export function getContentDepthLabel(level: string): string {
  return getContentDepthStyle(level)?.label ?? level;
}

// ── Comprehension Difficulty (Easy / Medium / Hard) ──────────────────

export type ComprehensionLevel = 'easy' | 'medium' | 'hard';

export interface ComprehensionStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

const COMPREHENSION_STYLES: Record<ComprehensionLevel, ComprehensionStyle> = {
  easy: {
    bg: 'rgba(22,199,132,0.08)',
    text: '#16C784',
    border: 'rgba(22,199,132,0.30)',
    label: 'Easy',
  },
  medium: {
    bg: 'rgba(245,197,66,0.08)',
    text: '#F5C542',
    border: 'rgba(245,197,66,0.30)',
    label: 'Medium',
  },
  hard: {
    bg: 'rgba(240,68,68,0.08)',
    text: '#F04444',
    border: 'rgba(240,68,68,0.30)',
    label: 'Hard',
  },
};

const COMPREHENSION_KEY_MAP: Record<string, ComprehensionLevel> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
};

export function normalizeComprehension(
  value: string | null | undefined,
): ComprehensionLevel | null {
  const raw = value?.trim().toLowerCase();
  if (raw && COMPREHENSION_KEY_MAP[raw]) return COMPREHENSION_KEY_MAP[raw];
  return null;
}

export function getComprehensionStyle(level: string): ComprehensionStyle | null {
  const normalized = normalizeComprehension(level);
  return normalized ? COMPREHENSION_STYLES[normalized] : null;
}

// ── Tournament Stakes ────────────────────────────────────────────────

export type StakesLevel = 'micro' | 'low' | 'mid' | 'high' | 'nosebleed';

export interface StakesStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

const STAKES_STYLES: Record<StakesLevel, StakesStyle> = {
  micro: {
    bg: 'transparent',
    text: 'rgba(255,255,255,0.45)',
    border: 'rgba(255,255,255,0.12)',
    label: 'Micro Stakes',
  },
  low: {
    bg: 'transparent',
    text: 'rgba(255,255,255,0.55)',
    border: 'rgba(255,255,255,0.15)',
    label: 'Low Stakes',
  },
  mid: {
    bg: 'transparent',
    text: '#d4a52c',
    border: 'rgba(212,165,44,0.25)',
    label: 'Mid Stakes',
  },
  high: {
    bg: 'transparent',
    text: '#f5e6b0',
    border: 'rgba(212,165,44,0.40)',
    label: 'High Stakes',
  },
  nosebleed: {
    bg: 'rgba(212,165,44,0.08)',
    text: '#fff4c7',
    border: 'rgba(212,165,44,0.55)',
    label: 'Nosebleed',
  },
};

const STAKES_KEY_MAP: Record<string, StakesLevel> = {
  micro: 'micro',
  low: 'low',
  mid: 'mid',
  high: 'high',
  nosebleed: 'nosebleed',
};

export function normalizeStakes(
  value: string | null | undefined,
): StakesLevel | null {
  const raw = value?.trim().toLowerCase();
  if (raw && STAKES_KEY_MAP[raw]) return STAKES_KEY_MAP[raw];
  return null;
}

export function getStakesStyle(level: string): StakesStyle | null {
  const normalized = normalizeStakes(level);
  return normalized ? STAKES_STYLES[normalized] : null;
}

export function estimateReadingTimeMinutes(spot: {
  subtitle?: string | null;
  introduction?: string | null;
  hand_details?: string | null;
  content_html?: string | null;
}): number {
  const parts: string[] = [];
  if (spot.subtitle) parts.push(spot.subtitle);
  if (spot.introduction) parts.push(spot.introduction);
  if (spot.hand_details) parts.push(spot.hand_details);
  if (spot.content_html) parts.push(spot.content_html);

  const text = parts.join(' ');
  const stripped = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = stripped ? stripped.split(' ').filter(Boolean) : [];
  if (words.length === 0) return 0;
  return Math.max(1, Math.round(words.length / 225));
}
