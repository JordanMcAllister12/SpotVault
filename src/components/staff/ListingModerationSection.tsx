import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, X, Eye, EyeOff, Ban, RotateCcw, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PORTAL_TYPE_LABELS, type ProfessionalListing, type ModerationStatus, type PortalType } from '@/lib/professionalListingStore';
import { GOLD, CARD_BORDER, CARD_BG, CARD_SHADOW } from '@/components/store/storeTokens';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';

export function ListingModerationSection({ staffAccount }: { staffAccount: { id: string; name: string } }) {
  const [listings, setListings] = useState<ProfessionalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('professional_listings')
        .select('*')
        .order('created_at', { ascending: false });
      if (filter !== 'all') {
        query = query.eq('moderation_status', filter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setListings((data ?? []) as ProfessionalListing[]);
    } catch (err) {
      console.error('Error loading listings:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (listingId: string, status: ModerationStatus, staffNote?: string) => {
    setActionLoading(listingId);
    setMsg(null);
    try {
      const { error } = await supabase
        .from('professional_listings')
        .update({
          moderation_status: status,
          moderation_note: staffNote ?? null,
          moderated_by: staffAccount.id,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', listingId);
      if (error) throw error;
      setMsg(`Listing ${status}.`);
      setTimeout(() => setMsg(null), 3000);
      void load();
    } catch (err) {
      setMsg('Error updating listing.');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleVisibility = async (listing: ProfessionalListing) => {
    setActionLoading(listing.id);
    try {
      const { error } = await supabase
        .from('professional_listings')
        .update({ is_visible: !listing.is_visible })
        .eq('id', listing.id);
      if (error) throw error;
      void load();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 border-b border-white/[0.06] pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
          <FileText className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Listing Moderation</h2>
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#c0911e]/60">Professional listing review &amp; management</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'suspended', 'all'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase transition-all ${
              filter === f
                ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]'
                : 'border-[#232a32] bg-[#161b21] text-[#84929f] hover:border-[#38424e]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {msg && (
        <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] font-medium text-emerald-400">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-white/55">No {filter !== 'all' ? filter : ''} listings</p>
          <p className="mt-1 text-[11px] text-white/40">
            {filter === 'pending' ? 'No listings awaiting review.' : 'No listings match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="rounded-xl border p-4" style={{ borderColor: CARD_BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
              {/* Top row */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/10">
                  {listing.profile_image_url ? (
                    <img src={listing.profile_image_url} alt={listing.display_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-[#d4a52c]/60">{listing.display_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-white">{listing.display_name}</h3>
                    <span className="rounded border border-[#c0911e]/30 bg-[#c0911e]/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-[#d4a52c] uppercase">
                      {PORTAL_TYPE_LABELS[listing.portal_type as PortalType] ?? 'Professional'}
                    </span>
                    <StatusBadge status={listing.moderation_status} />
                    {!listing.is_visible && (
                      <span className="flex items-center gap-0.5 text-[9px] font-medium text-white/30">
                        <EyeOff className="h-2.5 w-2.5" /> Hidden
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-[#d4a52c]/60">{listing.professional_title}</p>
                  <p className="mt-0.5 text-[10px] text-white/45">{listing.short_bio}</p>
                  {listing.moderation_note && (
                    <p className="mt-1 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[9px] text-white/40">
                      Note: {listing.moderation_note}
                    </p>
                  )}
                </div>
              </div>

              {/* Specialties */}
              {listing.specialties.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {listing.specialties.slice(0, 5).map((s) => (
                    <span key={s} className="rounded border border-[#c0911e]/20 bg-[#c0911e]/5 px-1.5 py-0.5 text-[8px] font-medium text-[#d4a52c]/80">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Staff note input */}
              <div className="mt-3">
                <input
                  value={note[listing.id] ?? ''}
                  onChange={(e) => setNote({ ...note, [listing.id]: e.target.value })}
                  placeholder="Staff note (optional — shown to the listing owner)..."
                  className="w-full rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] text-white/60 placeholder-white/25 outline-none focus:border-[#c0911e]/30"
                />
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3">
                {listing.moderation_status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(listing.id, 'approved', note[listing.id])}
                    disabled={actionLoading === listing.id}
                    className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[9px] font-bold tracking-widest text-emerald-400 uppercase transition hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                )}
                {listing.moderation_status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus(listing.id, 'rejected', note[listing.id])}
                    disabled={actionLoading === listing.id}
                    className="flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[9px] font-bold tracking-widest text-red-400 uppercase transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                )}
                {listing.moderation_status !== 'suspended' && (
                  <button
                    onClick={() => updateStatus(listing.id, 'suspended', note[listing.id])}
                    disabled={actionLoading === listing.id}
                    className="flex items-center gap-1 rounded-md border border-orange-500/20 bg-orange-500/5 px-3 py-1.5 text-[9px] font-bold tracking-widest text-orange-400 uppercase transition hover:bg-orange-500/10 disabled:opacity-50"
                  >
                    <Ban className="h-3 w-3" /> Suspend
                  </button>
                )}
                {listing.moderation_status !== 'pending' && (
                  <button
                    onClick={() => updateStatus(listing.id, 'pending')}
                    disabled={actionLoading === listing.id}
                    className="flex items-center gap-1 rounded-md border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[9px] font-bold tracking-widest text-white/50 uppercase transition hover:border-[#38424e] hover:text-white/70 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset to Pending
                  </button>
                )}
                <button
                  onClick={() => toggleVisibility(listing)}
                  disabled={actionLoading === listing.id}
                  className="flex items-center gap-1 rounded-md border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[9px] font-bold tracking-widest text-white/50 uppercase transition hover:border-[#38424e] hover:text-white/70 disabled:opacity-50"
                >
                  {listing.is_visible ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
                </button>
                {actionLoading === listing.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ModerationStatus }) {
  const colors: Record<ModerationStatus, string> = {
    pending: 'text-[#d4a52c] border-[#d4a52c]/30 bg-[#d4a52c]/10',
    approved: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    rejected: 'text-red-400 border-red-500/20 bg-red-500/5',
    suspended: 'text-orange-400 border-orange-500/20 bg-orange-500/5',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase ${colors[status]}`}>
      {status}
    </span>
  );
}
