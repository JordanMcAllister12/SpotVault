import { useState, useEffect, useMemo } from 'react';
import { Search, MapPin } from 'lucide-react';
import { fetchAllCities, searchCities, type CityRecord } from '@/lib/cityDatabase';

interface Props {
  onSelect: (destination: { city: string; region: string; label: string }) => void;
  selectedLabel?: string;
}

export function DestinationSelector({ onSelect, selectedLabel }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<CityRecord[]>([]);

  useEffect(() => {
    fetchAllCities().then(setCities);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchCities(query, cities, 8);
  }, [query, cities]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2.5">
        <MapPin className="h-3.5 w-3.5 text-[#d4a52c]/60" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Live Poker</span>
        {selectedLabel && (
          <span className="ml-auto text-[9px] text-white/40 truncate max-w-[120px]">{selectedLabel}</span>
        )}
      </div>
      <div className="p-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="City / Casino / Poker room"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 pl-8 pr-3 text-[11px] text-white/80 placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none"
          />
        </div>
        {open && results.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect({
                    city: c.city_name,
                    region: c.region ?? c.country ?? '',
                    label: c.region ? `${c.city_name}, ${c.region}` : c.city_name,
                  });
                  setQuery('');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-white/70 transition-colors hover:bg-white/5"
              >
                <MapPin className="h-3 w-3 text-white/30" />
                <span className="font-medium">{c.city_name}</span>
                {c.region && <span className="text-white/30">{c.region}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
