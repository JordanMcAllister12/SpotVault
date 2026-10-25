import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RotateCcw, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import type { AccomplishmentWithEvidence, ReviewStatus, ReviewAction } from './types';
import { CATEGORY_LABELS, REVIEW_STATUS_LABELS, REVIEW_STATUS_COLORS } from './types';
import { getPendingAccomplishments, staffReviewAction } from './communityData';
import { CategoryIcon } from './IdentityBadges';

interface StaffVerificationQueueProps {
  staffId: string;
}

export function StaffVerificationQueue({ staffId }: StaffVerificationQueueProps) {
  const [items, setItems] = useState<AccomplishmentWithEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [showNotes, setShowNotes] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPendingAccomplishments();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (accomplishmentId: string, action: ReviewAction, newStatus: ReviewStatus) => {
    setActioning(accomplishmentId);
    const notes = notesMap[accomplishmentId] ?? null;
    await staffReviewAction(accomplishmentId, staffId, action, newStatus, notes ?? undefined);
    setActioning(null);
    setNotesMap(m => { const c = { ...m }; delete c[accomplishmentId]; return c; });
    setShowNotes(s => { const c = new Set(s); c.delete(accomplishmentId); return c; });
    await load();
  };

  const toggleNotes = (id: string) => {
    setShowNotes(s => { const c = new Set(s); if (c.has(id)) c.delete(id); else c.add(id); return c; });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e8e0d0' }}>Community Verification</h3>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition-all hover:bg-white/10"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#6b7280', fontSize: 11 }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
        }}>
          <CheckCircle2 size={28} style={{ color: '#22c55e', margin: '0 auto', opacity: 0.5 }} />
          <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>No accomplishments awaiting review</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(acc => {
            const statusColor = REVIEW_STATUS_COLORS[acc.review_status];
            const isActioning = actioning === acc.id;
            return (
              <div
                key={acc.id}
                className="rounded-xl border p-4"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CategoryIcon category={acc.category} size={18} color="#d4a52c" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e0d0' }}>{acc.title}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`,
                      }}>
                        {REVIEW_STATUS_LABELS[acc.review_status]}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>User: <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{acc.user_id}</span></span>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>Category: <span style={{ color: '#9ca3af' }}>{CATEGORY_LABELS[acc.category]}</span></span>
                      {acc.submitted_for_review_at && (
                        <span style={{ fontSize: 10, color: '#6b7280' }}>Submitted: <span style={{ color: '#9ca3af' }}>{new Date(acc.submitted_for_review_at).toLocaleDateString()}</span></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details */}
                {acc.description && (
                  <p style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{acc.description}</p>
                )}
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {acc.event_name && <DetailChip label="Event" value={acc.event_name} />}
                  {acc.finish && <DetailChip label="Finish" value={acc.finish} />}
                  {acc.prize_amount != null && acc.prize_amount > 0 && <DetailChip label="Prize" value={`$${acc.prize_amount.toLocaleString()}`} />}
                  {acc.ranking && <DetailChip label="Ranking" value={acc.ranking} />}
                  {acc.poker_site && <DetailChip label="Site" value={acc.poker_site} />}
                  {acc.tournament_series && <DetailChip label="Series" value={acc.tournament_series} />}
                  {acc.organization && <DetailChip label="Org" value={acc.organization} />}
                  {acc.accomplishment_date && <DetailChip label="Date" value={acc.accomplishment_date} />}
                </div>

                {/* Evidence */}
                {acc.evidence && acc.evidence.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Evidence</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {acc.evidence.map(ev => (
                        <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                          <FileText size={11} style={{ color: '#6b7280' }} />
                          <span style={{ fontSize: 10, color: '#9ca3af', flex: 1 }}>{ev.label ?? ev.url ?? 'Evidence'}</span>
                          {ev.url && (
                            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#d4a52c] hover:underline">
                              <ExternalLink size={10} /> Open
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staff notes toggle */}
                <button
                  onClick={() => toggleNotes(acc.id)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60"
                >
                  <AlertCircle size={11} /> {showNotes.has(acc.id) ? 'Hide' : 'Add'} staff notes
                </button>
                {showNotes.has(acc.id) && (
                  <textarea
                    rows={2}
                    value={notesMap[acc.id] ?? ''}
                    onChange={e => setNotesMap(m => ({ ...m, [acc.id]: e.target.value }))}
                    placeholder="Internal staff notes (not visible to user)..."
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/80 placeholder:text-white/20 outline-none focus:border-[#d4a52c]/40"
                  />
                )}

                {/* Actions */}
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleAction(acc.id, 'verify', 'verified')}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-green-400 transition-all hover:bg-green-500/20 disabled:opacity-40"
                  >
                    <CheckCircle2 size={13} /> Verify
                  </button>
                  <button
                    onClick={() => handleAction(acc.id, 'request_info', 'needs_info')}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-400 transition-all hover:bg-blue-500/20 disabled:opacity-40"
                  >
                    <AlertCircle size={13} /> Request Info
                  </button>
                  <button
                    onClick={() => handleAction(acc.id, 'reject', 'rejected')}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-40"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                  {acc.review_status === 'verified' && (
                    <button
                      onClick={() => handleAction(acc.id, 'remove_verification', 'unreviewed')}
                      disabled={isActioning}
                      className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-orange-400 transition-all hover:bg-orange-500/20 disabled:opacity-40"
                    >
                      <RotateCcw size={13} /> Remove Verification
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      fontSize: 10, color: '#9ca3af',
      padding: '2px 8px', borderRadius: 99,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ color: '#6b7280' }}>{label}:</span> {value}
    </span>
  );
}
