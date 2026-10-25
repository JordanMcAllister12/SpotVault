import { ArrowLeft, Store, ChevronRight, X, Check } from 'lucide-react';
import { useState } from 'react';
import { EXPO_CATEGORIES } from '@/types';

interface Props {
  onBack: () => void;
  onOpenBooth: () => void;
  boothModalOpen: boolean;
  onCloseBooth: () => void;
}

const ICONS: Record<string, string> = {
  Monitor: '🖥️', Table: '🟫', Spade: '♠', Radio: '📡', Shirt: '👕',
  BarChart: '📊', Video: '🎬', Package: '📦',
};

export function ExpoHub({ onBack, onOpenBooth, boothModalOpen, onCloseBooth }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#050608]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Network
          </button>
          <div className="flex items-center gap-2.5">
            <Store className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Industry Expo</h1>
              <p className="text-[10px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">The Poker Industry Expo — Open 365 Days a Year</p>
            </div>
          </div>
        </div>
        <button
          onClick={onOpenBooth}
          className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 px-4 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase transition-all hover:gold-glow"
        >
          Open Booth <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <p className="mb-5 text-sm text-[#5f6e7c]">Discover the companies powering poker.</p>

          {/* Category cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {EXPO_CATEGORIES.map((cat) => (
              <div key={cat.name} className="metal-panel group rounded-xl p-5 transition-all hover:border-[#38424e]">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2a323b] bg-gradient-to-b from-[#1c2228] to-[#11151a] text-xl">
                    {ICONS[cat.iconName] || '📦'}
                  </div>
                  <span className="rounded border border-[#232a32] bg-[#11151a] px-2 py-0.5 text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{cat.boothCount} booths</span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">{cat.name}</h3>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]" />
                  <span className="text-[10px] font-mono tracking-widest text-emerald-300/70 uppercase">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booth modal */}
      {boothModalOpen && <BoothModal onClose={onCloseBooth} />}
    </div>
  );
}

function BoothModal({ onClose }: { onClose: () => void }) {
  const [tier, setTier] = useState<string>('standard');
  const [features, setFeatures] = useState<string[]>([]);

  const toggleFeature = (f: string) => {
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const tiers = [
    { id: 'standard', name: 'Standard', price: '500 credits' },
    { id: 'professional', name: 'Professional', price: '1,500 credits' },
    { id: 'featured', name: 'Featured', price: '3,000 credits' },
  ];

  const featureList = [
    'Company Profile', 'Products', 'Team Members', 'Contact',
    'Book Meeting', 'Post Opportunities', 'Product Demo', 'Lead Capture',
  ];

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[#050608]/80 backdrop-blur-sm" onClick={onClose}>
      <div className="metal-frame-raised brushed-metal clip-bevel relative w-[520px] max-w-[94vw] rounded-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <h2 className="text-base font-bold tracking-tight text-white">Open an Industry Booth</h2>
        </div>

        {/* Tier selection */}
        <div className="mt-5">
          <div className="mb-2 text-[10px] font-mono tracking-[0.25em] text-[#5f6e7c] uppercase">Choose Booth Type</div>
          <div className="grid grid-cols-3 gap-2">
            {tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => setTier(t.id)}
                className={`rounded-lg border p-3 text-center transition-all ${
                  tier === t.id
                    ? 'border-[#c0911e]/50 bg-[#c0911e]/15'
                    : 'border-[#232a32] bg-[#161b21] hover:border-[#38424e]'
                }`}
              >
                <div className={`text-xs font-bold ${tier === t.id ? 'text-[#f5e6b0]' : 'text-[#c7cfd8]'}`}>{t.name}</div>
                <div className="mt-1 text-[10px] font-mono text-[#d4a52c]">{t.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mt-5">
          <div className="mb-2 text-[10px] font-mono tracking-[0.25em] text-[#5f6e7c] uppercase">Possible Booth Features</div>
          <div className="grid grid-cols-2 gap-2">
            {featureList.map((f) => (
              <button
                key={f}
                onClick={() => toggleFeature(f)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                  features.includes(f)
                    ? 'border-[#c0911e]/40 bg-[#c0911e]/10 text-[#f5e6b0]'
                    : 'border-[#1a1f25] bg-[#11151a]/50 text-[#84929f] hover:border-[#232a32]'
                }`}
              >
                <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                  features.includes(f) ? 'border-[#d4a52c] bg-[#d4a52c]/20' : 'border-[#2a323b]'
                }`}>
                  {features.includes(f) && <Check className="h-2.5 w-2.5 text-[#d4a52c]" strokeWidth={2} />}
                </div>
                {f}
              </button>
            ))}
          </div>
        </div>

        <button className="mt-6 w-full rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase transition-all hover:gold-glow">
          Open Booth
        </button>

        <div className="mt-3 text-center text-[10px] font-mono tracking-[0.3em] text-[#364049] uppercase">
          Demo Only · No Payment Processed
        </div>
      </div>
    </div>
  );
}
