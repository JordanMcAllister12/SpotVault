import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Zap, ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useDemoUserState } from '@/lib/demoUserStore';
import { CommunityGivebackMeter } from '@/components/CommunityGivebackMeter';
import { PLAYER_NAV, UNIVERSAL_NAV_ENTRIES, type PortalNavEntry } from '@/data/portalConfigs';
import { FEATURE_FLAGS } from '@/lib/entitlements';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.15)';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  accountName?: string;
  accountUsername?: string;
  currentTitle?: string;
}

function buildMobileItems(): { items: { id: string; label: string; icon: LucideIcon; section: string }[]; sections: string[] } {
  const items = PLAYER_NAV.map((entry) => ({
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    section: entry.section ?? 'Main',
  }));
  const sections = [...new Set(items.map((i) => i.section))];
  return { items, sections };
}

const { items: MOBILE_ITEMS, sections: MOBILE_SECTIONS } = buildMobileItems();
const COLLAPSIBLE_SECTIONS = ['Legal'];

export function MobileNavDrawer({ open, onClose, onSelect, accountName, accountUsername, currentTitle }: Props) {
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(COLLAPSIBLE_SECTIONS.map((s) => [s, true]))
  );
  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        data-swipe-exclude="true"
        style={{ animation: 'fade-in 200ms ease-out forwards' }}
      />
      <div
        data-swipe-exclude="true"
        className="fixed bottom-0 left-0 top-0 z-[211] w-[300px] max-w-[85vw] overflow-y-auto sv-mobile-nav-drawer"
        style={{
          borderRight: `1px solid ${BORDER}`,
          boxShadow: '4px 0 40px -10px rgba(0,0,0,0.8)',
          animation: 'drawer-slide-in 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-4 pb-3 sv-mobile-nav-header" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(212,165,44,0.5)' }}>
              SpotVault
            </span>
            <h2 className="text-base font-bold text-white">Navigation</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-colors hover:text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {accountName && (
          <div className="mx-3 mt-3 rounded-xl border" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(212,165,44,0.04)' }}>
            {/* Collapsed: compact single row */}
            <button
              onClick={() => setProfileExpanded(e => !e)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white/80"
                style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)' }}
              >
                {accountName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{accountName}</span>
              <CompactLevelBadge />
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className="shrink-0 text-white/40 transition-transform"
                style={{ transform: profileExpanded ? 'rotate(180deg)' : 'none' }}
              />
            </button>

            {/* Expanded: full profile details */}
            {profileExpanded && (
              <div className="px-3 pb-2.5">
                {accountUsername && (
                  <p className="mb-1 truncate text-[10px] text-white/30">{accountUsername}</p>
                )}
                <RewardsStatus />
                <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
                  <CommunityGivebackMeter />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-3 pb-4 pt-2">
          {MOBILE_SECTIONS.map((section) => {
            const sectionItems = MOBILE_ITEMS.filter((i) => i.section === section);
            const isCollapsible = COLLAPSIBLE_SECTIONS.includes(section);
            const isCollapsed = isCollapsible && collapsedSections[section] !== false;
            return (
              <div key={section} className="mb-2">
                {isCollapsible ? (
                  <>
                    <button
                      onClick={() => toggleSection(section)}
                      className="flex w-full items-center justify-between px-3 pt-2 text-left"
                    >
                      <p className="text-[8px] font-mono tracking-[0.2em] uppercase text-white/30">{section}</p>
                      <ChevronDown
                        className="h-3 w-3 text-white/30 transition-transform"
                        style={{ transform: isCollapsed ? 'none' : 'rotate(180deg)' }}
                        strokeWidth={1.5}
                      />
                    </button>
                    {!isCollapsed && (
                      <div className="mt-1">
                        {sectionItems.map(({ id, label, icon: Icon }) => {
                          const isCurrent = currentTitle === label;
                          return (
                            <button
                              key={id}
                              onClick={() => { onSelect(id); onClose(); }}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                              style={isCurrent ? { background: 'rgba(212,165,44,0.08)' } : undefined}
                            >
                              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: isCurrent ? GOLD : 'rgba(255,255,255,0.45)' }} />
                              <span className="text-[13px] font-medium" style={{ color: isCurrent ? GOLD_SOFT : 'rgba(255,255,255,0.75)' }}>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mb-1 px-3 pt-2 text-[8px] font-mono tracking-[0.2em] uppercase text-white/30">{section}</p>
                    {sectionItems.map(({ id, label, icon: Icon }) => {
                      const isCurrent = currentTitle === label;
                      return (
                        <button
                          key={id}
                          onClick={() => { onSelect(id); onClose(); }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                          style={isCurrent ? { background: 'rgba(212,165,44,0.08)' } : undefined}
                        >
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: isCurrent ? GOLD : 'rgba(255,255,255,0.45)' }} />
                          <span className="text-[13px] font-medium" style={{ color: isCurrent ? GOLD_SOFT : 'rgba(255,255,255,0.75)' }}>{label}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
}

function RewardsStatus() {
  const user = useDemoUserState();
  return (
    <div className="mt-2.5 flex flex-col gap-2 border-t border-white/[0.06] pt-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: GOLD_SOFT }}>
          LVL {user.level}
        </span>
        <span className="text-white/15">·</span>
        <span className="text-[9px] font-mono font-bold tracking-wider" style={{ color: GOLD }}>
          {user.tier}
        </span>
        <span className="text-white/15">·</span>
        <span className="text-[9px] font-mono text-white/40">
          {user.xp.toLocaleString()} XP
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Zap className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[10px] font-mono font-bold" style={{ color: GOLD_SOFT }}>
            0
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center rounded-md border border-[#c0911e]/20 bg-[#c0911e]/[0.04] px-2 py-1">
        <span className="text-[8px] font-mono font-bold tracking-widest uppercase text-[#d4a52c]/60">
          Rewards — Coming Soon
        </span>
      </div>
    </div>
  );
}

function CompactLevelBadge() {
  const user = useDemoUserState();
  return (
    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider"
      style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
      LVL {user.level}
    </span>
  );
}
