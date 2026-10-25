import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Zap, Clock, Check, X, MessageSquare, DollarSign,
  Inbox, Send,
} from 'lucide-react';
import {
  fetchPaidRequestSettings, upsertPaidRequestSettings,
  fetchReceivedPaidRequests, fetchSentPaidRequests,
  acceptPaidRequest, declinePaidRequest, completePaidRequest,
  type PaidRequest, type PaidRequestSettings,
  PAID_REQUEST_LABELS, RESPONSE_WINDOW_OPTIONS,
} from '@/lib/monetizationStore';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  userId: string;
  portalType: 'creator' | 'coach' | 'media' | 'business';
}

type Tab = 'inbox' | 'settings' | 'sent';

export function PaidRequestsPanel({ userId, portalType }: Props) {
  const [tab, setTab] = useState<Tab>('inbox');
  const [settings, setSettings] = useState<PaidRequestSettings | null>(null);
  const [received, setReceived] = useState<PaidRequest[]>([]);
  const [sent, setSent] = useState<PaidRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Settings form
  const [isEnabled, setIsEnabled] = useState(false);
  const [price, setPrice] = useState(50);
  const [subscriberPrice, setSubscriberPrice] = useState<number | null>(null);
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [maxPerWeek, setMaxPerWeek] = useState(0);
  const [responseWindow, setResponseWindow] = useState(48);
  const [whoCanSend, setWhoCanSend] = useState('everyone');

  const labelOptions = PAID_REQUEST_LABELS[portalType] ?? ['General Question'];

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, rcv, snt] = await Promise.all([
      fetchPaidRequestSettings(userId),
      fetchReceivedPaidRequests(userId),
      fetchSentPaidRequests(userId),
    ]);
    setSettings(s);
    setReceived(rcv);
    setSent(snt);
    if (s) {
      setIsEnabled(s.is_enabled);
      setPrice(s.price_credits);
      setSubscriberPrice(s.subscriber_price_credits);
      setRequestTypes(s.request_types ?? []);
      setMaxPerWeek(s.max_requests_per_week);
      setResponseWindow(s.response_window_hours);
      setWhoCanSend(s.who_can_send);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function handleSaveSettings() {
    setSaving(true);
    const saved = await upsertPaidRequestSettings(userId, {
      is_enabled: isEnabled,
      price_credits: price,
      subscriber_price_credits: subscriberPrice,
      request_types: requestTypes,
      max_requests_per_week: maxPerWeek,
      response_window_hours: responseWindow,
      who_can_send: whoCanSend,
    });
    if (saved) {
      setSettings(saved);
      setSaveMsg('Settings saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setSaving(false);
  }

  function toggleRequestType(label: string) {
    setRequestTypes((prev) => prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]);
  }

  async function handleAccept(reqId: string) {
    setActionLoading(reqId);
    await acceptPaidRequest(reqId, userId);
    setActionLoading(null);
    await loadAll();
  }

  async function handleDecline(reqId: string) {
    setActionLoading(reqId);
    await declinePaidRequest(reqId, userId);
    setActionLoading(null);
    await loadAll();
  }

  async function handleComplete(reqId: string) {
    setActionLoading(reqId);
    await completePaidRequest(reqId, userId);
    setActionLoading(null);
    await loadAll();
  }

  const pending = received.filter((r) => r.status === 'PENDING');
  const active = received.filter((r) => r.status === 'ACTIVE');
  const completed = received.filter((r) => r.status === 'COMPLETED');
  const declinedOrExpired = received.filter((r) => r.status === 'DECLINED' || r.status === 'EXPIRED');
  const earnings = completed.reduce((sum, r) => sum + Math.floor(r.price_credits * 0.8), 0);

  const tabs: { id: Tab; label: string; icon: typeof Inbox; badge?: number }[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: pending.length },
    { id: 'settings', label: 'Settings', icon: Zap },
    { id: 'sent', label: 'Sent', icon: Send },
  ];

  if (loading) {
    return (
      <PortalWorkspaceShell maxWidth="max-w-3xl">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      </PortalWorkspaceShell>
    );
  }

  return (
    <PortalWorkspaceShell maxWidth="max-w-3xl">
    <div className="mx-auto px-1 py-4">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}>
          <Zap className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-white">Paid Requests</h1>
          <p className="text-[10px] text-white/40">Get paid for direct private messages and questions</p>
        </div>
      </div>

      <div className="mb-5 flex gap-0.5 border-b border-white/[0.04] pb-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
            style={tab === t.id ? { background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT } : { color: 'rgba(255,255,255,0.3)' }}>
            <t.icon className="h-3 w-3" strokeWidth={1.5} />
            {t.label}
            {t.badge != null && t.badge > 0 && <span className="ml-0.5 rounded-full bg-amber-400/20 px-1.5 text-[8px] text-amber-400">{t.badge}</span>}
          </button>
        ))}
      </div>

      {saveMsg && <div className="mb-4 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-[11px] text-emerald-300">{saveMsg}</div>}

      {/* INBOX */}
      {tab === 'inbox' && (
        <div className="space-y-5">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <MiniMetric icon={Clock} label="Pending" value={pending.length} />
            <MiniMetric icon={MessageSquare} label="Active" value={active.length} />
            <MiniMetric icon={DollarSign} label="Earnings" value={earnings} suffix=" CR" />
          </div>

          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Pending</p>
              <div className="space-y-2">
                {pending.map((r) => <RequestRow key={r.id} req={r} actionLoading={actionLoading} onAccept={handleAccept} onDecline={handleDecline} onComplete={handleComplete} />)}
              </div>
            </div>
          )}

          {/* Active */}
          {active.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Active</p>
              <div className="space-y-2">
                {active.map((r) => <RequestRow key={r.id} req={r} actionLoading={actionLoading} onAccept={handleAccept} onDecline={handleDecline} onComplete={handleComplete} />)}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Completed</p>
              <div className="space-y-2">
                {completed.map((r) => <RequestRow key={r.id} req={r} actionLoading={actionLoading} onAccept={handleAccept} onDecline={handleDecline} onComplete={handleComplete} />)}
              </div>
            </div>
          )}

          {/* Declined/Expired */}
          {declinedOrExpired.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Declined / Expired</p>
              <div className="space-y-2 opacity-50">
                {declinedOrExpired.map((r) => <RequestRow key={r.id} req={r} actionLoading={actionLoading} onAccept={handleAccept} onDecline={handleDecline} onComplete={handleComplete} />)}
              </div>
            </div>
          )}

          {received.length === 0 && (
            <div className="py-8 text-center">
              <Inbox className="mx-auto h-6 w-6 text-white/20" strokeWidth={1.5} />
              <p className="mt-2 text-[11px] text-white/30">No paid requests yet.</p>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div>
              <p className="text-[11px] font-semibold text-white/80">Enable Paid Requests</p>
              <p className="mt-0.5 text-[10px] text-white/40">Allow users to pay for direct private messages</p>
            </div>
            <button onClick={() => setIsEnabled(!isEnabled)}
              className="relative h-6 w-11 rounded-full border transition-colors"
              style={{ borderColor: isEnabled ? 'rgba(212,165,44,0.3)' : 'rgba(255,255,255,0.1)', background: isEnabled ? 'rgba(212,165,44,0.15)' : 'rgba(255,255,255,0.03)' }}>
              <div className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ left: isEnabled ? '26px' : '3px', background: isEnabled ? GOLD : 'rgba(255,255,255,0.3)' }} />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Price (Credits)</label>
            <input type="number" value={price} onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#c0911e]/30" />
            <p className="mt-1 text-[9px] text-white/30">{price} credits = ${(price / 10).toFixed(2)}. You receive {Math.floor(price * 0.8)} credits (80%).</p>
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Subscriber Price (optional discount)</label>
            <input type="number" value={subscriberPrice ?? ''} onChange={(e) => setSubscriberPrice(e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 250"
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
            <p className="mt-1 text-[9px] text-white/30">Leave empty for no subscriber discount.</p>
          </div>

          <div>
            <label className="mb-2 block text-[9px] font-bold tracking-widest uppercase text-white/40">Request Types</label>
            <div className="flex flex-wrap gap-2">
              {labelOptions.map((label) => (
                <button key={label} onClick={() => toggleRequestType(label)}
                  className="rounded-lg border px-3 py-2 text-[10px] font-bold transition-all"
                  style={requestTypes.includes(label) ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT } : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Max Per Week (0 = unlimited)</label>
              <input type="number" value={maxPerWeek} onChange={(e) => setMaxPerWeek(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#c0911e]/30" />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Who Can Send</label>
              <select value={whoCanSend} onChange={(e) => setWhoCanSend(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#c0911e]/30">
                <option value="everyone">Everyone</option>
                <option value="followers">Followers</option>
                <option value="subscribers">Subscribers</option>
                <option value="approved">Approved Users</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[9px] font-bold tracking-widest uppercase text-white/40">Response Window</label>
            <div className="flex flex-wrap gap-2">
              {RESPONSE_WINDOW_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setResponseWindow(opt.value)}
                  className="rounded-lg border px-3 py-2 text-[10px] font-bold transition-all"
                  style={responseWindow === opt.value ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT } : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => void handleSaveSettings()} disabled={saving}
            className="w-full rounded-lg border py-2.5 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
            style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Settings'}
          </button>
        </div>
      )}

      {/* SENT */}
      {tab === 'sent' && (
        <div className="space-y-3">
          {sent.length === 0 ? (
            <div className="py-8 text-center">
              <Send className="mx-auto h-6 w-6 text-white/20" strokeWidth={1.5} />
              <p className="mt-2 text-[11px] text-white/30">No sent requests yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sent.map((r) => (
                <div key={r.id} className="rounded-lg border border-white/[0.04] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white/80">{r.subject}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] text-white/40">{r.message}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[8px] text-white/30">
                    <span>{r.price_credits} CR</span>
                    <span>·</span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </PortalWorkspaceShell>
  );
}

function RequestRow({ req, actionLoading, onAccept, onDecline, onComplete }: {
  req: PaidRequest;
  actionLoading: string | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white/80">{req.subject}</span>
        <StatusBadge status={req.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-white/40">{req.message}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[8px] text-white/30">
        <span>{req.price_credits} CR</span>
        <span>·</span>
        <span>{req.request_type || 'General'}</span>
        <span>·</span>
        <span>{new Date(req.created_at).toLocaleDateString()}</span>
        {req.expires_at && req.status === 'PENDING' && <><span>·</span><span>Expires {new Date(req.expires_at).toLocaleDateString()}</span></>}
      </div>
      {req.status === 'PENDING' && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onDecline(req.id)} disabled={actionLoading === req.id}
            className="rounded-md border border-red-400/20 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-red-400/60 transition hover:bg-red-400/10">Decline</button>
          <button onClick={() => onAccept(req.id)} disabled={actionLoading === req.id}
            className="rounded-md border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition disabled:opacity-40" style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}>
            {actionLoading === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept'}
          </button>
        </div>
      )}
      {req.status === 'ACTIVE' && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onDecline(req.id)} disabled={actionLoading === req.id}
            className="rounded-md border border-red-400/20 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-red-400/60 transition hover:bg-red-400/10">Decline / Refund</button>
          <button onClick={() => onComplete(req.id)} disabled={actionLoading === req.id}
            className="rounded-md border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition disabled:opacity-40" style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}>
            {actionLoading === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Complete Request'}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-400/15 text-amber-400/70 border-amber-400/20',
    ACTIVE: 'bg-emerald-400/15 text-emerald-400/70 border-emerald-400/20',
    COMPLETED: 'bg-white/5 text-white/40 border-white/10',
    DECLINED: 'bg-red-400/10 text-red-400/50 border-red-400/15',
    EXPIRED: 'bg-red-400/10 text-red-400/50 border-red-400/15',
    REFUNDED: 'bg-red-400/10 text-red-400/50 border-red-400/15',
    DISPUTED: 'bg-orange-400/15 text-orange-400/70 border-orange-400/20',
  };
  const cls = colors[status] ?? colors.COMPLETED;
  return <span className={`rounded border px-1.5 py-0 text-[7px] font-bold tracking-wider uppercase ${cls}`}>{status}</span>;
}

function MiniMetric({ icon: Icon, label, value, suffix }: { icon: typeof Inbox; label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <Icon className="mb-2 h-4 w-4 text-white/30" strokeWidth={1.5} />
      <div className="text-lg font-bold text-white">{value}{suffix && <span className="ml-1 text-[10px] text-white/40">{suffix}</span>}</div>
      <div className="text-[8px] font-bold tracking-widest uppercase text-white/30">{label}</div>
    </div>
  );
}
