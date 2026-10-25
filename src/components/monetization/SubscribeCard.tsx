import { useState, useEffect } from 'react';
import {
  Star, Check, Loader2, Zap, X, MessageSquare,
} from 'lucide-react';
import {
  fetchCreatorSubscription, fetchBenefits, fetchSubscriberCount,
  subscribeToCreator, checkSubscriptionActive, getCreditBalance,
  cancelSubscription,
  fetchPaidRequestSettings, createPaidRequest,
  type CreatorSubscription, type SubscriptionBenefit,
  type PaidRequestSettings,
  PAID_REQUEST_LABELS,
} from '@/lib/monetizationStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  creatorUserId: string;
  creatorName: string;
  currentUserId: string;
  portalType: 'creator' | 'coach' | 'media' | 'business';
}

export function SubscribeCard({ creatorUserId, creatorName, currentUserId, portalType }: Props) {
  const [subscription, setSubscription] = useState<CreatorSubscription | null>(null);
  const [benefits, setBenefits] = useState<SubscriptionBenefit[]>([]);
  const [subCount, setSubCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    void (async () => {
      const [sub, count, active] = await Promise.all([
        fetchCreatorSubscription(creatorUserId),
        fetchSubscriberCount(creatorUserId),
        checkSubscriptionActive(currentUserId, creatorUserId),
      ]);
      setSubscription(sub);
      setSubCount(count);
      setIsSubscribed(active);
      if (sub) {
        const bens = await fetchBenefits(sub.id);
        setBenefits(bens);
      }
      setLoading(false);
    })();
  }, [creatorUserId, currentUserId]);

  async function handleSubscribe() {
    if (!subscription) return;
    setActionLoading(true);
    setError('');
    const ok = await subscribeToCreator(currentUserId, subscription.id);
    if (ok) {
      setIsSubscribed(true);
      setSubCount((c) => c + 1);
    } else {
      setError('Insufficient credits or subscription inactive.');
    }
    setActionLoading(false);
  }

  async function handleCancel() {
    if (!subscription) return;
    setActionLoading(true);
    await cancelSubscription(currentUserId, subscription.id);
    setShowCancel(false);
    setActionLoading(false);
  }

  if (loading) return null;

  if (!subscription || !subscription.is_active) return null;

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.6)' }}>
      {subscription.banner_url && (
        <div className="mb-4 h-24 w-full overflow-hidden rounded-lg">
          <img src={subscription.banner_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Star className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <h3 className="text-[13px] font-bold text-white">{subscription.name}</h3>
      </div>

      {subscription.description && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">{subscription.description}</p>
      )}

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold" style={{ color: GOLD }}>{subscription.price_credits.toLocaleString()}</span>
        <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Credits / Month</span>
      </div>

      <p className="mt-1 text-[9px] text-white/30">{subCount.toLocaleString()} subscribers</p>

      {benefits.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[9px] font-bold tracking-widest uppercase text-white/40">What You Get</p>
          {benefits.map((b) => (
            <div key={b.id} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
              <div>
                <span className="text-[11px] text-white/70">{b.title}</span>
                {b.description && <p className="text-[9px] text-white/30">{b.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-[10px] text-red-400/70">{error}</p>}

      {isSubscribed ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] py-2.5 text-[10px] font-bold tracking-widest uppercase text-emerald-300">
            <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> Subscribed
          </div>
          {!showCancel ? (
            <button onClick={() => setShowCancel(true)} className="w-full text-center text-[9px] text-white/30 hover:text-white/50">Manage subscription</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowCancel(false)} className="flex-1 rounded-lg border border-white/[0.08] py-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Keep</button>
              <button onClick={() => void handleCancel()} disabled={actionLoading} className="flex-1 rounded-lg border border-red-400/20 py-2 text-[9px] font-bold tracking-widest uppercase text-red-400/60">
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => void handleSubscribe()} disabled={actionLoading}
          className="mt-4 w-full rounded-lg border py-3 text-[11px] font-bold tracking-widest uppercase transition disabled:opacity-40"
          style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.12)' }}>
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Subscribe — ${subscription.price_credits} CR/mo`}
        </button>
      )}
    </div>
  );
}

// ============================================================
// Paid Message CTA + Composer
// ============================================================

export function PaidMessageButton({ creatorUserId, currentUserId, portalType }: {
  creatorUserId: string;
  currentUserId: string;
  portalType: 'creator' | 'coach' | 'media' | 'business';
}) {
  const [settings, setSettings] = useState<PaidRequestSettings | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    void (async () => {
      const [s, bal] = await Promise.all([
        fetchPaidRequestSettings(creatorUserId),
        getCreditBalance(currentUserId),
      ]);
      setSettings(s);
      setBalance(bal);
    })();
  }, [creatorUserId, currentUserId]);

  if (!settings || !settings.is_enabled) return null;

  return (
    <>
      <button onClick={() => setShowComposer(true)}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
        style={{ borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT }}>
        <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
        Paid Message — {settings.price_credits} CR
      </button>
      {showComposer && (
        <PaidRequestComposer
          recipientId={creatorUserId}
          senderId={currentUserId}
          settings={settings}
          balance={balance}
          portalType={portalType}
          onClose={() => setShowComposer(false)}
          onSent={() => { setShowComposer(false); setBalance((b) => b - settings.price_credits); }}
        />
      )}
    </>
  );
}

function PaidRequestComposer({ recipientId, senderId, settings, balance, portalType, onClose, onSent }: {
  recipientId: string;
  senderId: string;
  settings: PaidRequestSettings;
  balance: number;
  portalType: 'creator' | 'coach' | 'media' | 'business';
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [requestType, setRequestType] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const labelOptions = settings.request_types?.length ? settings.request_types : (PAID_REQUEST_LABELS[portalType] ?? ['General Question']);
  const price = settings.price_credits;
  const balanceAfter = balance - price;

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return;
    if (balance < price) { setError('Insufficient credits.'); return; }
    setSending(true);
    setError('');
    const id = await createPaidRequest(senderId, recipientId, price, subject, message, requestType || labelOptions[0], settings.response_window_hours);
    setSending(false);
    if (id) {
      onSent();
    } else {
      setError('Failed to send. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border p-5" style={{ borderColor: BORDER, background: 'rgba(8,10,12,0.97)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h2 className="text-[13px] font-bold text-white">Paid Request</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="h-4 w-4" strokeWidth={1.5} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Request Type</label>
            <select value={requestType} onChange={(e) => setRequestType(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/30">
              <option value="">Select type…</option>
              {labelOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief subject…"
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Write your question or request…"
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/50">Price</span>
              <span className="font-bold text-white">{price} CR</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-white/50">Current Balance</span>
              <span className="text-white/70">{balance.toLocaleString()} CR</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] border-t border-white/[0.04] pt-1">
              <span className="text-white/50">Balance After</span>
              <span className="font-bold" style={{ color: balanceAfter >= 0 ? GOLD_SOFT : 'rgb(248,113,113)' }}>{balanceAfter.toLocaleString()} CR</span>
            </div>
          </div>

          {error && <p className="text-[10px] text-red-400/70">{error}</p>}

          <button onClick={() => void handleSend()} disabled={sending || !subject.trim() || !message.trim() || balance < price}
            className="w-full rounded-lg border py-2.5 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
            style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.12)' }}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Send Paid Request — ${price} CR`}
          </button>
          <p className="text-center text-[9px] text-white/30">Credits are held in escrow until accepted. Declined or expired requests are automatically refunded.</p>
        </div>
      </div>
    </div>
  );
}
