import { useState } from 'react';
import { Zap } from 'lucide-react';
import { CREDIT_PRICING, creditsToUsd, validateCreditQuantity } from '@/lib/creditPricing';

const GOLD = '#d4a52c';

interface Props {
  compact?: boolean;
  onPurchase?: (quantity: number) => void;
}

export function BuyCreditsCalculator({ compact, onPurchase }: Props) {
  const [quantityStr, setQuantityStr] = useState('100');
  const [error, setError] = useState<string | null>(null);

  const quantity = Math.max(0, parseInt(quantityStr) || 0);
  const usdAmount = creditsToUsd(quantity);
  const validation = validateCreditQuantity(quantity);

  function handlePurchase() {
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid quantity');
      return;
    }
    setError(null);
    onPurchase?.(quantity);
  }

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10">
          <Zap className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Buy Credits</h3>
          <p className="text-[10px] text-white/45">Enter any quantity — 10 credits = $1.00</p>
        </div>
      </div>

      {/* Quantity input */}
      <div>
        <label className="mb-1.5 block text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">Credit Quantity</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-white/40">
            <Zap className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          </span>
          <input
            type="number"
            min={CREDIT_PRICING.minPurchaseCredits}
            max={CREDIT_PRICING.maxPurchaseCredits}
            step="1"
            value={quantityStr}
            onChange={(e) => { setQuantityStr(e.target.value); setError(null); }}
            className="w-full rounded-lg border border-[#c0911e]/25 bg-[rgba(8,11,14,0.9)] py-3 pl-10 pr-4 text-lg font-bold text-white outline-none transition-colors focus:border-[#c0911e]/50"
            placeholder="0"
          />
        </div>
      </div>

      {/* Live calculation summary */}
      <div className="rounded-lg border border-white/[0.06] bg-[rgba(8,11,14,0.85)] p-4">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/45">Credits</span>
            <span className="font-semibold text-white/80">{quantity > 0 ? quantity.toLocaleString() : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/45">Rate</span>
            <span className="font-mono text-white/50">$0.10 / credit</span>
          </div>
          <div className="border-t border-white/[0.06] pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono tracking-widest text-white/50 uppercase">Total</span>
              <span className="text-base font-bold" style={{ color: GOLD }}>{quantity > 0 ? `$${usdAmount.toFixed(2)}` : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-400/80">
          {error}
        </div>
      )}

      {/* Purchase button */}
      <button
        type="button"
        disabled={quantity < 1}
        onClick={handlePurchase}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 py-3 text-[11px] font-bold tracking-[0.2em] text-[#d4a52c] uppercase transition-all hover:bg-[#c0911e]/25 disabled:opacity-40"
      >
        Purchase Credits
      </button>

      {!compact && (
        <div className="text-center text-[9px] font-mono tracking-[0.3em] text-white/25 uppercase">
          10 Credits = $1.00 USD
        </div>
      )}
    </div>
  );
}
