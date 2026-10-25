import { X, Zap, TrendingUp, Receipt } from 'lucide-react';
import { CREDITS_USAGE } from '@/types';
import { CREDIT_USES } from '@/data/storeData';
import { BuyCreditsCalculator } from '@/components/BuyCreditsCalculator';

const GOLD = '#d4a52c';

interface Props {
  credits: number;
  onClose: () => void;
}

export function CreditsPanel({ credits, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[#050608]/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="metal-frame-raised brushed-metal clip-bevel relative w-[520px] max-w-[94vw] max-h-[88vh] overflow-y-auto rounded-2xl p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        {/* Header — balance */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408]">
            <Zap className="h-6 w-6 text-[#d4a52c]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">SpotVault Wallet</h2>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold text-[#d4a52c]">{credits.toLocaleString()}</span>
              <span className="text-xs font-mono tracking-widest text-[#d4a52c]/70 uppercase">Credits</span>
            </div>
          </div>
        </div>

        {/* Add credits */}
        <div className="mt-6">
          <BuyCreditsCalculator compact />
        </div>

        {/* What credits are for */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#5f6e7c] uppercase">Use Credits For</div>
          </div>
          <div className="space-y-2">
            {CREDIT_USES.map((item) => (
              <div key={item} className="flex items-center gap-2.5 rounded-lg border border-[#1a1f25] bg-[#11151a]/50 px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c0911e]/50" />
                <span className="text-xs text-[#aab6c2]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction model */}
        <div className="mt-5 rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3.5">
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#475565] uppercase">Transaction Model</div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#aab6c2]">Creator / Seller</span>
            <span className="font-bold text-emerald-300">80%</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-[#aab6c2]">SpotVault</span>
            <span className="font-bold text-[#d4a52c]">20%</span>
          </div>
        </div>

        {/* Transaction history placeholder */}
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={1.5} />
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#5f6e7c] uppercase">Transaction History</div>
          </div>
          <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/30 px-4 py-6 text-center">
            <p className="text-xs text-white/40">No transactions yet</p>
            <p className="mt-1 text-[10px] text-white/30">Your credit purchases and spending will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
