import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, Trash2, Save, Check, X, Send, Eye, Clock,
  FileText, Image as ImageIcon, Video, Link as LinkIcon, Calendar,
  AlertCircle, CheckCircle2, CircleDot, Loader2, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SpotVaultAccount } from '@/types';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const GOLD_BRIGHT = '#f5e6b0';
const BORDER = 'rgba(255,255,255,0.08)';
const DARK_PANEL = 'rgba(8,11,14,0.92)';

const CONTENT_TYPES = [
  { id: 'text', label: 'Text Post', icon: FileText },
  { id: 'image', label: 'Image Post', icon: ImageIcon },
  { id: 'video', label: 'Video Post', icon: Video },
  { id: 'link', label: 'Link', icon: LinkIcon },
  { id: 'announcement', label: 'Announcement', icon: Megaphone },
  { id: 'promotion', label: 'Promotion', icon: Megaphone },
  { id: 'event', label: 'Event', icon: Calendar },
  { id: 'hiring', label: 'Hiring', icon: Megaphone },
  { id: 'sponsorship', label: 'Sponsorship', icon: Megaphone },
  { id: 'partnership', label: 'Partnership', icon: Megaphone },
] as const;

const CTA_OPTIONS = ['LEARN MORE', 'VIEW EVENT', 'VIEW PRODUCT', 'APPLY', 'BOOK', 'CONTACT', 'VIEW PROFILE'];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: 'Draft', color: '#6b7280', icon: CircleDot },
  pending: { label: 'Pending Approval', color: '#f59e0b', icon: Clock },
  changes_requested: { label: 'Changes Requested', color: '#f97316', icon: AlertCircle },
  approved: { label: 'Approved', color: '#34d399', icon: CheckCircle2 },
  scheduled: { label: 'Scheduled', color: '#60a5fa', icon: Clock },
  live: { label: 'Live', color: '#34d399', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#ef4444', icon: X },
  expired: { label: 'Expired', color: '#6b7280', icon: Clock },
};

interface ContentSubmission {
  id?: string;
  status: string;
  content_type: string;
  headline: string;
  body: string;
  images: string[];
  video_url: string;
  link_url: string;
  cta_label: string;
  cta_url: string;
  scheduled_for: string | null;
  staff_notes: string;
  created_at: string;
}

interface Entitlement {
  industry_posts_included: number;
  industry_posts_used: number;
  allowance_reset_period: string;
  next_reset_at: string | null;
  additional_post_price: number;
}

export function BusinessCreateStudio({ account }: { account: SpotVaultAccount }) {
  const [submissions, setSubmissions] = useState<ContentSubmission[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [subRes, entRes] = await Promise.all([
      supabase.from('business_content_submissions').select('*').eq('account_id', account.id).order('created_at', { ascending: false }),
      supabase.from('business_entitlements').select('*').eq('account_id', account.id).maybeSingle(),
    ]);
    setSubmissions((subRes.data ?? []) as ContentSubmission[]);
    if (entRes.data) setEntitlement(entRes.data as Entitlement);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { void load(); }, [load]);

  const postsRemaining = entitlement ? Math.max(0, entitlement.industry_posts_included - entitlement.industry_posts_used) : 0;

  return (
    <PortalWorkspaceShell maxWidth="max-w-4xl">
    <div className="mx-auto space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
            <Megaphone className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Create</h2>
            <p className="text-[10px] text-white/35">Build promotional content for the Industry Feed</p>
          </div>
        </div>
        <button onClick={() => { setEditingId(null); setShowComposer(true); }}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
          style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
          <Plus size={12} /> New Post
        </button>
      </div>

      {/* Entitlement bar */}
      {entitlement && (
        <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Industry Posts</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/50">{entitlement.industry_posts_used} / {entitlement.industry_posts_included} used</span>
              <span className="text-[11px] font-bold" style={{ color: postsRemaining > 0 ? GOLD : '#ef4444' }}>{postsRemaining} remaining</span>
            </div>
            {entitlement.next_reset_at && (
              <span className="text-[10px] text-white/30">Resets: {new Date(entitlement.next_reset_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            )}
            {postsRemaining === 0 && (
              <button className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                style={{ borderColor: GOLD, color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }}>
                <Plus size={11} /> Buy Additional ({entitlement.additional_post_price}c)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Composer */}
      {showComposer && (
        <Composer account={account} editingId={editingId} onClose={() => { setShowComposer(false); setEditingId(null); }} onSaved={() => { setShowComposer(false); setEditingId(null); void load(); }} />
      )}

      {/* Submissions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" /></div>
      ) : submissions.length === 0 && !showComposer ? (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: BORDER, background: DARK_PANEL }}>
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="text-sm text-white/40">No content yet. Create a post to submit it for Industry Feed distribution.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => {
            const statusInfo = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.draft;
            const StatusIcon = statusInfo.icon;
            return (
              <div key={sub.id} className="rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ borderColor: statusInfo.color + '30', background: statusInfo.color + '10', color: statusInfo.color }}>
                        <StatusIcon size={10} className="inline mr-1" />{statusInfo.label}
                      </span>
                      <span className="text-[9px] font-mono tracking-widest text-white/25 uppercase">{sub.content_type}</span>
                    </div>
                    <h4 className="mt-1.5 text-sm font-semibold text-white/85">{sub.headline}</h4>
                    {sub.body && <p className="mt-1 text-[11px] leading-relaxed text-white/40 line-clamp-2">{sub.body}</p>}
                    {sub.staff_notes && sub.status === 'changes_requested' && (
                      <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.05)' }}>
                        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#f97316' }}>Staff Feedback: </span>
                        <span className="text-[10px] text-white/50">{sub.staff_notes}</span>
                      </div>
                    )}
                    <span className="mt-1.5 block text-[9px] text-white/20">{new Date(sub.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {sub.status === 'draft' && (
                      <button onClick={() => { setEditingId(sub.id ?? null); setShowComposer(true); }} className="flex h-7 w-7 items-center justify-center rounded-md border transition-all hover:scale-105" style={{ borderColor: BORDER, color: '#9ca3af' }} title="Edit"><FileText size={13} /></button>
                    )}
                    {sub.status === 'draft' && (
                      <button onClick={async () => {
                        if (!sub.id) return;
                        await supabase.from('business_content_submissions').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', sub.id);
                        void load();
                      }} className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-105"
                        style={{ borderColor: GOLD, color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }} title="Submit for approval">
                        <Send size={11} /> Submit
                      </button>
                    )}
                    <button onClick={async () => {
                      if (!sub.id) return;
                      await supabase.from('business_content_submissions').delete().eq('id', sub.id);
                      void load();
                    }} className="flex h-7 w-7 items-center justify-center rounded-md border transition-all hover:border-red-500/40 hover:bg-red-500/10" style={{ borderColor: BORDER, color: '#f87171' }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PortalWorkspaceShell>
  );
}

function Composer({ account, editingId, onClose, onSaved }: {
  account: SpotVaultAccount;
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [contentType, setContentType] = useState('announcement');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    void (async () => {
      const { data } = await supabase.from('business_content_submissions').select('*').eq('id', editingId).maybeSingle();
      if (data) {
        const sub = data as ContentSubmission;
        setContentType(sub.content_type); setHeadline(sub.headline); setBody(sub.body);
        setLinkUrl(sub.link_url); setCtaLabel(sub.cta_label); setCtaUrl(sub.cta_url);
      }
    })();
  }, [editingId]);

  const save = async (status: string) => {
    setSaving(true);
    const payload = {
      account_id: account.id, status, content_type: contentType, headline: headline.trim(),
      body: body.trim(), link_url: linkUrl.trim() || null, cta_label: ctaLabel || null,
      cta_url: ctaUrl || null, updated_at: new Date().toISOString(),
    };
    if (editingId) {
      await supabase.from('business_content_submissions').update(payload).eq('id', editingId);
    } else {
      await supabase.from('business_content_submissions').insert({ ...payload, images: [], video_url: '' });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/50">{editingId ? 'Edit Post' : 'New Post'}</h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={16} /></button>
      </div>

      {/* Content type selector */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CONTENT_TYPES.map(t => (
          <button key={t.id} onClick={() => setContentType(t.id)} className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all ${contentType === t.id ? 'border-[#c091e]/30 bg-[#c091e]/10 text-[#d4a52c]' : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55'}`}>
            <t.icon size={11} /> {t.label}
          </button>
        ))}
      </div>

      <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline..." className="input-base" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body text..." className="input-base mt-2 min-h-[100px] resize-y" />
      <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Link URL (optional)" className="input-base mt-2" />

      {/* CTA */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-mono tracking-widest text-white/30 uppercase">CTA Label</label>
          <select value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className="input-base">
            <option value="">None</option>
            {CTA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-mono tracking-widest text-white/30 uppercase">CTA URL</label>
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="destination.com" className="input-base" />
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgba(217,119,87,0.15)', background: 'rgba(14,10,8,0.92)' }}>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[8px] font-bold tracking-[0.2em] uppercase" style={{ color: '#d97757' }}>Promoted</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <p className="text-[11px] font-bold text-white/85">{headline || 'Your headline'}</p>
          {body && <p className="mt-1 text-[11px] leading-relaxed text-white/60">{body}</p>}
          {ctaLabel && <button className="mt-2 rounded-md border px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ borderColor: GOLD, color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }}>{ctaLabel}</button>}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105" style={{ borderColor: BORDER, color: '#9ca3af' }}>
          <Eye size={12} /> {showPreview ? 'Hide Preview' : 'Preview'}
        </button>
        <button onClick={() => save('draft')} disabled={saving || !headline.trim()} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-40" style={{ borderColor: BORDER, color: '#9ca3af' }}>
          <Save size={12} /> Save Draft
        </button>
        <button onClick={() => save('pending')} disabled={saving || !headline.trim()} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-40" style={{ borderColor: GOLD, color: GOLD_BRIGHT, background: 'rgba(192,145,30,0.08)' }}>
          <Send size={12} /> Submit for Approval
        </button>
      </div>
    </div>
  );
}
