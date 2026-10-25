import { useState } from 'react';
import { Lock, RotateCcw, Check } from 'lucide-react';
import type { ReactNode } from 'react';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

export type DockWindowState = 'closed' | 'open' | 'active' | 'minimized';

export interface DockItem {
  id: string;
  title: string;
  icon: ReactNode;
  badge?: number;
  state: DockWindowState;
}

interface WindowDockProps {
  items: DockItem[];
  onClick: (id: string) => void;
  hasSavedLayout?: boolean;
  onLockDefault?: () => void;
  onResetDefault?: () => void;
}

export function WindowDock({ items, onClick, hasSavedLayout, onLockDefault, onResetDefault }: WindowDockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleLock = () => {
    onLockDefault?.();
    setMenuOpen(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const handleReset = () => {
    onResetDefault?.();
    setMenuOpen(false);
  };

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[9000] flex justify-center px-3 pb-3">
      <div
        className="pointer-events-auto flex items-center gap-1.5 rounded-2xl px-2 py-2"
        style={{
          background: 'rgba(8, 7, 6, 0.88)',
          border: `1px solid ${BORDER}`,
          boxShadow: '0 -4px 24px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(212,165,44,0.06)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        {items.map((item) => {
          const isOpen = item.state === 'open' || item.state === 'active';
          const isActive = item.state === 'active';
          const isMinimized = item.state === 'minimized';

          return (
            <button
              key={item.id}
              onClick={() => onClick(item.id)}
              title={item.title}
              aria-label={item.title}
              className="group relative flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all duration-200 hover:scale-105"
              style={{
                background: isActive
                  ? 'rgba(192,145,30,0.14)'
                  : isOpen
                    ? 'rgba(192,145,30,0.06)'
                    : 'transparent',
                border: `1px solid ${
                  isActive
                    ? 'rgba(212,165,44,0.4)'
                    : isOpen
                      ? BORDER
                      : 'rgba(255,255,255,0.06)'
                }`,
                boxShadow: isActive
                  ? '0 0 12px -2px rgba(212,165,44,0.25), inset 0 1px 0 rgba(212,165,44,0.08)'
                  : 'none',
              }}
            >
              {item.icon}
              <span
                className="text-[10px] font-semibold tracking-wide transition-colors"
                style={{
                  color: isActive ? GOLD_SOFT : isOpen ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)',
                }}
              >
                {item.title}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[8px] font-bold"
                  style={{ background: 'rgba(212,165,44,0.25)', color: GOLD_SOFT, border: `1px solid ${BORDER}` }}
                >
                  {item.badge}
                </span>
              )}
              {/* State indicator dot */}
              {isMinimized && (
                <span
                  className="absolute -top-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ background: GOLD, boxShadow: `0 0 4px ${GOLD}` }}
                />
              )}
              {/* Active indicator underline */}
              {isActive && (
                <span
                  className="absolute -bottom-0.5 left-2 right-2 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
                />
              )}
            </button>
          );
        })}

        {/* Divider */}
        {onLockDefault && (
          <div className="mx-0.5 h-7 w-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        )}

        {/* Lock as Default */}
        {onLockDefault && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              title="Save current layout as your default"
              aria-label="Save current layout as your default"
              className="group relative flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all duration-200 hover:scale-105"
              style={{
                background: justSaved ? 'rgba(52,211,153,0.12)' : hasSavedLayout ? 'rgba(192,145,30,0.06)' : 'transparent',
                border: `1px solid ${justSaved ? 'rgba(52,211,153,0.3)' : hasSavedLayout ? BORDER : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {justSaved ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
              ) : (
                <Lock className="h-3.5 w-3.5" style={{ color: hasSavedLayout ? GOLD : 'rgba(255,255,255,0.4)' }} strokeWidth={1.5} />
              )}
              <span
                className="text-[10px] font-semibold tracking-wide transition-colors"
                style={{ color: justSaved ? '#6ee7b7' : hasSavedLayout ? GOLD_SOFT : 'rgba(255,255,255,0.4)' }}
              >
                {justSaved ? 'Saved' : 'Default'}
              </span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute bottom-full right-0 mb-2 w-[200px] rounded-lg border p-1.5"
                  style={{
                    borderColor: BORDER,
                    background: 'rgba(12,10,8,0.95)',
                    boxShadow: '0 12px 32px -8px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(14px)',
                    zIndex: 9999,
                  }}
                >
                  <button
                    onClick={handleLock}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold tracking-wide text-white/70 uppercase transition-colors hover:bg-[#c0911e]/10 hover:text-[#f5e6b0]"
                  >
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Lock as Default
                  </button>
                  {hasSavedLayout && (
                    <button
                      onClick={handleReset}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold tracking-wide text-white/50 uppercase transition-colors hover:bg-white/5 hover:text-white/70"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Reset Default Layout
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Subtle confirmation toast */}
      {justSaved && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 flex items-center gap-1.5 rounded-md border px-3 py-1.5"
          style={{
            borderColor: 'rgba(52,211,153,0.25)',
            background: 'rgba(6,20,14,0.92)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} />
          <span className="text-[10px] font-medium text-emerald-300">Default Player Room layout saved.</span>
        </div>
      )}
    </div>
  );
}
