/**
 * Shared Store design tokens — the visual language for all four Store-area pages:
 * Store (memberships), Spot Library, Multi-Spot / Courses, and StakeKings Action.
 *
 * Same building, different departments.
 */

/** Primary gold accent — resolves to the active portal's accent via CSS custom property */
export const GOLD = 'var(--portal-accent, #d4a52c)';

/** Soft gold for text on dark backgrounds */
export const GOLD_SOFT = 'var(--portal-accent-soft, #f5e6b0)';

/** Card border — subtle accent-tinted */
export const CARD_BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.12)';

/** Card surface — warm charcoal translucent glass */
export const CARD_BG = 'rgba(12, 10, 8, 0.88)';

/** Card shadow — subtle depth */
export const CARD_SHADOW = '0 2px 12px -4px rgba(0,0,0,0.5)';

/** Dark panel surface — slightly deeper than card, for nested containers */
export const PANEL_BG = 'rgba(8, 7, 6, 0.88)';

/** Deepest panel — for replayer / immersive content */
export const PANEL_BG_DEEP = 'rgba(5,4,3,0.75)';

/** Inner divider color (borders within cards) */
export const DIVIDER = '#1a1f25';

/** Inactive control surface */
export const CTRL_BG = '#161b21';

/** Inactive control border */
export const CTRL_BORDER = '#232a32';

/** Inactive control hover border */
export const CTRL_HOVER_BORDER = '#38424e';

/** Inactive control text */
export const CTRL_TEXT = '#84929f';

/** Shared container max-width for all Store pages */
export const STORE_MAX_WIDTH = 'max-w-5xl';

/** Shared page padding */
export const STORE_PADDING = 'px-4 pt-2 pb-20 sm:px-6 sm:pt-4 sm:pb-6';

/** Shared card radius */
export const CARD_RADIUS = 'rounded-xl';

/** Shared button classes — gold CTA */
export const GOLD_CTA =
  'flex items-center gap-1 rounded-md border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25';

/** Shared filter tab button classes (gold active state) */
export const FILTER_TAB_BASE =
  'shrink-0 rounded-lg border px-2 py-1 text-[9px] font-semibold tracking-widest uppercase transition-all sm:px-3 sm:py-1.5 sm:text-[10px]';

export const FILTER_TAB_ACTIVE = 'border-[#c0911e]/50 bg-[#1a1408] text-[#f5e6b0] shadow-[0_0_12px_-4px_rgba(212,165,44,0.3)]';
export const FILTER_TAB_INACTIVE = 'border-[#1a1f25] bg-[#0d1115] text-white/50 hover:border-[#2a323a] hover:text-white/70';

/**
 * Shared FilterTabBar — canonical page-level tab/filter/segmented control.
 * Renders a row of compact, dark, gold-accented tab buttons with consistent
 * height, padding, radius, typography, and active/inactive states.
 * Used by Store, Spot Library, My Spots, StakeKings Action, and any other
 * page that needs equivalent navigation tabs or category filters.
 */
export function FilterTabBar<T extends string>({
  tabs,
  active,
  onChange,
  labels,
  icons,
  className,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  labels?: Record<T, string>;
  icons?: Partial<Record<T, React.ReactNode>>;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex gap-1 overflow-x-auto pb-1 no-scrollbar ${className ?? ''}`} style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex items-center gap-1.5 ${FILTER_TAB_BASE} ${
            active === tab ? FILTER_TAB_ACTIVE : FILTER_TAB_INACTIVE
          }`}
        >
          {icons?.[tab]}
          {labels?.[tab] ?? tab}
        </button>
      ))}
    </div>
  );
}

/** Shared page header glass treatment — semi-transparent smoked glass for title bars */
export const PAGE_HEADER_GLASS = {
  background: 'rgba(15, 12, 10, 0.70)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(190, 145, 65, 0.22)',
  boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)',
} as const;

/** Shared search input classes */
export const SEARCH_INPUT =
  'w-full rounded-lg border border-[#232a32] bg-[#161b21] py-2 pl-9 pr-3 text-[11px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c091e]/30 sm:w-52';

/** Shared card surface style object (for style={{}} props) */
export const CARD_STYLE = {
  borderColor: CARD_BORDER,
  background: CARD_BG,
  boxShadow: CARD_SHADOW,
} as const;

/** Shared header icon container style */
export const HEADER_ICON_STYLE = {
  background: 'linear-gradient(135deg, rgba(var(--portal-accent-rgb, 212,165,44), 0.12), rgba(var(--portal-accent-rgb, 212,165,44), 0.04))',
  border: '1px solid rgba(var(--portal-accent-rgb, 212,165,44), 0.15)',
} as const;

/** Shared header subtitle color */
export const HEADER_SUBTITLE_COLOR = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.6)';

/** StakeKings green accent (secondary brand) */
export const SK_GREEN = '#1a8f4a';

/**
 * Shared Store-section header — standardizes icon tile, title, subtitle, and
 * optional action area across all four Store pages. Uses the same surface
 * treatment as PlayerRoomHeader so pages feel like the same building.
 */
export function StoreHeader({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2 backdrop-blur-md"
      style={{
        background: PAGE_HEADER_GLASS.background,
        backdropFilter: PAGE_HEADER_GLASS.backdropFilter,
        WebkitBackdropFilter: PAGE_HEADER_GLASS.WebkitBackdropFilter,
        border: PAGE_HEADER_GLASS.border,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={HEADER_ICON_STYLE}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold tracking-tight text-white">{title}</h2>
        {subtitle && (
          <span
            className="text-[9px] font-mono tracking-[0.2em] uppercase"
            style={{ color: HEADER_SUBTITLE_COLOR }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
