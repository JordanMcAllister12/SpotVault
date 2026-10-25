import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  Network,
  Coins,
  Bell,
  LayoutGrid,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react';
import type { PortalNavEntry } from '@/data/portalConfigs';

const GOLD = '#c0911e';
const GOLD_BRIGHT = '#d4a52c';

interface PortalShellProps {
  title: string;
  subtitle: string;
  navigation?: PortalNavEntry[];
  activeView: string;
  onNavigate: (view: string) => void;
  onExitHub: () => void;
  onNetworkDirectory: () => void;
  onOpenCredits: () => void;
  onTogglePortalSwitch: () => void;
  portalSwitchOpen: boolean;
  portalSwitcher: ReactNode;
  profileName: string;
  profileInitials: string;
  children: ReactNode;
  rightPanel?: ReactNode;
  headerRight?: ReactNode;
}

export function PortalShell({
  title,
  subtitle,
  activeView,
  onNavigate,
  onExitHub,
  onNetworkDirectory,
  onOpenCredits,
  onTogglePortalSwitch,
  portalSwitcher,
  profileName,
  profileInitials,
  children,
  rightPanel,
  headerRight,
  navigation = [],
}: PortalShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* ===== LAYER 0: Office Environment ===== */}
      <OfficeEnvironment />

      {/* ===== LAYER 2: UI Modules ===== */}
      <div className="relative z-10 flex h-full w-full flex-col">
        {/* ===== TOP BAR ===== */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/40 px-3 backdrop-blur-md sm:px-4">
          {/* Left: Back + Portal title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onExitHub}
              className="flex items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[10px] font-semibold tracking-widest text-white/40 uppercase transition-all hover:border-white/15 hover:text-white/70"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Access</span>
            </button>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-bold tracking-wide text-white">{title}</span>
              <span className="hidden text-[9px] font-mono tracking-[0.2em] text-[#c0911e]/70 uppercase sm:inline">{subtitle}</span>
            </div>
          </div>

          {/* Right: System actions */}
          {headerRight ?? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <TopBarIcon icon={MessageSquare} label="Chat" />
              <TopBarIcon icon={Network} label="Network" onClick={onNetworkDirectory} />
              <TopBarIcon icon={Coins} label="Credits" onClick={onOpenCredits} />
              {portalSwitcher}
              <TopBarIcon icon={Bell} label="Notifications" />
              <div className="mx-1 hidden h-5 w-px bg-white/[0.06] sm:block" />
              <div className="ml-1 flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-1">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #6b4a14)` }}
                >
                  {profileInitials}
                </div>
                <span className="hidden text-[10px] font-medium text-white/60 lg:inline">{profileName}</span>
              </div>
            </div>
          )}
        </header>

        {/* ===== BODY: Left Nav + Workspace + Right Panel ===== */}
        <div className="flex min-h-0 flex-1">
          {/* Left Navigation Rail */}
          <nav className="hidden w-16 shrink-0 flex-col border-r border-white/[0.06] bg-black/30 backdrop-blur-sm md:flex">
            {navigation.map((entry) => {
              const isActive = entry.id === activeView;
              return (
                <button
                  key={entry.id}
                  onClick={() => onNavigate(entry.id)}
                  className="group relative flex flex-col items-center gap-1 py-3.5 transition-all"
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r"
                      style={{ background: GOLD_BRIGHT }}
                    />
                  )}
                  <entry.icon
                    className="h-4 w-4 transition-colors"
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ color: isActive ? GOLD_BRIGHT : 'rgba(255,255,255,0.35)' }}
                  />
                  <span
                    className="text-[8px] font-semibold tracking-wide transition-colors"
                    style={{ color: isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}
                  >
                    {entry.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Mobile nav toggle */}
          <button
            onClick={() => setMobileNavOpen((o) => !o)}
            className="absolute left-3 top-14 z-20 flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/50 px-2.5 py-1.5 text-[10px] font-semibold text-white/60 backdrop-blur-sm md:hidden"
          >
            <LayoutGrid className="h-3 w-3" strokeWidth={1.5} />
            Menu
          </button>

          {/* Mobile nav dropdown */}
          {mobileNavOpen && (
            <>
              <div className="absolute inset-0 z-20 md:hidden" onClick={() => setMobileNavOpen(false)} />
              <div className="absolute left-3 top-20 z-20 w-48 max-w-[calc(100vw-24px)] rounded-lg border border-white/[0.08] bg-[#0a0c0e]/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden">
                {navigation.map((entry) => {
                  const isActive = entry.id === activeView;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        onNavigate(entry.id);
                        setMobileNavOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <entry.icon
                        className="h-3.5 w-3.5"
                        strokeWidth={isActive ? 2 : 1.5}
                        style={{ color: isActive ? GOLD_BRIGHT : 'rgba(255,255,255,0.4)' }}
                      />
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)' }}
                      >
                        {entry.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Main Workspace */}
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto h-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
              {children}
            </div>
          </main>

          {/* Optional Right Panel */}
          {rightPanel && (
            <aside className="hidden w-64 shrink-0 flex-col border-l border-white/[0.06] bg-black/20 backdrop-blur-sm lg:flex">
              {rightPanel}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBarIcon({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-white/35 transition-all hover:bg-white/5 hover:text-white/70"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
    </button>
  );
}

// ===== OFFICE ENVIRONMENT =====
function OfficeEnvironment() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base wall — charcoal near-black */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0e0d0b 0%, #0a0908 40%, #060504 100%)',
        }}
      />

      {/* Large window — warm indirect light from upper right */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 78% 18%, rgba(212,165,44,0.06) 0%, rgba(180,140,60,0.03) 30%, transparent 60%)',
        }}
      />

      {/* Desk surface — warm wood tone at bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 55%, rgba(30,22,14,0.4) 75%, rgba(20,14,8,0.6) 100%)',
        }}
      />

      {/* Subtle gold ambient detail — SpotVault warmth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 80%, rgba(192,145,30,0.025) 0%, transparent 50%)',
        }}
      />

      {/* Edge vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 45% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Architectural depth — subtle vertical lines suggesting shelves/window frames */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent 0px, transparent 120px, rgba(255,255,255,0.15) 120px, rgba(255,255,255,0.15) 121px)',
        }}
      />
    </div>
  );
}

// ===== Compatibility exports (used by BusinessHub, BusinessDesk, PlayerWire) =====

export function usePortalTheme() {
  return [
    { id: 'office', name: 'SpotVault Office', subtitle: '', gradient: '', accent: GOLD_BRIGHT },
    ] as const;
}

export function PrivacyBadge({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-[#c0911e]/20 bg-[#c0911e]/8 px-2 py-1">
      <span className="text-[9px] font-mono tracking-widest text-[#c0911e] uppercase">{label}</span>
      {sublabel && <span className="text-[9px] text-white/30">{sublabel}</span>}
    </div>
  );
}

// ===== Reusable Panel =====
interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlassPanel({ children, className = '' }: GlassPanelProps) {
  return (
    <div
      className={`rounded-xl border border-[#c0911e]/15 bg-black/30 p-4 backdrop-blur-md ${className}`}
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px -12px rgba(0,0,0,0.6)',
      }}
    >
      {children}
    </div>
  );
}

// ===== Empty State =====
interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 px-6 py-10 text-center backdrop-blur-sm">
      <span className="text-[10px] font-mono tracking-[0.25em] text-[#c0911e]/50 uppercase">{title}</span>
      <p className="mt-2 text-sm text-white/40">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-[#f5e6b0] transition-all hover:border-[#c0911e]/50 hover:bg-[#c0911e]/15"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
