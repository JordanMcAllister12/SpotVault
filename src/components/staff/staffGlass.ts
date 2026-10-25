/**
 * Shared glass styling tokens for the Staff Control Console.
 * Three-level hierarchy: shell > panel > card.
 */
export const STAFF_GLASS_SHELL = {
  background: 'linear-gradient(135deg, rgba(22,17,12,0.82), rgba(10,10,12,0.88))',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(207,163,77,0.22)',
  borderRadius: '12px',
  boxShadow: '0 8px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,224,166,0.06)',
} as const;

export const STAFF_GLASS_PANEL = {
  background: 'linear-gradient(135deg, rgba(49,38,27,0.40), rgba(13,13,15,0.55))',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(207,163,77,0.18)',
  borderRadius: '12px',
  boxShadow: '0 6px 20px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,224,166,0.04)',
} as const;

export const STAFF_GLASS_CARD = {
  background: 'linear-gradient(135deg, rgba(40,31,21,0.35), rgba(10,10,12,0.50))',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(207,163,77,0.12)',
  borderRadius: '10px',
  boxShadow: '0 4px 14px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,224,166,0.03)',
} as const;

export const STAFF_GLASS_NAV = {
  background: 'linear-gradient(180deg, rgba(22,17,12,0.70), rgba(10,10,12,0.78))',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
} as const;

export const STAFF_GLASS_TABLE_HEADER = {
  background: 'rgba(22,17,12,0.65)',
} as const;

export const STAFF_GLASS_TABLE_ROW_HOVER = 'rgba(207,163,77,0.06)';

/** Gold accent used across the staff console */
export const STAFF_GOLD = '#d4a52c';
export const STAFF_GOLD_SOFT = '#f5e6b0';
export const STAFF_BORDER = 'rgba(207,163,77,0.18)';
export const STAFF_BORDER_SUBTLE = 'rgba(207,163,77,0.10)';
