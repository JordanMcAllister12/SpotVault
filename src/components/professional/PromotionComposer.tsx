import { useState, useEffect, useCallback } from 'react';
import { Loader2, Megaphone, Clock, Zap, AlertCircle } from 'lucide-react';
import {
  getPromotionUsage,
  createPromotion,
  fetchMyListings,
  type PromotionUsage,
  type ProfessionalListing,
  type PortalType,
} from '@/lib/professionalListingStore';
import { GOLD, CARD_BORDER, CARD_BG, CARD_SHADOW } from '@/components/store/storeTokens';

interface Props {
  portalType: PortalType;
}

export function PromotionComposer({ portalType }: Props) {
  const [usage, setUsage] = useState<PromotionUsage | null>(null);
  const [listings, setListings] = useState<ProfessionalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([getPromotionUsage(), fetchMyListings()]);
      setUsage(u);
      setListings(l.filter((x) => x.portal_type === portalType && x.moderation_status === 'approved'));
    } catch (err) {
      console.error('Error loading promotion data:', err);
    } finally {
      setLoading(false);
    }
  }, [portalType]);

  useEffect(() => { void load(); }, [load]);

  const approvedListing = listings[0];

  const handlePublish = async () => {
    if (!approvedListing) {
      setError('You need an approved professional listing before creating promotions.');
      return;
    }
    if (!headline.trim()) {
      setError('Please enter a headline for your promotion.');
      return;
    }
    setPublishing(true);
    setError(null);
    setMsg(null);
    try {
      const result = await createPromotion({
        listingId: approvedListing.id,
        headline: headline.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        category: category.trim() || undefined,
      });
      if (result.success) {
        setMsg(`Promotion published! It will appear on the Info Feed for ${usage?.duration_hours ?? 24} hours.`);
        setHeadline('');
        setDescription('');
        setImageUrl('');
        setCtaLabel('');
        setCtaUrl('');
        setCategory('');
        void load();
        setTimeout(() => setMsg(null), 5000);
      } else {
        setError(result.error ?? 'Failed to create promotion.');
      }
    } catch (err) {
      setError('An error occurred while creating the promotion.');
      console.error(err);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!approvedListing) {
    return (
      <div className="rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <AlertCircle className="h-4 w-4 text-white/30" />
          Create and get your professional listing approved before creating Info Feed promotions.
        </div>
      </div>
    );
  }

  if (usage && usage.allowance === 0) {
    return (
      <div className="rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <AlertCircle className="h-4 w-4 text-white/30" />
          Info Feed promotions are not enabled for your portal type.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Allowance counter */}
      <div className="rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" style={{ color: GOLD }} />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/50">Info Feed Promotions</h3>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold" style={{ color: GOLD }}>
              {usage?.remaining ?? 0}
            </span>
            <span className="text-[10px] text-white/40"> of {usage?.allowance ?? 0} remaining</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-white/35">
          <Clock className="h-3 w-3" />
          Resets {usage?.resets_at ?? 'next month'} · Each promotion lasts {usage?.duration_hours ?? 24} hours
        </div>
      </div>

      {/* Composer */}
      {usage && usage.remaining > 0 ? (
        <div className="rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/50">Create Promotional Post</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-white/40">Headline</label>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputCls} placeholder="Catchy headline for your promotion" maxLength={120} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-white/40">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-h-[80px] resize-y`} placeholder="Describe what you're promoting" maxLength={500} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-white/40">Image URL (optional)</label>
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputCls} placeholder="https://..." />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-white/40">Category (optional)</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="e.g. Coaching, Content" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-white/40">CTA Label (optional)</label>
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className={inputCls} placeholder="Book Now" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-white/40">CTA URL (optional)</label>
                <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className={inputCls} placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* Duration notice */}
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/5 px-3 py-2 text-[9px] text-[#d4a52c]/80">
            <Clock className="h-3 w-3 shrink-0" />
            This promotion will appear on the Info Feed for {usage.duration_hours} hours, then automatically expire from its promoted placement.
          </div>

          {/* Publish */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handlePublish}
              disabled={publishing || !headline.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25 disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Publish Promotion
            </button>
            {msg && <span className="text-[11px] font-medium text-emerald-400">{msg}</span>}
            {error && <span className="text-[11px] font-medium text-red-400">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-white/15" />
          <p className="text-[11px] text-white/40">You've used all your promotional posts for this month.</p>
          <p className="mt-1 text-[10px] text-white/30">Your allowance resets on {usage?.resets_at ?? 'next month'}.</p>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[11px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[#c0911e]/30';
