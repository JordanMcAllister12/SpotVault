import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Clock, Trophy, ArrowRight } from 'lucide-react';
import { PHASE2_ROUTE_GROUPS, searchRoutes, type Phase2Route } from '@/data/phase2Routes';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: Phase2Route) => void;
  recentIds: string[];
  currentLocation: string;
}

export function Phase2ControlPanel({ open, onClose, onNavigate, recentIds, currentLocation }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
        else {
          // Toggle via parent — but we can't call parent's toggle directly.
          // The parent handles the Cmd+K listener; this is a fallback.
        }
      }
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const searchResults = useMemo(() => searchRoutes(query), [query]);

  const recentRoutes = useMemo(() => {
    return recentIds
      .map((id) => PHASE2_ROUTE_GROUPS.flatMap((g) => g.routes).find((r) => r.id === id))
      .filter((r): r is Phase2Route => !!r);
  }, [recentIds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-[#050608]/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-16 flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#c0911e]/30 bg-gradient-to-b from-[#0e1115] to-[#0a0c0e] shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] px-6 py-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">SpotVault Map</h2>
              <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">Superuser / Demo Navigation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* You are here */}
        <div className="shrink-0 border-b border-[#1a1f25] bg-[#0a0c0e]/40 px-6 py-2.5">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">
            <span>You are here:</span>
            <span className="font-bold text-[#d4a52c]">{currentLocation}</span>
          </div>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b border-[#1a1f25] px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5f6e7c]" strokeWidth={1.5} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SpotVault..."
              className="w-full rounded-lg border border-[#232a32] bg-[#11151a] py-2.5 pl-11 pr-4 text-sm text-white placeholder-[#475565] focus:border-[#c0911e]/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search results */}
          {query.trim() && (
            <div className="mb-6">
              <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Search Results</h3>
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {searchResults.map((route) => (
                    <RouteButton key={route.id} route={route} onClick={() => onNavigate(route)} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#5f6e7c]">No destinations found for "{query}"</p>
              )}
            </div>
          )}

          {/* Recent */}
          {!query.trim() && recentRoutes.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
                <h3 className="text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Recent</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
                {recentRoutes.map((route) => (
                  <RouteButton key={route.id} route={route} onClick={() => onNavigate(route)} compact />
                ))}
              </div>
            </div>
          )}

          {/* All groups */}
          {!query.trim() && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {PHASE2_ROUTE_GROUPS.map((group) => (
                <div key={group.id}>
                  <h3 className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-[#d4a52c] uppercase">{group.label}</h3>
                  <div className="space-y-1.5">
                    {group.routes.map((route) => (
                      <RouteButton key={route.id} route={route} onClick={() => onNavigate(route)} compact />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#1a1f25] bg-[#0a0c0e]/40 px-6 py-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-[#475565] uppercase">
            <span>Press ESC to close</span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-[#232a32] bg-[#161b21] px-1.5 py-0.5 text-[9px]">⌘K</kbd>
              to toggle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteButton({ route, onClick, compact }: { route: Phase2Route; onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg border border-[#1a1f25] bg-[#11151a]/50 px-3 text-left transition-all hover:border-[#c0911e]/40 hover:bg-[#c0911e]/8 ${
        compact ? 'py-2' : 'py-2.5'
      }`}
    >
      <route.icon className="h-3.5 w-3.5 shrink-0 text-[#5f6e7c] transition-colors group-hover:text-[#d4a52c]" strokeWidth={1.5} />
      <span className="flex-1 truncate text-xs font-medium text-[#aab6c2] transition-colors group-hover:text-white">{route.label}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-[#2a323b] transition-colors group-hover:text-[#d4a52c]" strokeWidth={1.5} />
    </button>
  );
}
