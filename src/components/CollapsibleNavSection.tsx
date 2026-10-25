import { type ReactNode, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PortalNavEntry } from '@/data/portalConfigs';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface Props {
  section: string;
  items: PortalNavEntry[];
  activeNav: string;
  defaultOpen?: boolean;
  onNavigate: (id: string) => void;
  onOpenUniversalView?: (id: string) => void;
  renderIcon?: (item: PortalNavEntry, active: boolean) => ReactNode;
  renderLabel?: (item: PortalNavEntry, active: boolean) => ReactNode;
  /** When true, clicking an item also closes other sections (managed by parent) */
  onItemClicked?: (section: string) => void;
  /** Controlled open state — when provided, parent manages collapse/expand */
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CollapsibleNavSection({
  section,
  items,
  activeNav,
  defaultOpen = false,
  onNavigate,
  onOpenUniversalView,
  renderIcon,
  renderLabel,
  controlledOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const hasActive = items.some((item) => item.id === activeNav);

  // Auto-expand if any item in this section is the active route
  useEffect(() => {
    if (hasActive) {
      if (isControlled) onOpenChange?.(true);
      else setInternalOpen(true);
    }
  }, [hasActive, isControlled]);

  // Auto-collapse when active route leaves this section (unless defaultOpen)
  useEffect(() => {
    if (!defaultOpen && !hasActive) {
      if (isControlled) onOpenChange?.(false);
      else setInternalOpen(false);
    }
  }, [hasActive, defaultOpen, isControlled]);

  const toggle = () => {
    const next = !open;
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.03]"
      >
        <span
          className="flex items-center gap-1.5 text-[8px] font-mono tracking-[0.25em] uppercase transition-colors"
          style={{ color: hasActive ? GOLD : 'rgba(192,145,30,0.5)' }}
        >
          {section}
          {!open && items.length > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold leading-none" style={{ background: 'rgba(192,145,30,0.12)', color: 'rgba(192,145,30,0.6)' }}>
              {items.length}
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-white/30" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-white/30" strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 overflow-hidden transition-all">
          {(() => {
            // Group items by subSection. Items without a subSection render directly.
            // Items sharing a subSection render as a nested collapsible group.
            const subGroups: { name: string; items: PortalNavEntry[] }[] = [];
            const standalone: PortalNavEntry[] = [];
            for (const item of items) {
              if (item.subSection) {
                let group = subGroups.find((g) => g.name === item.subSection);
                if (!group) {
                  group = { name: item.subSection, items: [] };
                  subGroups.push(group);
                }
                group.items.push(item);
              } else {
                standalone.push(item);
              }
            }
            // Interleave in order: standalone items and sub-groups in the order they appear
            const result: ReactNode[] = [];
            const subGroupRendered = new Set<string>();
            for (const item of items) {
              if (item.subSection) {
                if (subGroupRendered.has(item.subSection)) continue;
                subGroupRendered.add(item.subSection);
                const group = subGroups.find((g) => g.name === item.subSection)!;
                result.push(
                  <NestedNavGroup
                    key={item.subSection}
                    label={item.subSection}
                    items={group.items}
                    activeNav={activeNav}
                    onNavigate={onNavigate}
                    onOpenUniversalView={onOpenUniversalView}
                  />
                );
              } else {
                result.push(
                  <NavRow
                    key={item.id}
                    item={item}
                    active={activeNav === item.id}
                    onNavigate={onNavigate}
                    onOpenUniversalView={onOpenUniversalView}
                  />
                );
              }
            }
            return result;
          })()}
        </div>
      )}
    </div>
  );
}

function NavRow({
  item,
  active,
  onNavigate,
  onOpenUniversalView,
}: {
  item: PortalNavEntry;
  active: boolean;
  onNavigate: (id: string) => void;
  onOpenUniversalView?: (id: string) => void;
}) {
  const isUniversal = item.id === 'settings' || item.id === 'privacy' || item.id === 'terms' || item.id === 'help';
  const ItemIcon = item.icon;
  return (
    <button
      type="button"
      onClick={() => (isUniversal ? onOpenUniversalView?.(item.id) : onNavigate(item.id))}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
        active
          ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
          : 'border-transparent text-[#9A9D9F] hover:border-[#c0911e]/20 hover:bg-[#c0911e]/8 hover:text-[#f5e6b0]'
      }`}
    >
      <ItemIcon
        className="h-4 w-4 shrink-0"
        strokeWidth={1.5}
        style={{ color: active ? GOLD : undefined }}
      />
      <span className="text-xs font-medium tracking-wide">{item.label}</span>
    </button>
  );
}

function NestedNavGroup({
  label,
  items,
  activeNav,
  onNavigate,
  onOpenUniversalView,
}: {
  label: string;
  items: PortalNavEntry[];
  activeNav: string;
  onNavigate: (id: string) => void;
  onOpenUniversalView?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasActive = items.some((item) => item.id === activeNav);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <div className="ml-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
      >
        <span
          className="flex items-center gap-1.5 text-[8px] font-mono tracking-[0.2em] uppercase transition-colors"
          style={{ color: hasActive ? GOLD : 'rgba(192,145,30,0.45)' }}
        >
          {label}
        </span>
        {open ? (
          <ChevronDown className="h-2.5 w-2.5 shrink-0 text-white/25" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-white/25" strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => {
            const active = activeNav === item.id;
            const isUniversal = item.id === 'settings' || item.id === 'privacy' || item.id === 'terms' || item.id === 'help';
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (isUniversal ? onOpenUniversalView?.(item.id) : onNavigate(item.id))}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all ${
                  active
                    ? 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#f5e6b0]'
                    : 'border-transparent text-[#9A9D9F] hover:border-[#c0911e]/20 hover:bg-[#c0911e]/8 hover:text-[#f5e6b0]'
                }`}
              >
                <ItemIcon
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.5}
                  style={{ color: active ? GOLD : undefined }}
                />
                <span className="text-[11px] font-medium tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
