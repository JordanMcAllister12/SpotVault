import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit3, Send, CheckCircle2, AlertCircle, Link2, FileText, X, Upload, ExternalLink } from 'lucide-react';
import type { AccomplishmentWithEvidence, AccomplishmentCategory, EvidenceType } from './types';
import { CATEGORY_LABELS, REVIEW_STATUS_LABELS, REVIEW_STATUS_COLORS } from './types';
import {
  getAccomplishments, createAccomplishment, updateAccomplishment,
  deleteAccomplishment, submitForReview, addEvidence, deleteEvidence,
} from './communityData';
import { CategoryIcon, VerifiedBadge } from './IdentityBadges';

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [AccomplishmentCategory, string][];

interface AccomplishmentsPanelProps {
  userId: string;
  canEdit: boolean;
}

export function AccomplishmentsPanel({ userId, canEdit }: AccomplishmentsPanelProps) {
  const [accomplishments, setAccomplishments] = useState<AccomplishmentWithEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAccomplishments(userId);
    setAccomplishments(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData: AccomplishmentFormData) => {
    if (editingId) {
      await updateAccomplishment(editingId, {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        accomplishment_date: formData.accomplishment_date || null,
        event_name: formData.event_name || null,
        finish: formData.finish || null,
        prize_amount: formData.prize_amount || null,
        poker_site: formData.poker_site || null,
        tournament_series: formData.tournament_series || null,
        ranking: formData.ranking || null,
        organization: formData.organization || null,
      });
    } else {
      await createAccomplishment(userId, {
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category,
        accomplishment_date: formData.accomplishment_date || undefined,
        event_name: formData.event_name || undefined,
        finish: formData.finish || undefined,
        prize_amount: formData.prize_amount || undefined,
        poker_site: formData.poker_site || undefined,
        tournament_series: formData.tournament_series || undefined,
        ranking: formData.ranking || undefined,
        organization: formData.organization || undefined,
      });
    }
    setShowForm(false);
    setEditingId(null);
    await load();
  };

  const handleSubmitReview = async (id: string) => {
    await submitForReview(id, userId);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteAccomplishment(id);
    await load();
  };

  const handleEdit = (acc: AccomplishmentWithEvidence) => {
    setEditingId(acc.id);
    setShowForm(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e8e0d0' }}>Accomplishments</h3>
        {canEdit && !showForm && (
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#d4a52c] transition-all hover:bg-[#d4a52c]/20"
          >
            <Plus size={13} /> Add
          </button>
        )}
      </div>

      {showForm && (
        <AccomplishmentForm
          userId={userId}
          editing={editingId ? accomplishments.find(a => a.id === editingId) ?? null : null}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#6b7280', fontSize: 11 }}>Loading...</div>
      ) : accomplishments.length === 0 && !showForm ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#4b5563', fontSize: 11 }}>
          No accomplishments yet. {canEdit && 'Click Add to submit your first one.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {accomplishments.map(acc => (
            <AccomplishmentCard
              key={acc.id}
              acc={acc}
              canEdit={canEdit}
              onEdit={() => handleEdit(acc)}
              onDelete={() => handleDelete(acc.id)}
              onSubmitReview={() => handleSubmitReview(acc.id)}
              userId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Accomplishment Card ──

function AccomplishmentCard({
  acc, canEdit, onEdit, onDelete, onSubmitReview, userId,
}: {
  acc: AccomplishmentWithEvidence;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSubmitReview: () => void;
  userId: string;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const isVerified = acc.review_status === 'verified';
  const isPending = acc.review_status === 'pending';
  const isUnreviewed = acc.review_status === 'unreviewed';
  const isRejected = acc.review_status === 'rejected';
  const statusColor = REVIEW_STATUS_COLORS[acc.review_status];
  const canEditAcc = canEdit && (isUnreviewed || isRejected);

  return (
    <div
      className="rounded-xl border p-3 transition-all"
      style={{
        borderColor: isVerified ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
        background: isVerified ? 'rgba(34,197,94,0.03)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <CategoryIcon category={acc.category} size={18} color={isVerified ? '#d4a52c' : '#6b7280'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e0d0' }}>{acc.title}</span>
            {isVerified && <VerifiedBadge size={13} />}
          </div>
          {acc.description && (
            <p style={{ marginTop: 4, fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{acc.description}</p>
          )}
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {acc.event_name && <Chip label={acc.event_name} />}
            {acc.finish && <Chip label={acc.finish} />}
            {acc.prize_amount != null && acc.prize_amount > 0 && <Chip label={`$${acc.prize_amount.toLocaleString()}`} />}
            {acc.ranking && <Chip label={acc.ranking} />}
            {acc.poker_site && <Chip label={acc.poker_site} />}
            {acc.tournament_series && <Chip label={acc.tournament_series} />}
            {acc.organization && <Chip label={acc.organization} />}
            {acc.accomplishment_date && <Chip label={acc.accomplishment_date} />}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`,
            }}>
              {REVIEW_STATUS_LABELS[acc.review_status]}
            </span>
            {acc.evidence && acc.evidence.length > 0 && (
              <button
                onClick={() => setShowEvidence(s => !s)}
                className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60"
              >
                <FileText size={11} /> {acc.evidence.length} evidence {showEvidence ? '▾' : '▸'}
              </button>
            )}
          </div>
          {showEvidence && acc.evidence && acc.evidence.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {acc.evidence.map(ev => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                  <Link2 size={11} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{ev.label ?? ev.url ?? 'Evidence'}</span>
                  {ev.url && (
                    <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-[#d4a52c] hover:underline">
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
          {canEditAcc && (
            <>
              <button onClick={onEdit} className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-white/50 hover:bg-white/5 hover:text-white/80">
                <Edit3 size={11} /> Edit
              </button>
              {isUnreviewed && (
                <button onClick={onSubmitReview} className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-[#d4a52c] hover:bg-[#d4a52c]/10">
                  <Send size={11} /> Submit for Review
                </button>
              )}
              <button onClick={onDelete} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-red-400/60 hover:bg-red-400/10 hover:text-red-400">
                <Trash2 size={11} /> Delete
              </button>
            </>
          )}
          {isPending && (
            <span style={{ fontSize: 10, color: '#6b7280' }}>Awaiting staff review</span>
          )}
          {acc.review_status === 'needs_info' && (
            <span style={{ fontSize: 10, color: '#60a5fa' }}>Staff requested more info — edit and resubmit</span>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, color: '#9ca3af',
      padding: '2px 8px', borderRadius: 99,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    }}>{label}</span>
  );
}

// ── Accomplishment Form ──

interface AccomplishmentFormData {
  title: string;
  description: string;
  category: AccomplishmentCategory;
  accomplishment_date: string;
  event_name: string;
  finish: string;
  prize_amount: number;
  poker_site: string;
  tournament_series: string;
  ranking: string;
  organization: string;
}

function AccomplishmentForm({
  userId, editing, onSave, onCancel,
}: {
  userId: string;
  editing: AccomplishmentWithEvidence | null;
  onSave: (data: AccomplishmentFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AccomplishmentFormData>({
    title: editing?.title ?? '',
    description: editing?.description ?? '',
    category: editing?.category ?? 'tournament_win',
    accomplishment_date: editing?.accomplishment_date ?? '',
    event_name: editing?.event_name ?? '',
    finish: editing?.finish ?? '',
    prize_amount: editing?.prize_amount ?? 0,
    poker_site: editing?.poker_site ?? '',
    tournament_series: editing?.tournament_series ?? '',
    ranking: editing?.ranking ?? '',
    organization: editing?.organization ?? '',
  });
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceLabel, setEvidenceLabel] = useState('');
  const [evidenceList, setEvidenceList] = useState<{ url: string; label: string; type: string }[]>(
    editing?.evidence?.map(e => ({ url: e.url ?? '', label: e.label ?? '', type: e.evidence_type })) ?? []
  );
  const [saving, setSaving] = useState(false);

  const update = (field: keyof AccomplishmentFormData, value: string | number) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const addEvidenceItem = () => {
    if (!evidenceUrl.trim()) return;
    const type: EvidenceType = evidenceUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? 'screenshot' : 'url';
    setEvidenceList(l => [...l, { url: evidenceUrl.trim(), label: evidenceLabel.trim() || 'Evidence link', type }]);
    setEvidenceUrl('');
    setEvidenceLabel('');
  };

  const removeEvidenceItem = (idx: number) => {
    setEvidenceList(l => l.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(form);
    // After save, if we have evidence items and this was a new accomplishment,
    // we need to add evidence to the newly created accomplishment
    // (For editing, evidence is managed separately — this is a simplified approach)
    if (!editing && evidenceList.length > 0) {
      // The new accomplishment was just created — we'd need its ID to add evidence.
      // For now, evidence is added after creation via the edit flow.
    }
    if (editing && evidenceList.length > 0) {
      // Add new evidence items
      for (const ev of evidenceList) {
        if (ev.url) {
          await addEvidence(editing.id, { evidence_type: ev.type, url: ev.url, label: ev.label });
        }
      }
    }
    setSaving(false);
  };

  const inputCls = "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 placeholder:text-white/20 outline-none focus:border-[#d4a52c]/40";
  const labelCls = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40";

  return (
    <div className="rounded-xl border border-[#d4a52c]/20 bg-black/40 p-4" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#d4a52c' }}>
          {editing ? 'Edit Accomplishment' : 'New Accomplishment'}
        </span>
        <button onClick={onCancel} className="text-white/40 hover:text-white/80">
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label className={labelCls}>Title *</label>
          <input className={inputCls} value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Manitoba Poker Open Champion" />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea className={inputCls} rows={2} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Brief description of the accomplishment" />
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={form.category} onChange={e => update('category', e.target.value)}>
            {CATEGORIES.map(([val, label]) => <option key={val} value={val} style={{ background: '#0c0a08' }}>{label}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" className={inputCls} value={form.accomplishment_date} onChange={e => update('accomplishment_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Event / Tournament</label>
            <input className={inputCls} value={form.event_name} onChange={e => update('event_name', e.target.value)} placeholder="e.g. Manitoba Poker Open" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className={labelCls}>Finish</label>
            <input className={inputCls} value={form.finish} onChange={e => update('finish', e.target.value)} placeholder="e.g. 1st, Final Table" />
          </div>
          <div>
            <label className={labelCls}>Prize ($)</label>
            <input type="number" className={inputCls} value={form.prize_amount || ''} onChange={e => update('prize_amount', Number(e.target.value) || 0)} placeholder="0" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className={labelCls}>Poker Site</label>
            <input className={inputCls} value={form.poker_site} onChange={e => update('poker_site', e.target.value)} placeholder="e.g. PokerStars" />
          </div>
          <div>
            <label className={labelCls}>Tournament Series</label>
            <input className={inputCls} value={form.tournament_series} onChange={e => update('tournament_series', e.target.value)} placeholder="e.g. WSOP, WPT" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className={labelCls}>Ranking</label>
            <input className={inputCls} value={form.ranking} onChange={e => update('ranking', e.target.value)} placeholder="e.g. #1 on SharkScope" />
          </div>
          <div>
            <label className={labelCls}>Organization</label>
            <input className={inputCls} value={form.organization} onChange={e => update('organization', e.target.value)} placeholder="For industry positions" />
          </div>
        </div>

        {/* Evidence */}
        <div>
          <label className={labelCls}>Supporting Evidence (links/screenshots)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className={inputCls} value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} placeholder="Paste URL (screenshot, image, result page)" />
            <input className={`${inputCls} flex-shrink-0`} style={{ width: 120 }} value={evidenceLabel} onChange={e => setEvidenceLabel(e.target.value)} placeholder="Label" />
            <button onClick={addEvidenceItem} className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-white/60 hover:bg-white/10">
              <Plus size={14} />
            </button>
          </div>
          {evidenceList.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {evidenceList.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                  <Link2 size={11} style={{ color: '#6b7280' }} />
                  <span style={{ fontSize: 10, color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.label} — {ev.url}</span>
                  <button onClick={() => removeEvidenceItem(i)} className="text-red-400/50 hover:text-red-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim() || saving}
            className="flex-1 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-[#d4a52c] transition-all hover:bg-[#d4a52c]/25 disabled:opacity-40"
          >
            {saving ? 'Saving...' : editing ? 'Update' : 'Create Accomplishment'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white/50 transition-all hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
