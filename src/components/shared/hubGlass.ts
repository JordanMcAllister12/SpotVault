export const HUB_GOLD = 'var(--portal-accent, #d4a52c)';
export const HUB_GOLD_SOFT = 'var(--portal-accent-soft, #f5e6b0)';

export const hubGlassPanel = {
  borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.22)',
  background: 'rgba(6, 8, 10, 0.42)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 60px -16px rgba(0,0,0,0.7)',
} as const;

export const hubGlassCard = {
  borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.18)',
  background: 'rgba(10, 9, 8, 0.55)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 4px 20px -6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
} as const;

export const hubGlassNav = {
  borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)',
  background: 'rgba(8, 7, 6, 0.82)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
} as const;

export const hubReadingSurface = {
  borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.08)',
  background: 'rgba(8,8,8,0.96)',
} as const;

export const hubMessageSurface = {
  borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.06)',
  background: 'rgba(6,5,4,0.97)',
} as const;

export const hubAnnouncementCard = {
  borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.12)',
  background: 'rgba(10, 9, 8, 0.85)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
} as const;
