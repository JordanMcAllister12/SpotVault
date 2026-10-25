import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Filter, RotateCcw, X, FolderOpen, BookMarked, Hammer, Star } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

export const GOLD = '#d4a52c';
export const GOLD_SOFT = '#f5e6b0';
export const BORDER = 'rgba(212, 165, 44, 0.18)';
export const DARK_PANEL = 'rgba(8,7,6,0.88)';

export type SortMode = 'recent' | 'oldest' | 'biggest_pot' | 'biggest_win' | 'biggest_loss' | 'biggest_stack';

export interface HandFilters {
  gameMode: 'all' | 'cash' | 'mtt';
  dateFrom: string | null;
  dateTo: string | null;
  stakes: string | null;
  position: string | null;
  minStack: number | null;
  maxStack: number | null;
  minPot: number | null;
  maxPot: number | null;
  result: 'all' | 'won' | 'lost';
  minBBWon: number | null;
  maxBBLost: number | null;
  potType: string | null;
  heroRaised: boolean;
  heroCalled: boolean;
  hero3bet: boolean;
  heroFaced3bet: boolean;
  heroFlat3bet: boolean;
  hero4bet: boolean;
  heroAllinPreflop: boolean;
  sawFlop: boolean;
  sawTurn: boolean;
  sawRiver: boolean;
  wentToShowdown: boolean;
  wonShowdown: boolean;
  lostShowdown: boolean;
  flopCbet: boolean;
  facedFlopCbet: boolean;
  turnBarrel: boolean;
  riverBarrel: boolean;
  checkRaise: boolean;
  allinPostflop: boolean;
  startingHandClass: string | null;
  boardClass: string | null;
  preflopAction: string | null;
  postflopAction: string | null;
  handType: string | null;
}

export const DEFAULT_FILTERS: HandFilters = {
  gameMode: 'all',
  dateFrom: null, dateTo: null, stakes: null, position: null,
  minStack: null, maxStack: null, minPot: null, maxPot: null,
  result: 'all', minBBWon: null, maxBBLost: null, potType: null,
  heroRaised: false, heroCalled: false, hero3bet: false, heroFaced3bet: false,
  heroFlat3bet: false, hero4bet: false, heroAllinPreflop: false,
  sawFlop: false, sawTurn: false, sawRiver: false,
  wentToShowdown: false, wonShowdown: false, lostShowdown: false,
  flopCbet: false, facedFlopCbet: false, turnBarrel: false, riverBarrel: false,
  checkRaise: false, allinPostflop: false,
  startingHandClass: null, boardClass: null,
  preflopAction: null, postflopAction: null, handType: null,
};

export const POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'UTG+3', 'LJ', 'MP', 'MP1', 'MP2', 'MP3', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

export const PREFLOP_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'All Preflop Actions', value: null },
  { label: '3-Bet Pots', value: '3bet_pots' },
  { label: 'Hero 3-Bet', value: 'hero_3bet' },
  { label: 'Called 3-Bet', value: 'flat_3bet' },
  { label: 'Folded to 3-Bet', value: 'faced_3bet' },
  { label: 'Flat Called Open', value: 'flat_open' },
  { label: '4-Bet Pots', value: '4bet_pots' },
  { label: 'Squeeze Pots', value: 'squeeze' },
  { label: 'Blind Defense', value: 'blind_defense' },
  { label: 'Steal Attempts', value: 'steal' },
];

export const POSTFLOP_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'All Postflop Actions', value: null },
  { label: 'Flop C-Bet', value: 'flop_cbet' },
  { label: 'Facing Flop C-Bet', value: 'faced_flop_cbet' },
  { label: 'Turn Barrel', value: 'turn_barrel' },
  { label: 'Facing Turn Barrel', value: 'faced_turn_barrel' },
  { label: 'River Barrel', value: 'river_barrel' },
  { label: 'River Bet', value: 'river_bet' },
  { label: 'Facing River Bet', value: 'faced_river_bet' },
  { label: 'Check-Raise', value: 'check_raise' },
  { label: 'River Decisions', value: 'river_decisions' },
];

export const RESULTS_SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Most Recent', value: 'recent' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Biggest Win', value: 'biggest_win' },
  { label: 'Biggest Loss', value: 'biggest_loss' },
];

export const HAND_TYPE_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'All Hands', value: null },
  { label: 'Showdowns', value: 'showdowns' },
  { label: 'Non-Showdowns', value: 'non_showdowns' },
  { label: 'All-In Hands', value: 'allin' },
  { label: 'Single-Raised Pots', value: 'srp' },
  { label: '3-Bet Pots', value: '3bet' },
  { label: '4-Bet Pots', value: '4bet' },
  { label: 'Multiway Pots', value: 'multiway' },
];

export function applyPreflopAction(f: HandFilters, value: string | null): HandFilters {
  let next = { ...f, preflopAction: value };
  next.hero3bet = false; next.heroFlat3bet = false; next.heroFaced3bet = false;
  next.hero4bet = false; next.heroAllinPreflop = false;
  next.heroRaised = false; next.heroCalled = false;
  next.potType = null; next.position = null;
  switch (value) {
    case '3bet_pots': next.hero3bet = true; break;
    case 'hero_3bet': next.hero3bet = true; break;
    case 'flat_3bet': next.heroFlat3bet = true; break;
    case 'faced_3bet': next.heroFaced3bet = true; break;
    case 'flat_open': next.heroCalled = true; break;
    case '4bet_pots': next.potType = '4bet_plus'; next.hero4bet = true; break;
    case 'squeeze': next.hero3bet = true; break;
    case 'blind_defense': next.position = 'BB'; next.heroCalled = true; break;
    case 'steal': next.position = 'CO'; break;
  }
  return next;
}

export function applyPostflopAction(f: HandFilters, value: string | null): HandFilters {
  let next = { ...f, postflopAction: value };
  next.flopCbet = false; next.facedFlopCbet = false;
  next.turnBarrel = false; next.riverBarrel = false;
  next.checkRaise = false; next.sawRiver = false;
  switch (value) {
    case 'flop_cbet': next.flopCbet = true; break;
    case 'faced_flop_cbet': next.facedFlopCbet = true; break;
    case 'turn_barrel': next.turnBarrel = true; break;
    case 'faced_turn_barrel': next.facedFlopCbet = true; break;
    case 'river_barrel': next.riverBarrel = true; break;
    case 'river_bet': next.riverBarrel = true; break;
    case 'faced_river_bet': next.facedFlopCbet = true; break;
    case 'check_raise': next.checkRaise = true; break;
    case 'river_decisions': next.sawRiver = true; break;
  }
  return next;
}

export function applyHandType(f: HandFilters, value: string | null): HandFilters {
  let next = { ...f, handType: value };
  next.wentToShowdown = false; next.heroAllinPreflop = false;
  next.allinPostflop = false; next.potType = null;
  switch (value) {
    case 'showdowns': next.wentToShowdown = true; break;
    case 'non_showdowns': next.wentToShowdown = false; break;
    case 'allin': next.heroAllinPreflop = true; next.allinPostflop = true; break;
    case 'srp': next.potType = 'srp'; break;
    case '3bet': next.potType = '3bet'; break;
    case '4bet': next.potType = '4bet_plus'; break;
    case 'multiway': break;
  }
  return next;
}

export function buildActiveChips(filters: HandFilters): { label: string; key: string }[] {
  const chips: { label: string; key: string }[] = [];
  if (filters.preflopAction) {
    const opt = PREFLOP_OPTIONS.find(o => o.value === filters.preflopAction);
    if (opt) chips.push({ label: opt.label, key: 'preflopAction' });
  }
  if (filters.postflopAction) {
    const opt = POSTFLOP_OPTIONS.find(o => o.value === filters.postflopAction);
    if (opt) chips.push({ label: opt.label, key: 'postflopAction' });
  }
  if (filters.handType) {
    const opt = HAND_TYPE_OPTIONS.find(o => o.value === filters.handType);
    if (opt) chips.push({ label: opt.label, key: 'handType' });
  }
  if (filters.position) chips.push({ label: `Pos: ${filters.position}`, key: 'position' });
  if (filters.potType) chips.push({ label: `Pot: ${filters.potType}`, key: 'potType' });
  if (filters.startingHandClass) chips.push({ label: `Hand: ${filters.startingHandClass}`, key: 'startingHandClass' });
  if (filters.boardClass) chips.push({ label: `Board: ${filters.boardClass}`, key: 'boardClass' });
  if (filters.result !== 'all') chips.push({ label: filters.result === 'won' ? 'Won' : 'Lost', key: 'result' });
  if (filters.minStack !== null) chips.push({ label: `Min Stack: ${filters.minStack}`, key: 'minStack' });
  if (filters.maxStack !== null) chips.push({ label: `Max Stack: ${filters.maxStack}`, key: 'maxStack' });
  if (filters.minPot !== null) chips.push({ label: `Min Pot: ${filters.minPot}`, key: 'minPot' });
  if (filters.dateFrom) chips.push({ label: `From: ${filters.dateFrom}`, key: 'dateFrom' });
  if (filters.dateTo) chips.push({ label: `To: ${filters.dateTo}`, key: 'dateTo' });
  return chips;
}

export function removeChip(filters: HandFilters, key: string): HandFilters {
  if (key === 'preflopAction') return applyPreflopAction(filters, null);
  if (key === 'postflopAction') return applyPostflopAction(filters, null);
  if (key === 'handType') return applyHandType(filters, null);
  const next = { ...filters };
  (next as Record<string, unknown>)[key] = key === 'result' ? 'all' : null;
  return next;
}

// ── Unified Dropdown Component ──
export function UnifiedDropdown({ label, isActive, isOpen, onToggle, options, onSelect }: {
  label: string;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  options: { label: string; value: string | null }[];
  onSelect: (value: string | null) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const updatePos = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 192;
      const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
      setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={onToggle}
        className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition-all"
        style={{
          borderColor: isActive ? GOLD : 'rgba(212,165,44,0.2)',
          background: isActive ? 'rgba(212,165,44,0.15)' : 'rgba(8,7,6,0.85)',
          color: isActive ? GOLD_SOFT : 'rgba(220,220,220,0.75)',
        }}
      >
        {label}
        <ChevronDown size={9} strokeWidth={1.5} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[180]" onClick={onToggle} />
          <div
            className="fixed z-[181] w-48 rounded-lg border border-[#d4a52c]/25 bg-[#11100E] p-1 shadow-2xl"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {options.map(opt => (
              <button
                key={opt.label}
                onClick={() => onSelect(opt.value)}
                className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[10px] font-medium transition-colors hover:bg-[#d4a52c]/12"
                style={{
                  color: opt.value === null ? 'rgba(255,255,255,0.5)' : 'rgba(245,230,176,0.9)',
                  background: opt.value === null ? 'transparent' : 'rgba(212,165,44,0.04)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[9px] font-medium text-white/40 uppercase">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/[0.08] bg-black/40 px-2 py-1.5 text-[10px] text-white/70 outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#080706]">
            {o === '' ? 'Any' : o === 'all' ? 'All' : o === 'mtt' ? 'MTT' : o === 'cash' ? 'Cash' : o === 'won' ? 'Won' : o === 'lost' ? 'Lost' : o === 'srp' ? 'Single-Raised' : o === '3bet' ? '3-Bet' : o === '4bet_plus' ? '4-Bet+' : o === 'limped' ? 'Limped' : o === 'unopened' ? 'Unopened' : o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterInput({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[9px] font-medium text-white/40 uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/[0.08] bg-black/40 px-2 py-1.5 text-[10px] text-white/70 outline-none"
      />
    </div>
  );
}

export function AdvancedFilterPanel({ filters, setFilters }: { filters: HandFilters; setFilters: (f: HandFilters) => void }) {
  const update = <K extends keyof HandFilters>(key: K, val: HandFilters[K]) => {
    setFilters({ ...filters, [key]: val });
  };
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-white/50 uppercase">Advanced Filters</span>
        <button onClick={() => setFilters({ ...DEFAULT_FILTERS, gameMode: filters.gameMode })} className="text-[10px] text-white/30 hover:text-white/50">Reset</button>
      </div>
      <div className="mb-4">
        <h5 className="mb-2 text-[9px] font-bold tracking-widest text-white/40 uppercase">General</h5>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FilterSelect label="Cash / Tournament" value={filters.gameMode} onChange={(v) => update('gameMode', v as HandFilters['gameMode'])} options={['all', 'cash', 'mtt']} />
          <FilterInput label="Date From" type="date" value={filters.dateFrom ?? ''} onChange={(v) => update('dateFrom', v || null)} />
          <FilterInput label="Date To" type="date" value={filters.dateTo ?? ''} onChange={(v) => update('dateTo', v || null)} />
          <FilterSelect label="Position" value={filters.position ?? ''} onChange={(v) => update('position', v || null)} options={['', ...POSITIONS]} />
          <FilterInput label="Min Stack (BB)" type="number" value={filters.minStack ?? ''} onChange={(v) => update('minStack', v ? Number(v) : null)} />
          <FilterInput label="Max Stack (BB)" type="number" value={filters.maxStack ?? ''} onChange={(v) => update('maxStack', v ? Number(v) : null)} />
          <FilterInput label="Min Pot" type="number" value={filters.minPot ?? ''} onChange={(v) => update('minPot', v ? Number(v) : null)} />
          <FilterSelect label="Result" value={filters.result} onChange={(v) => update('result', v as HandFilters['result'])} options={['all', 'won', 'lost']} />
          <FilterInput label="Min BB Won" type="number" value={filters.minBBWon ?? ''} onChange={(v) => update('minBBWon', v ? Number(v) : null)} />
          <FilterSelect label="Pot Type" value={filters.potType ?? ''} onChange={(v) => update('potType', v || null)} options={['', 'unopened', 'limped', 'srp', '3bet', '4bet_plus']} />
        </div>
      </div>
    </div>
  );
}

// ── Unified Filter Bar — the 4 dropdowns + Advanced + hand count + clear ──
export function UnifiedFilterBar({
  filters, setFilters, sortMode, setSortMode, totalCount, loading, openDropdown, setOpenDropdown,
}: {
  filters: HandFilters;
  setFilters: (f: HandFilters) => void;
  sortMode: SortMode;
  setSortMode: (s: SortMode) => void;
  totalCount: number;
  loading: boolean;
  openDropdown: string | null;
  setOpenDropdown: (s: string | null) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const activeChips = buildActiveChips(filters);
  const activeFilterCount = activeChips.length;
  const activePreflopLabel = PREFLOP_OPTIONS.find(o => o.value === filters.preflopAction)?.label ?? 'Preflop Action';
  const activePostflopLabel = POSTFLOP_OPTIONS.find(o => o.value === filters.postflopAction)?.label ?? 'Postflop Action';
  const activeSortLabel = RESULTS_SORT_OPTIONS.find(o => o.value === sortMode)?.label ?? 'Most Recent';
  const activeHandTypeLabel = HAND_TYPE_OPTIONS.find(o => o.value === filters.handType)?.label ?? 'Hand Type';

  const toggleDropdown = (name: string) => setOpenDropdown(openDropdown === name ? null : name);

  const handlePreflopSelect = (value: string | null) => { setFilters(applyPreflopAction(filters, value)); setOpenDropdown(null); };
  const handlePostflopSelect = (value: string | null) => { setFilters(applyPostflopAction(filters, value)); setOpenDropdown(null); };
  const handleHandTypeSelect = (value: string | null) => { setFilters(applyHandType(filters, value)); setOpenDropdown(null); };
  const handleSortSelect = (value: string) => { setSortMode(value as SortMode); setOpenDropdown(null); };

  const clearAll = () => {
    setFilters({ ...DEFAULT_FILTERS, gameMode: filters.gameMode });
    setSortMode('recent');
  };

  return (
    <div className="space-y-1">
      {/* Mobile: collapsed filter toggle with active count */}
      <div className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 md:hidden" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <button
          onClick={() => setShowMobileFilters(v => !v)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
          style={{ color: showMobileFilters ? GOLD_SOFT : 'rgba(255,255,255,0.6)' }}
        >
          <Filter size={12} strokeWidth={1.5} /> Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold" style={{ background: 'rgba(212,165,44,0.2)', color: GOLD_SOFT }}>{activeFilterCount}</span>
          )}
          <ChevronDown size={10} strokeWidth={1.5} className={`transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
        </button>
        <span className="text-[10px] text-white/40">{loading ? '...' : `${totalCount.toLocaleString()}`}</span>
        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="flex items-center gap-1 text-[9px] text-white/40 transition-colors hover:text-white/60">
            <RotateCcw size={10} strokeWidth={1.5} /> Clear
          </button>
        )}
      </div>

      {/* Desktop: always visible filter bar / Mobile: collapsible */}
      <div className={`flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 sm:px-2.5 sm:py-1.5 ${showMobileFilters ? 'flex' : 'hidden md:flex'}`} style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <UnifiedDropdown label={activePreflopLabel} isActive={filters.preflopAction !== null} isOpen={openDropdown === 'preflop'} onToggle={() => toggleDropdown('preflop')} options={PREFLOP_OPTIONS} onSelect={handlePreflopSelect} />
        <UnifiedDropdown label={activePostflopLabel} isActive={filters.postflopAction !== null} isOpen={openDropdown === 'postflop'} onToggle={() => toggleDropdown('postflop')} options={POSTFLOP_OPTIONS} onSelect={handlePostflopSelect} />
        <UnifiedDropdown label={activeSortLabel} isActive={sortMode !== 'recent'} isOpen={openDropdown === 'sort'} onToggle={() => toggleDropdown('sort')} options={RESULTS_SORT_OPTIONS} onSelect={handleSortSelect} />
        <UnifiedDropdown label={activeHandTypeLabel} isActive={filters.handType !== null} isOpen={openDropdown === 'handtype'} onToggle={() => toggleDropdown('handtype')} options={HAND_TYPE_OPTIONS} onSelect={handleHandTypeSelect} />
        <div className="mx-0.5 h-5 w-px bg-white/[0.08]" />
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all hover:bg-white/5" style={{ borderColor: BORDER, color: showAdvanced ? GOLD_SOFT : 'rgba(255,255,255,0.6)' }}>
          <Filter size={12} strokeWidth={1.5} /> Advanced
          <ChevronDown size={9} strokeWidth={1.5} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        <span className="ml-auto hidden text-[10px] text-white/40 md:inline">{loading ? 'Loading...' : `${totalCount.toLocaleString()} hand${totalCount !== 1 ? 's' : ''}`}</span>
        {activeChips.length > 0 && (
          <button onClick={clearAll} className="hidden items-center gap-1 text-[10px] text-white/40 transition-colors hover:text-white/60 md:flex"><RotateCcw size={11} strokeWidth={1.5} /> Clear All</button>
        )}
      </div>
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-1">
          {activeChips.map(chip => (
            <button key={chip.key} onClick={() => setFilters(removeChip(filters, chip.key))} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium transition-all hover:bg-white/5" style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>
              {chip.label} <X size={9} strokeWidth={2} />
            </button>
          ))}
        </div>
      )}
      {showAdvanced && <AdvancedFilterPanel filters={filters} setFilters={setFilters} />}
    </div>
  );
}

// ── Server-side: apply filters to a Supabase query chain ──
export function applyFilterToQuery(query: ReturnType<SupabaseClient['from']>, f: HandFilters) {
  let q = query;
  if (f.gameMode !== 'all') q = q.eq('game_mode', f.gameMode);
  if (f.dateFrom) q = q.gte('played_at', f.dateFrom);
  if (f.dateTo) q = q.lte('played_at', f.dateTo + 'T23:59:59');
  if (f.stakes) q = q.eq('blinds', f.stakes);
  if (f.position) q = q.eq('position', f.position);
  if (f.minStack !== null) q = q.gte('stack_size', f.minStack);
  if (f.maxStack !== null) q = q.lte('stack_size', f.maxStack);
  if (f.minPot !== null) q = q.gte('pot_amount', f.minPot);
  if (f.maxPot !== null) q = q.lte('pot_amount', f.maxPot);
  if (f.result === 'won') q = q.gt('net_result', 0);
  else if (f.result === 'lost') q = q.lt('net_result', 0);
  if (f.minBBWon !== null) q = q.gte('bb_won', f.minBBWon);
  if (f.maxBBLost !== null) q = q.lte('bb_won', -Math.abs(f.maxBBLost));
  if (f.potType) q = q.eq('pot_type', f.potType);
  if (f.heroRaised) q = q.in('hero_preflop_action', ['raise', '3bet', '4bet', 'allin']);
  if (f.heroCalled) q = q.eq('hero_preflop_action', 'call');
  if (f.hero3bet) q = q.eq('hero_preflop_action', '3bet');
  if (f.heroFaced3bet) q = q.eq('hero_faced_3bet', true);
  if (f.heroFlat3bet) q = q.eq('hero_flat_3bet', true);
  if (f.hero4bet) q = q.eq('hero_preflop_action', '4bet');
  if (f.heroAllinPreflop) q = q.or('hero_allin_preflop.eq.true,hero_allin_postflop.eq.true');
  if (f.sawFlop) q = q.eq('saw_flop', true);
  if (f.sawTurn) q = q.eq('saw_turn', true);
  if (f.sawRiver) q = q.eq('saw_river', true);
  if (f.wentToShowdown) q = q.eq('showdown', true);
  if (f.wonShowdown) q = q.eq('showdown', true).gt('net_result', 0);
  if (f.lostShowdown) q = q.eq('showdown', true).lt('net_result', 0);
  if (f.flopCbet) q = q.eq('hero_cbet_flop', true);
  if (f.facedFlopCbet) q = q.eq('faced_cbet_flop', true);
  if (f.turnBarrel) q = q.eq('hero_barrel_turn', true);
  if (f.riverBarrel) q = q.eq('hero_barrel_river', true);
  if (f.checkRaise) q = q.eq('hero_checkraise', true);
  if (f.allinPostflop) q = q.eq('hero_allin_postflop', true);
  if (f.startingHandClass) q = q.eq('starting_hand_class', f.startingHandClass);
  if (f.boardClass) q = q.eq('board_class', f.boardClass);
  return q;
}

// ── Client-side: convert HandFilters → predicate for in-memory hand arrays ──
// Works with RichHand (from handFilters.ts enrichHand) or any HandRecord-compatible object.
export interface FilterableHand {
  position?: string | null;
  net_result?: number | null;
  pot_amount?: number | null;
  stack_size?: number | null;
  showdown?: boolean | null;
  game_mode?: string | null;
  played_at?: string | null;
  blinds?: string | null;
  saw_flop?: boolean | null;
  saw_turn?: boolean | null;
  saw_river?: boolean | null;
  pot_type?: string | null;
  is3betPot?: boolean;
  isSRP?: boolean;
  isAllIn?: boolean;
  isShowdown?: boolean;
  isRiverDecision?: boolean;
  isFacingAllIn?: boolean;
  isBlindDefense?: boolean;
  isStealAttempt?: boolean;
}

export function matchesUnifiedFilters(h: FilterableHand, f: HandFilters): boolean {
  if (f.gameMode !== 'all') {
    const mode = h.game_mode ?? '';
    if (f.gameMode === 'cash' && mode !== 'cash') return false;
    if (f.gameMode === 'mtt' && mode !== 'mtt') return false;
  }
  if (f.dateFrom && (h.played_at ?? '') < f.dateFrom) return false;
  if (f.dateTo && (h.played_at ?? '') > f.dateTo + 'T23:59:59') return false;
  if (f.stakes && h.blinds !== f.stakes) return false;
  if (f.position && h.position !== f.position) return false;
  if (f.minStack !== null && (h.stack_size ?? 0) < f.minStack) return false;
  if (f.maxStack !== null && (h.stack_size ?? 0) > f.maxStack) return false;
  if (f.minPot !== null && (h.pot_amount ?? 0) < f.minPot) return false;
  if (f.maxPot !== null && (h.pot_amount ?? 0) > f.maxPot) return false;
  if (f.result === 'won' && (h.net_result ?? 0) <= 0) return false;
  if (f.result === 'lost' && (h.net_result ?? 0) >= 0) return false;
  if (f.potType) {
    if (f.potType === '3bet' && !h.is3betPot) return false;
    if (f.potType === 'srp' && !h.isSRP) return false;
    if (f.potType === '4bet_plus' && !(h.is3betPot && h.pot_type !== '3bet')) return false;
  }
  if (f.wentToShowdown && !(h.isShowdown ?? h.showdown ?? false)) return false;
  if (f.heroAllinPreflop && !(h.isAllIn ?? false)) return false;
  if (f.allinPostflop && !(h.isAllIn ?? false)) return false;
  if (f.sawFlop && !(h.saw_flop ?? false)) return false;
  if (f.sawTurn && !(h.saw_turn ?? false)) return false;
  if (f.sawRiver && !(h.saw_river ?? false)) return false;
  return true;
}

export function sortHandsByMode<T extends FilterableHand>(hands: T[], mode: SortMode): T[] {
  const sorted = [...hands];
  switch (mode) {
    case 'recent': return sorted.sort((a, b) => (b.played_at ?? '').localeCompare(a.played_at ?? ''));
    case 'oldest': return sorted.sort((a, b) => (a.played_at ?? '').localeCompare(b.played_at ?? ''));
    case 'biggest_pot': return sorted.sort((a, b) => (b.pot_amount ?? 0) - (a.pot_amount ?? 0));
    case 'biggest_win': return sorted.sort((a, b) => (b.net_result ?? 0) - (a.net_result ?? 0));
    case 'biggest_loss': return sorted.sort((a, b) => (a.net_result ?? 0) - (b.net_result ?? 0));
    case 'biggest_stack': return sorted.sort((a, b) => (b.stack_size ?? 0) - (a.stack_size ?? 0));
    default: return sorted;
  }
}

export function hasActiveUnifiedFilters(f: HandFilters): boolean {
  return f.preflopAction !== null || f.postflopAction !== null || f.handType !== null ||
    f.position !== null || f.potType !== null || f.result !== 'all' ||
    f.minStack !== null || f.maxStack !== null || f.minPot !== null ||
    f.dateFrom !== null || f.dateTo !== null || f.gameMode !== 'all' ||
    f.startingHandClass !== null || f.boardClass !== null;
}

// ── Primary Navigation: Current Load | Storage ──
export type PrimaryTab = 'current' | 'storage';
export type StorageSection = 'tournament_hh' | 'study_batches' | 'built_hands' | 'favorites';

export const STORAGE_SECTIONS: { key: StorageSection; label: string; icon: typeof FolderOpen }[] = [
  { key: 'tournament_hh', label: 'Tournament HH', icon: FolderOpen },
  { key: 'study_batches', label: 'Study Batches', icon: BookMarked },
  { key: 'built_hands', label: 'Built Hands', icon: Hammer },
  { key: 'favorites', label: 'Favorites', icon: Star },
];

export function HandLibrarySourceDropdown({ value, onChange }: { value: StorageSection; onChange: (value: StorageSection) => void }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = STORAGE_SECTIONS.find((section) => section.key === value) ?? STORAGE_SECTIONS[0];

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setMenuPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 180) });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const close = () => setOpen(false);
  const select = (next: StorageSection) => { onChange(next); close(); };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true); }
        }}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-[10px] font-semibold text-[#f5e6b0] transition hover:border-[#d4a52c]/45 hover:bg-[#d4a52c]/10 focus:outline-none focus:ring-1 focus:ring-[#d4a52c]/60"
        style={{ borderColor: open ? 'rgba(212,165,44,0.55)' : 'rgba(212,165,44,0.25)', background: 'rgba(8,7,6,0.58)' }}
      >
        <span className="truncate">{active.label}</span>
        <ChevronDown size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <>
          <button type="button" aria-label="Close source menu" className="fixed inset-0 z-[190] cursor-default" onClick={close} />
          <div
            role="menu"
            className="fixed z-[191] overflow-hidden rounded-lg border border-[#d4a52c]/30 bg-[#11100E] p-1 shadow-2xl"
            style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
          >
            {STORAGE_SECTIONS.map((section) => {
              const Icon = section.icon;
              const selected = section.key === value;
              return (
                <button
                  key={section.key}
                  type="button"
                  role="menuitem"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => select(section.key)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-medium transition hover:bg-[#d4a52c]/12 focus:bg-[#d4a52c]/12 focus:outline-none"
                  style={{ color: selected ? GOLD_SOFT : 'rgba(255,255,255,0.78)', background: selected ? 'rgba(212,165,44,0.16)' : undefined }}
                >
                  <Icon size={11} className="shrink-0" style={{ color: selected ? GOLD : 'rgba(255,255,255,0.42)' }} />
                  {section.label}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

export function PrimaryNav({ activeTab, onTabChange, storageSection, onStorageSectionChange }: {
  activeTab: PrimaryTab;
  onTabChange: (t: PrimaryTab) => void;
  storageSection: StorageSection;
  onStorageSectionChange: (s: StorageSection) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border px-1.5 py-1.5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <button
        onClick={() => onTabChange('current')}
        className="rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wide transition-all"
        style={{
          background: activeTab === 'current' ? 'rgba(212,165,44,0.15)' : 'transparent',
          color: activeTab === 'current' ? GOLD_SOFT : 'rgba(220,220,220,0.5)',
          border: `1px solid ${activeTab === 'current' ? GOLD : 'transparent'}`,
        }}
      >
        Current Load
      </button>
      <button
        onClick={() => onTabChange('storage')}
        className="rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wide transition-all"
        style={{
          background: activeTab === 'storage' ? 'rgba(212,165,44,0.15)' : 'transparent',
          color: activeTab === 'storage' ? GOLD_SOFT : 'rgba(220,220,220,0.5)',
          border: `1px solid ${activeTab === 'storage' ? GOLD : 'transparent'}`,
        }}
      >
        Storage
      </button>
      {activeTab === 'storage' && (
        <>
          <div className="mx-0.5 h-5 w-px bg-white/[0.08]" />
          <HandLibrarySourceDropdown value={storageSection} onChange={onStorageSectionChange} />
        </>
      )}
    </div>
  );
}

// ── Storage Search/Sort bar (basic, no advanced filters) ──
export function StorageSearchBar({ search, onSearchChange, sortMode, setSortMode, totalCount, loading, openDropdown, setOpenDropdown }: {
  search: string;
  onSearchChange: (s: string) => void;
  sortMode: SortMode;
  setSortMode: (s: SortMode) => void;
  totalCount: number;
  loading: boolean;
  openDropdown: string | null;
  setOpenDropdown: (s: string | null) => void;
}) {
  const activeSortLabel = RESULTS_SORT_OPTIONS.find(o => o.value === sortMode)?.label ?? 'Most Recent';
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
        className="min-w-[120px] flex-1 rounded-md border border-white/[0.08] bg-[rgba(8,7,6,0.58)] px-2.5 py-1.5 text-[10px] text-white/70 outline-none placeholder:text-white/20"
      />
      <UnifiedDropdown
        label={activeSortLabel}
        isActive={sortMode !== 'recent'}
        isOpen={openDropdown === 'sort'}
        onToggle={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
        options={RESULTS_SORT_OPTIONS}
        onSelect={(v) => { if (v) { setSortMode(v as SortMode); setOpenDropdown(null); } }}
      />
      <span className="ml-auto text-[10px] text-white/40">
        {loading ? 'Loading...' : `${totalCount.toLocaleString()} item${totalCount !== 1 ? 's' : ''}`}
      </span>
    </div>
  );
}
