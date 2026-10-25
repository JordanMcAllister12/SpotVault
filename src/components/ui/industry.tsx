import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Search, ChevronDown } from 'lucide-react';

// ── Design Tokens ───────────────────────────────────────────────────
// These reference CSS custom properties set by PortalRoomShell so every
// component that imports them automatically picks up the active portal's
// accent color (gold for SpotVault, green for StakeKings, etc.).
export const GOLD = 'var(--portal-accent, #d4a52c)';
export const GOLD_BRIGHT = 'var(--portal-accent-soft, #f5e6b0)';
export const BORDER_GOLD = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)';
export const BORDER_SUBTLE = 'rgba(255,255,255,0.08)';
export const BG_CARD = 'rgba(8, 7, 6, 0.82)';
export const BG_CARD_HOVER = 'rgba(10,8,7,0.65)';
export const BG_INPUT = 'rgba(8,11,14,0.92)';

// Spacing
export const SPACE = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.25rem',  // 20px
  xl: '1.5rem',   // 24px
} as const;

// Radius
export const RADIUS = {
  sm: '0.375rem',  // 6px — chips, tags
  md: '0.5rem',    // 8px — buttons, inputs
  lg: '0.75rem',   // 12px — cards, panels
} as const;

// ── SearchInput ─────────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
        strokeWidth={1.5}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.08] bg-[rgba(8,11,14,0.82)] py-2.5 pl-10 pr-4 text-sm text-white/85 placeholder:text-white/40 focus:border-[#c091e]/30 focus:outline-none focus:ring-1 focus:ring-[#c091e]/20"
      />
    </div>
  );
}

// ── TabButton ───────────────────────────────────────────────────────
export function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold tracking-wide uppercase transition-all whitespace-normal text-center leading-tight md:flex-row md:items-center md:gap-1.5 md:px-4 md:py-2 md:text-[10px] md:tracking-widest md:whitespace-nowrap ${
        active
          ? 'border-[#d4a52c]/40 bg-[#c0911e]/15 text-[#f5e6b0] shadow-[0_0_18px_-8px_rgba(212,165,44,0.55)]'
          : 'border-white/[0.08] bg-[rgba(8,11,14,0.90)] text-white/60 hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]'
      }`}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0 md:h-3.5 md:w-3.5" strokeWidth={1.5} />}
      {label}
    </button>
  );
}

// ── FilterChip ──────────────────────────────────────────────────────
export function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
        active
          ? 'border-[#c091e]/40 bg-[#c091e]/15 text-[#f5e6b0] shadow-md'
          : 'border-white/[0.08] bg-[rgba(8,11,14,0.90)] text-white/60 hover:border-white/20 hover:text-white/80 shadow-sm'
      }`}
    >
      {label}
    </button>
  );
}

// ── CardActionButton ────────────────────────────────────────────────
type ButtonVariant = 'secondary' | 'primary' | 'gold' | 'destructive' | 'success';

export function CardActionButton({
  onClick,
  icon: Icon,
  label,
  variant = 'secondary',
}: {
  onClick?: () => void;
  icon?: LucideIcon;
  label: string;
  variant?: ButtonVariant;
}) {
  const variants: Record<ButtonVariant, string> = {
    secondary:
      'border-white/[0.08] bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white/80',
    primary:
      'border-[#c091e]/20 bg-[#c091e]/8 text-[#f5e6b0] hover:bg-[#c091e]/15',
    gold:
      'border-[#c091e]/30 bg-[#c091e]/10 text-[#f5e6b0] hover:bg-[#c091e]/20',
    destructive:
      'border-red-500/20 bg-red-500/5 text-red-400/60 hover:bg-red-500/10',
    success:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-400/70 hover:bg-emerald-500/20',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[9px] font-semibold tracking-wide uppercase transition ${variants[variant]}`}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={1.5} />}
      {label}
    </button>
  );
}

// ── ContentCard ────────────────────────────────────────────────────
export function ContentCard({
  children,
  className = '',
  selected = false,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`group flex flex-col rounded-xl border p-4 shadow-lg transition-all hover:border-[#c091e]/30 hover:bg-[rgba(10,8,7,0.88)] ${selected ? 'border-[#c091e]/35 bg-[#c091e]/5' : 'border-[var(--portal-accent-rgb,212,165,44),0.12)] bg-[rgba(8,7,6,0.82)]'} ${className}`}
      style={{ boxShadow: '0 4px 20px -8px rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      {children}
    </div>
  );
}

// ── PageHeader ──────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
        <p className="mt-1 text-[11px] text-white/55">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

// ── SortDropdown ───────────────────────────────────────────────────
export function SortDropdown({
  value,
  onChange,
  options,
  label = 'Sort',
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { id: string; label: string }[];
  label?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-[#c091e]/20 bg-[rgba(8,7,6,0.95)] py-2 pl-3 pr-8 text-[10px] font-semibold tracking-widest text-white/65 uppercase outline-none transition-colors hover:border-[#c091e]/30 focus:border-[#c091e]/30"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#0a0b0e] text-white">
            {label}: {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40"
        strokeWidth={1.5}
      />
    </div>
  );
}

// ── Tag (informational, non-interactive) ────────────────────────────
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium tracking-wide text-white/55">
      {children}
    </span>
  );
}
