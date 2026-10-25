import { useState } from 'react';
import { X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { UNIVERSAL_NAV_ENTRIES } from '@/data/portalConfigs';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

export type UniversalView = 'people' | 'opportunities' | 'marketplace' | 'jobs' | 'advertising' | 'store' | 'profile' | 'privacy' | 'terms' | 'settings' | 'explore' | 'about';

interface RailItem {
  id: UniversalView;
  label: string;
  icon: typeof UNIVERSAL_NAV_ENTRIES[0]['icon'];
}

const RAIL_ITEMS: RailItem[] = UNIVERSAL_NAV_ENTRIES
  .filter((e) => e.section === 'Industry')
  .map((e) => ({ id: e.id as UniversalView, label: e.label, icon: e.icon }));

interface Props {
  onNavigate: (view: UniversalView) => void;
}

export function UniversalRail({ onNavigate }: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed left-3 top-1/2 z-[75] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#1a1f25] bg-[#0a0c0e]/90 backdrop-blur transition-all hover:border-[#c0911e]/50"
          aria-label="Network Utilities"
        >
          <div className="flex flex-col gap-[3px]">
            <span className="block h-[1.5px] w-4 rounded-full" style={{ background: GOLD }} />
            <span className="block h-[1.5px] w-4 rounded-full" style={{ background: GOLD }} />
            <span className="block h-[1.5px] w-4 rounded-full" style={{ background: GOLD }} />
          </div>
        </button>

        {drawerOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
            <div
              className="flex flex-col gap-1 rounded-2xl border border-[#1a1f25] bg-[#0a0c0e] p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-center justify-between px-2">
                <span className="text-[8px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Industry</span>
                <button onClick={() => setDrawerOpen(false)} className="text-[#666A6D] hover:text-white">
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              {RAIL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setDrawerOpen(false); }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-[#151719]"
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
                    <span className="text-sm font-semibold text-[#C7C9C7]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="fixed left-0 top-0 z-[75] flex h-full flex-col items-center gap-2 border-r border-[#1a1f25] bg-[#0a0c0e]/80 py-4 backdrop-blur" style={{ width: '56px' }}>
      <div className="mb-2 text-[7px] font-mono tracking-[0.2em] text-[#475565] uppercase" style={{ writingMode: 'vertical-rl' }}>
        Industry
      </div>
      {RAIL_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-all hover:border-[#c0911e]/30 hover:bg-[#c0911e]/8"
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.45)' }} />
            {/* Hover label */}
            <span
              className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-[#1a1f25] bg-[#0a0c0e] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[#C7C9C7] uppercase opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100"
              style={{ borderColor: BORDER }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
