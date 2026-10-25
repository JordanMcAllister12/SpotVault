import { useState, useEffect, useCallback, useRef } from 'react';
import { Gift, Search, X, Loader2, Send, AlertCircle, BadgeCheck } from 'lucide-react';
import {
  searchGiftableSpots, giftContentSpot, checkSpotOwnership,
  type GiftableSpot, type GiftResult,
} from '@/lib/giftStore';
import { getRelationshipStatus, type RelationshipStatus } from '@/lib/socialGraphStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

export interface GiftSpotModalProps {
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  onClose: () => void;
  onGifted?: (result: GiftResult) => void;
}

export function GiftSpotModal({
  recipientId,
  recipientName,
  recipientAvatar,
  onClose,
  onGifted,
}: GiftSpotModalProps) {
  const [query, setQuery] = useState('');
  const [spots, setSpots] = useState<GiftableSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<GiftableSpot | null>(null);
  const [giftMessage, setGiftMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<GiftResult | null>(null);
  const [ownershipChecked, setOwnershipChecked] = useState(false);
  const [alreadyOwns, setAlreadyOwns] = useState(false);
  const [relationship, setRelationship] = useState<RelationshipStatus | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    const results = await searchGiftableSpots(q);
    setSpots(results);
    setLoading(false);
  }, []);

  useEffect(() => {
    doSearch('');
    getRelationshipStatus(recipientId).then(setRelationship);
  }, [doSearch, recipientId]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelectSpot = async (spot: GiftableSpot) => {
    setSelectedSpot(spot);
    setOwnershipChecked(false);
    setAlreadyOwns(false);
    const owns = await checkSpotOwnership(recipientId, spot.id);
    setAlreadyOwns(owns);
    setOwnershipChecked(true);
  };

  const handleSendGift = async () => {
    if (!selectedSpot) return;
    setSending(true);
    const res = await giftContentSpot(recipientId, selectedSpot.id, giftMessage.trim() || undefined);
    setResult(res);
    setSending(false);
    if (res.status === 'success' && onGifted) {
      onGifted(res);
    }
  };

  const isBlocked = relationship?.is_blocked;

  // ── Success state ──
  if (result?.status === 'success') {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border p-6 text-center" style={{ borderColor: BORDER, background: '#0a0c0e' }} onClick={e => e.stopPropagation()}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(212,165,44,0.12)', border: `1px solid ${GOLD}40` }}>
            <Gift className="h-6 w-6" style={{ color: GOLD }} />
          </div>
          <h2 className="text-base font-bold text-white">Gift Sent!</h2>
          <p className="mt-2 text-[12px] text-white/60">
            <span className="font-semibold" style={{ color: GOLD_SOFT }}>{result.spot_title}</span> has been gifted to{' '}
            <span className="font-semibold text-white">{recipientName}</span>.
          </p>
          <p className="mt-1 text-[10px] text-white/40">
            {result.price_credits} credits were charged. The recipient can find it in My Spots.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-lg border py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors"
            style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Error states ──
  if (result && result.status !== 'success') {
    const errorMessages: Record<string, string> = {
      already_owns: `${recipientName} already owns this Spot.`,
      blocked: 'Cannot send a gift — this user has blocked you or you have blocked them.',
      insufficient_credits: 'You don\'t have enough credits for this gift.',
      self_gift: 'You cannot gift a Spot to yourself.',
      not_found: 'This Spot is no longer available.',
      error: 'Something went wrong. Please try again.',
    };
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl border p-6 text-center" style={{ borderColor: 'rgba(239,68,68,0.2)', background: '#0a0c0e' }} onClick={e => e.stopPropagation()}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/[0.06]">
            <AlertCircle className="h-5 w-5 text-red-400/70" />
          </div>
          <h2 className="text-sm font-bold text-white">Gift Failed</h2>
          <p className="mt-2 text-[12px] text-white/60">{errorMessages[result.status] || 'Unknown error.'}</p>
          <button
            onClick={() => { setResult(null); setSelectedSpot(null); }}
            className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white/60"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border" style={{ borderColor: BORDER, background: '#0a0c0e' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(212,165,44,0.1)', border: `1px solid ${GOLD}30` }}>
              <Gift className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Gift a Spot</h2>
              <p className="text-[10px] text-white/40">To {recipientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white/70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Blocked warning */}
        {isBlocked && (
          <div className="mx-5 mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
            <p className="text-[11px] text-red-400/70">You cannot send a gift to this user due to a block.</p>
          </div>
        )}

        {/* Recipient preview */}
        <div className="flex shrink-0 items-center gap-3 px-5 py-3">
          {recipientAvatar ? (
            <img src={recipientAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-bold text-white/60">
              {recipientName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white">{recipientName}</p>
            <p className="truncate text-[10px] text-white/40">Recipient</p>
          </div>
        </div>

        {!isBlocked && (
          <>
            {/* Search */}
            <div className="shrink-0 px-5 pb-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                <Search className="h-3.5 w-3.5 text-white/40" />
                <input
                  value={query}
                  onChange={e => handleInputChange(e.target.value)}
                  placeholder="Search Spots to gift..."
                  className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Spot list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              )}
              {!loading && spots.length === 0 && (
                <p className="py-8 text-center text-[11px] text-white/30">No monetized Spots available to gift.</p>
              )}
              {spots.map(spot => (
                <button
                  key={spot.id}
                  onClick={() => handleSelectSpot(spot)}
                  disabled={!!selectedSpot && selectedSpot.id !== spot.id}
                  className="mb-2 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all disabled:opacity-30"
                  style={{
                    borderColor: selectedSpot?.id === spot.id ? `${GOLD}50` : 'rgba(255,255,255,0.04)',
                    background: selectedSpot?.id === spot.id ? 'rgba(212,165,44,0.06)' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <Gift className="h-4 w-4 text-white/30" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-white">{spot.title}</p>
                    {spot.creator_name && <p className="truncate text-[10px] text-white/40">by {spot.creator_name}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-bold" style={{ color: GOLD_SOFT }}>{spot.price_credits}</p>
                    <p className="text-[8px] text-white/30">credits</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected spot detail + message + send */}
            {selectedSpot && (
              <div className="shrink-0 border-t border-white/[0.06] px-5 py-3">
                {ownershipChecked && alreadyOwns && (
                  <div className="mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[11px] text-white/50">{recipientName} already owns this Spot.</p>
                  </div>
                )}
                {ownershipChecked && !alreadyOwns && (
                  <>
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <span className="text-[11px] text-white/50">Gift price</span>
                      <span className="text-[12px] font-bold" style={{ color: GOLD_SOFT }}>{selectedSpot.price_credits} credits</span>
                    </div>
                    <input
                      value={giftMessage}
                      onChange={e => setGiftMessage(e.target.value)}
                      placeholder="Add a short message (optional)..."
                      maxLength={140}
                      className="mb-2 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:border-[#c0911e]/35 focus:outline-none"
                    />
                    <button
                      onClick={handleSendGift}
                      disabled={sending}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all"
                      style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
                    >
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Gift ({selectedSpot.price_credits} credits)
                    </button>
                  </>
                )}
                {ownershipChecked && !alreadyOwns && relationship?.is_contact && (
                  <p className="mt-1.5 text-center text-[9px] text-white/30">
                    This will appear in {recipientName}'s inbox and My Spots.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
