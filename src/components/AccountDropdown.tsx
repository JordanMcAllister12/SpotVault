import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  User, Home, Gift, LogOut, ChevronDown, ShieldCheck,
} from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import { Avatar } from '@/components/shared/Avatar';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export interface AccountDropdownProps {
  account: SpotVaultAccount | null;
  portalLabel: string;
  onMyProfile?: () => void;
  onBackToHome?: () => void;
  onAccountSecurity?: () => void;
  onRewardsProgress?: () => void;
  onLogout?: () => void;
}

export function AccountDropdown({
  account,
  portalLabel,
  onMyProfile,
  onBackToHome,
  onAccountSecurity,
  onRewardsProgress,
  onLogout,
}: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      const menuWidth = 224; // w-56
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const top = rect.bottom + 8;
      setMenuPos({ top, left });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: { label: string; icon: typeof User; onClick?: () => void; badge?: string; disabled?: boolean }[] = [
    { label: 'My Profile', icon: User, onClick: onMyProfile },
    { label: 'Back to Home', icon: Home, onClick: onBackToHome },
    { label: 'Account & Security', icon: ShieldCheck, onClick: onAccountSecurity },
    { label: 'Rewards & Progress', icon: Gift, onClick: onRewardsProgress },
    { label: 'Log Out', icon: LogOut, onClick: onLogout },
  ];

  const handleItemClick = (item: typeof items[number]) => {
    if (item.disabled || !item.onClick) return;
    item.onClick();
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hdr-white-btn group relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar
          userId={account?.id}
          name={account?.name ?? portalLabel}
          size={24}
          className="h-6 w-6"
          ringClass="border-white/10"
        />
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <div className="hdr-white-text text-[10px] font-semibold">{account?.name ?? `${portalLabel} Member`}</div>
            {account?.partnerAffiliation && ['sk', 'stakekings'].some((value) => account.partnerAffiliation?.toLowerCase().includes(value)) && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-emerald-300">SK Academy</span>
            )}
          </div>
          <div className="hdr-white-text text-[8px] font-mono tracking-widest uppercase opacity-70">{portalLabel}</div>
        </div>
        <ChevronDown
          className="hdr-white-icon h-3.5 w-3.5 transition-transform duration-200"
          strokeWidth={1.5}
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-56 rounded-xl border border-white/10 bg-[#0c0d0e] p-1.5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.9)]"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            <div className="mb-1.5 border-b border-white/[0.06] px-2.5 pb-2 pt-1">
              <div className="text-[10px] font-semibold text-white/80">{account?.name ?? `${portalLabel} Member`}</div>
              <div className="text-[8px] font-mono tracking-widest uppercase text-white/40">{portalLabel}</div>
            </div>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition-colors enabled:hover:bg-white/8 enabled:hover:text-white disabled:cursor-default disabled:opacity-50"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                  role="menuitem"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} style={{ color: item.label === 'Log Out' ? 'rgba(239,68,68,0.6)' : GOLD }} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className="rounded-full border px-1.5 py-0.5 text-[7px] font-bold tracking-wide"
                      style={{ borderColor: GOLD + '30', background: GOLD + '10', color: GOLD_SOFT }}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.label === 'Log Out' && !item.badge && (
                    <LogOut className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} style={{ color: 'rgba(239,68,68,0.6)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
