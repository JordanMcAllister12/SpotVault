import { useRef, useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Check,
  Pin,
  Info,
  ArrowRight,
  ArrowLeft,
  Search,
  Building2,
} from 'lucide-react';
import { PortalPopover } from '@/components/PortalPopover';
import { PORTAL_DEFINITIONS, canAccessPortal, getPortalStatus, isStaffOrAdmin, COMING_SOON_PORTALS, type HubId, type SpotVaultAccount } from '@/types';
import type { PortalId } from '@/useDemo';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';

interface Props {
  account: SpotVaultAccount | null;
  currentPortal: PortalId;
  onSwitch: (portal: PortalId) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  accent?: string;
  align?: 'left' | 'right';
  rememberPortal?: boolean;
  onRememberPortalChange?: (enabled: boolean) => void;
  onOpenCustomPortals?: () => void;
  customPortalLabel?: string | null;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;
}

type MenuLevel = 'environment' | 'default-roles' | 'custom-portals';

const DEFAULT_ROLES: { id: string; label: string }[] = [
  { id: 'PLAYER', label: 'Player' },
  { id: 'COACH', label: 'Coach' },
  { id: 'CREATOR', label: 'Creator / Pro' },
  { id: 'BUSINESS', label: 'Business' },
  { id: 'STABLE', label: 'Stable' },
  { id: 'MEDIA', label: 'Media' },
  { id: 'STAFF', label: 'Staff' },
];

const ROLE_PRIORITY: Record<string, number> = {
  PLAYER: 0, STAFF: 1, CREATOR: 2, BUSINESS: 3, COACH: 4, STABLE: 5, MEDIA: 6,
};

export function PortalSwitcher({
  account,
  currentPortal,
  onSwitch,
  open,
  onToggle,
  onClose,
  accent = '#d4a52c',
  align = 'left',
  rememberPortal = false,
  onRememberPortalChange,
  customPortalLabel,
  activePortalId,
  customPortals = [],
  onEnterCustomPortal,
  onReturnToDefault,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuLevel, setMenuLevel] = useState<MenuLevel>('environment');
  const [searchQuery, setSearchQuery] = useState('');

  const prefs = useUserPreferences(account?.id);
  const internalRemember = rememberPortal || prefs.prefs.rememberPortal;
  const handleRememberChange = (enabled: boolean) => {
    if (onRememberPortalChange) onRememberPortalChange(enabled);
    else void prefs.setRememberPortal(enabled);
  };

  useEffect(() => {
    if (!open) {
      setMenuLevel('environment');
      setSearchQuery('');
    }
  }, [open]);

  const isCustomActive = !!activePortalId;
  const isDefaultActive = !isCustomActive;

  const availableDefaultRoles = useMemo(() => {
    return DEFAULT_ROLES.filter((r) => {
      if (!account) return r.id === 'PLAYER';
      if (isStaffOrAdmin(account)) return true;
      if (r.id === 'STAFF') return false;
      // Show all standard SpotVault roles; coming-soon ones render as disabled
      return true;
    }).sort((a, b) => (ROLE_PRIORITY[a.id] ?? 99) - (ROLE_PRIORITY[b.id] ?? 99));
  }, [account]);

  const filteredCustomPortals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customPortals;
    return customPortals.filter((p) =>
      p.portal_name.toLowerCase().includes(q) ||
      p.portal_slug.toLowerCase().includes(q)
    );
  }, [customPortals, searchQuery]);

  // Top-nav button label: show custom portal name when inside one, otherwise the role
  const currentRoleLabel = DEFAULT_ROLES.find((r) => r.id === currentPortal)?.label ?? currentPortal;
  const buttonLabel = isCustomActive ? (customPortalLabel ?? currentRoleLabel) : currentRoleLabel;

  const handleDefaultRoleClick = (roleId: string) => {
    onSwitch(roleId as PortalId);
    onClose();
  };

  const handleCustomPortalClick = (portal: CustomPortalMembership) => {
    onEnterCustomPortal?.(portal);
    onClose();
  };

  const handleReturnToDefault = () => {
    if (onReturnToDefault) {
      onReturnToDefault();
      onClose();
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="hdr-white-btn group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all"
      >
        <span className="hdr-white-text relative z-10">{buttonLabel}</span>
        <ChevronDown className={`hdr-white-icon relative z-10 h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>

      <PortalPopover
        anchorRef={buttonRef}
        open={open}
        onClose={onClose}
        align={align}
        direction="down"
        width={240}
        className="portal-dropdown rounded-lg border border-[#6f5728] bg-[#101114] py-1 shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
      >
        {/* === LEVEL 1: ENVIRONMENT === */}
        {menuLevel === 'environment' && (
          <>
            <div className="px-3 py-1.5">
              <span className="text-[8px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Switch Experience</span>
            </div>
            <button
              onClick={() => setMenuLevel('default-roles')}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#151719]"
            >
              <span className="flex flex-col">
                <span className={`text-[11px] font-semibold ${isDefaultActive ? 'text-[#C7C9C7]' : 'text-[#9A9D9F]'}`}>Default</span>
                <span className="text-[9px] text-[#666A6D]">SpotVault</span>
              </span>
              <span className="flex items-center gap-1.5">
                {isDefaultActive && <Check className="h-3.5 w-3.5" strokeWidth={2} style={{ color: accent }} />}
                <ArrowRight className="h-3.5 w-3.5 text-[#9A9D9F]" strokeWidth={1.5} />
              </span>
            </button>
            {customPortals.length > 0 && (
              <button
                onClick={() => setMenuLevel('custom-portals')}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#151719]"
              >
                <span className="flex flex-col">
                  <span className={`text-[11px] font-semibold ${isCustomActive ? 'text-[#C7C9C7]' : 'text-[#9A9D9F]'}`}>Custom</span>
                  <span className="text-[9px] text-[#666A6D]">Partner &amp; community portals</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {isCustomActive && <Check className="h-3.5 w-3.5" strokeWidth={2} style={{ color: accent }} />}
                  <ArrowRight className="h-3.5 w-3.5 text-[#9A9D9F]" strokeWidth={1.5} />
                </span>
              </button>
            )}
            <div className="my-1 h-px bg-[#292C2E]" />
            <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => handleRememberChange(!internalRemember)}
                className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${internalRemember ? 'border-[#c0911e]/60 bg-[#c0911e]/15' : 'border-[#38424e] bg-[#161b21]'}`}
              >
                {internalRemember && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3">
                    <path d="M2 6 L5 9 L10 3" stroke="#d4a52c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className="flex items-center gap-1.5 text-[10px] text-[#9A9D9F]">
                <Pin className="h-3 w-3" strokeWidth={1.5} />
                Remember my selection
              </span>
            </label>
          </>
        )}

        {/* === LEVEL 2A: DEFAULT ROLES === */}
        {menuLevel === 'default-roles' && (
          <>
            <button
              onClick={() => setMenuLevel('environment')}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#151719]"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#9A9D9F]" strokeWidth={1.5} />
              <span className="text-[11px] font-semibold text-[#9A9D9F]">Switch Experience</span>
            </button>
            <div className="my-1 h-px bg-[#292C2E]" />
            <div className="px-3 py-1.5">
              <span className="text-[8px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Default SpotVault</span>
            </div>
            {availableDefaultRoles.map((role) => {
              const isActive = isDefaultActive && role.id === currentPortal;
              const isComingSoon = !account || (!isStaffOrAdmin(account) && COMING_SOON_PORTALS.includes(role.id as HubId));
              const hasPortalAccess = !account || isStaffOrAdmin(account) || canAccessPortal(account, role.id as HubId);
              // Coming-soon portals are always clickable (they show a coming-soon screen), but locked portals without access are not
              const isClickable = !isActive && (isComingSoon || hasPortalAccess);
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    if (!isClickable) return;
                    handleDefaultRoleClick(role.id);
                  }}
                  disabled={isActive}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'cursor-default' : isClickable ? 'hover:bg-[#151719]' : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <span className={`text-[11px] font-semibold ${isActive ? 'text-[#C7C9C7]' : isComingSoon ? 'text-[#666A6D]' : 'text-[#9A9D9F]'}`}>
                    {role.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {isActive ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={2} style={{ color: accent }} />
                    ) : isComingSoon ? (
                      <span className="rounded border border-[#c0911e]/20 bg-[#c0911e]/8 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-[#8a6820] uppercase">
                        Soon
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </>
        )}

        {/* === LEVEL 2B: CUSTOM PORTAL SEARCH === */}
        {menuLevel === 'custom-portals' && (
          <>
            <button
              onClick={() => setMenuLevel('environment')}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#151719]"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#9A9D9F]" strokeWidth={1.5} />
              <span className="text-[11px] font-semibold text-[#9A9D9F]">Switch Experience</span>
            </button>
            <div className="my-1 h-px bg-[#292C2E]" />
            <div className="px-3 py-1.5">
              <span className="text-[8px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Custom Portals</span>
            </div>
            {/* Search */}
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#666A6D]" strokeWidth={1.5} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search portals..."
                  className="w-full rounded-lg border border-[#292C2E] bg-[#0a0c0e] py-1.5 pl-8 pr-3 text-[11px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c0911e]/40"
                  autoFocus
                />
              </div>
            </div>
            {/* Results */}
            {!searchQuery.trim() && (
              <div className="px-3 pb-1">
                <span className="text-[8px] font-mono tracking-[0.2em] text-[#666A6D] uppercase">Your Portals</span>
              </div>
            )}
            {filteredCustomPortals.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <span className="text-[11px] text-white/35">No portals match your search.</span>
              </div>
            ) : (
              filteredCustomPortals.map((portal) => {
                const isActivePortal = activePortalId === portal.portal_slug;
                return (
                  <button
                    key={portal.portal_slug}
                    onClick={() => handleCustomPortalClick(portal)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#151719]"
                  >
                    <span className={`text-[11px] font-semibold ${isActivePortal ? 'text-[#C7C9C7]' : 'text-[#9A9D9F]'}`}>{portal.portal_name}</span>
                    <span className="flex items-center gap-1.5">
                      {isActivePortal && <Check className="h-3.5 w-3.5" strokeWidth={2} style={{ color: accent }} />}
                      {!isActivePortal && <ArrowRight className="h-3.5 w-3.5 text-[#9A9D9F]" strokeWidth={1.5} />}
                    </span>
                  </button>
                );
              })
            )}
          </>
        )}

        {menuLevel === 'custom-portals' && activePortalId && onReturnToDefault && (
          <>
            <div className="my-1 h-px bg-[#292C2E]" />
            <button
              onClick={handleReturnToDefault}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#151719]"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#9A9D9F]" strokeWidth={1.5} />
              <span className="text-[11px] font-semibold text-[#9A9D9F]">Return to SpotVault</span>
            </button>
          </>
        )}
      </PortalPopover>

      {notice && (
        <div className="absolute top-full left-0 mt-2 flex items-center gap-2 rounded-lg border border-[#c0911e]/20 bg-[#0a0c0e] px-3 py-2 text-[10px] text-[#d4a52c] shadow-xl" style={{ zIndex: 60 }}>
          <Info className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          {notice}
        </div>
      )}
    </div>
  );
}
