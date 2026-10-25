import { UNIVERSAL_NAV_ENTRIES } from '@/data/portalConfigs';
import type { UniversalView } from '@/components/UniversalRail';

export interface UniversalNavItem {
  id: UniversalView;
  label: string;
  icon: typeof UNIVERSAL_NAV_ENTRIES[0]['icon'];
}

export const UNIVERSAL_NAV_ITEMS: UniversalNavItem[] = UNIVERSAL_NAV_ENTRIES
  .filter((e) => e.section === 'Industry')
  .map((e) => ({ id: e.id as UniversalView, label: e.label, icon: e.icon }));

export const LEGAL_NAV_ITEMS: UniversalNavItem[] = UNIVERSAL_NAV_ENTRIES
  .filter((e) => e.section === 'Legal')
  .map((e) => ({ id: e.id as UniversalView, label: e.label, icon: e.icon }));

interface Props {
  onNavigate: (view: UniversalView) => void;
  variant?: 'player' | 'investor';
  activeView?: string | null;
  compact?: boolean;
}

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

export function UniversalNavSection({ onNavigate, variant = 'investor', activeView, compact }: Props) {
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        {UNIVERSAL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-all"
              style={{
                borderColor: active ? 'rgba(192,145,30,0.35)' : 'transparent',
                background: active ? 'rgba(192,145,30,0.12)' : 'transparent',
              }}
              title={item.label}
            >
              <Icon
                className="h-3.5 w-3.5 shrink-0 transition-colors"
                strokeWidth={1.5}
                style={{ color: active ? GOLD : 'rgba(255,255,255,0.3)' }}
              />
            </button>
          );
        })}
        {LEGAL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border transition-all"
              style={{
                borderColor: active ? 'rgba(192,145,30,0.2)' : 'transparent',
                background: active ? 'rgba(192,145,30,0.06)' : 'transparent',
              }}
              title={item.label}
            >
              <Icon
                className="h-3 w-3 shrink-0 transition-colors"
                strokeWidth={1.5}
                style={{ color: active ? GOLD : 'rgba(255,255,255,0.2)' }}
              />
            </button>
          );
        })}
      </div>
    );
  }
  if (variant === 'player') {
    return (
      <div className="px-3 py-2">
        <div className="mb-1.5 px-3">
          <span className="text-[8px] font-mono tracking-[0.25em] text-[#c0911e]/50 uppercase">
            Industry
          </span>
        </div>
        {UNIVERSAL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="group relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 transition-all border"
              style={{
                borderColor: active ? 'rgba(192,145,30,0.35)' : 'transparent',
                background: active ? 'rgba(192,145,30,0.12)' : 'transparent',
              }}
            >
              {active && <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[#d4a52c]" />}
              <Icon
                className="mt-px h-4 w-4 shrink-0 transition-colors"
                strokeWidth={1.5}
                style={{ color: active ? GOLD : 'rgba(255,255,255,0.3)' }}
              />
              <span
                className="text-[11px] font-medium leading-tight tracking-wide transition-colors"
                style={{ color: active ? GOLD_SOFT : 'rgba(255,255,255,0.35)' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
        {/* Legal subsection */}
        <div className="mt-10 mb-1.5 px-3">
          <span className="text-[7px] font-mono tracking-[0.25em] text-[#475565] uppercase">
            Legal
          </span>
        </div>
        {LEGAL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="group relative flex w-full items-start gap-3 rounded-lg px-3 py-2 transition-all border"
              style={{
                borderColor: active ? 'rgba(192,145,30,0.2)' : 'transparent',
                background: active ? 'rgba(192,145,30,0.06)' : 'transparent',
              }}
            >
              <Icon
                className="mt-px h-3.5 w-3.5 shrink-0 transition-colors"
                strokeWidth={1.5}
                style={{ color: active ? GOLD : 'rgba(255,255,255,0.2)' }}
              />
              <span
                className="text-[10px] font-medium leading-tight tracking-wide transition-colors"
                style={{ color: active ? GOLD_SOFT : 'rgba(255,255,255,0.25)' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-[#202224] px-4 py-4">
      <div className="mb-3 text-[9px] font-mono tracking-[0.25em] text-[#666A6D] uppercase">Industry</div>
      <div className="space-y-1">
        {UNIVERSAL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all"
              style={{
                borderColor: active ? 'rgba(192,145,30,0.3)' : 'transparent',
                background: active ? 'rgba(192,145,30,0.1)' : 'transparent',
              }}
            >
              <Icon className="mt-px h-4 w-4 shrink-0 transition-colors" strokeWidth={1.5} style={{ color: active ? GOLD : '#9A9D9F' }} />
              <span className="text-xs font-medium leading-tight tracking-wide" style={{ color: active ? GOLD_SOFT : '#9A9D9F' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
