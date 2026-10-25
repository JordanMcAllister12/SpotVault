import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, Trash2, Star, Users, DollarSign, TrendingUp,
  MessageCircle, Check, X, Sparkles,
} from 'lucide-react';
import {
  fetchCreatorSubscription, upsertCreatorSubscription, setSubscriptionActive,
  fetchBenefits, addBenefit, deleteBenefit,
  fetchQAConfig, upsertQAConfig,
  fetchCreatorSubscribers, fetchSubscriberCount, fetchQaThreadsForCreator,
  type CreatorSubscription, type SubscriptionBenefit, type SubscriptionQAConfig,
  type SubscriberRecord, type QAThread, type BenefitType, type DeliveryType,
  BENEFIT_TYPE_LABELS, DELIVERY_TYPE_LABELS, QA_QUESTIONS_OPTIONS, QA_FOLLOWUPS_OPTIONS, RESPONSE_WINDOW_OPTIONS,
} from '@/lib/monetizationStore';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  creatorUserId: string;
  creatorName: string;
}

type Tab = 'overview' | 'setup' | 'benefits' | 'qa' | 'subscribers';

export function SubscriptionsPanel({ creatorUserId, creatorName }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [subscription, setSubscription] = useState<CreatorSubscription | null>(null);
  const [benefits, setBenefits] = useState<SubscriptionBenefit[]>([]);
  const [qaConfig, setQaConfig] = useState<SubscriptionQAConfig | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>([]);
  const [qaThreads, setQaThreads] = useState<QAThread[]>([]);
  const [subCount, setSubCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(100);
  const [isActive, setIsActive] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');

  // Benefit form
  const [showBenefitForm, setShowBenefitForm] = useState(false);
  const [benefitTitle, setBenefitTitle] = useState('');
  const [benefitDesc, setBenefitDesc] = useState('');
  const [benefitType, setBenefitType] = useState<BenefitType>('CONTENT');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('INCLUDED');

  // QA config form
  const [questionsPerMonth, setQuestionsPerMonth] = useState(0);
  const [followUpsPerQuestion, setFollowUpsPerQuestion] = useState(0);
  const [responseTarget, setResponseTarget] = useState(48);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [sub, subs, count, threads] = await Promise.all([
      fetchCreatorSubscription(creatorUserId),
      fetchCreatorSubscribers(creatorUserId),
      fetchSubscriberCount(creatorUserId),
      fetchQaThreadsForCreator(creatorUserId),
    ]);
    setSubscription(sub);
    setSubscribers(subs);
    setSubCount(count);
    setQaThreads(threads);
    if (sub) {
      const [bens, qa] = await Promise.all([fetchBenefits(sub.id), fetchQAConfig(sub.id)]);
      setBenefits(bens);
      setQaConfig(qa);
      setName(sub.name);
      setDescription(sub.description ?? '');
      setPrice(sub.price_credits);
      setIsActive(sub.is_active);
      setBannerUrl(sub.banner_url ?? '');
      if (qa) {
        setQuestionsPerMonth(qa.questions_per_month);
        setFollowUpsPerQuestion(qa.follow_ups_per_question);
        setResponseTarget(qa.response_target_hours);
      }
    }
    setLoading(false);
  }, [creatorUserId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function handleSaveSetup() {
    setSaving(true);
    const saved = await upsertCreatorSubscription(creatorUserId, {
      name: name || `${creatorName} — Inner Circle`,
      description: description || undefined,
      price_credits: price,
      banner_url: bannerUrl || undefined,
      is_active: isActive,
    });
    if (saved) {
      setSubscription(saved);
      setSaveMsg('Subscription saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setSaving(false);
  }

  async function handleToggleActive() {
    if (!subscription) return;
    const newVal = !subscription.is_active;
    setIsActive(newVal);
    await setSubscriptionActive(subscription.id, newVal);
    setSubscription({ ...subscription, is_active: newVal });
  }

  async function handleAddBenefit() {
    if (!subscription || !benefitTitle.trim()) return;
    const ben = await addBenefit(subscription.id, {
      title: benefitTitle,
      description: benefitDesc || undefined,
      benefit_type: benefitType,
      delivery_type: deliveryType,
    });
    if (ben) {
      setBenefits((prev) => [...prev, ben]);
      setBenefitTitle('');
      setBenefitDesc('');
      setShowBenefitForm(false);
    }
  }

  async function handleDeleteBenefit(id: string) {
    await deleteBenefit(id);
    setBenefits((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleSaveQA() {
    if (!subscription) return;
    setSaving(true);
    const saved = await upsertQAConfig(subscription.id, {
      questions_per_month: questionsPerMonth,
      follow_ups_per_question: followUpsPerQuestion,
      response_target_hours: responseTarget,
    });
    if (saved) {
      setQaConfig(saved);
      setSaveMsg('Q&A settings saved');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setSaving(false);
  }

  const activeSubs = subscribers.filter((s) => s.status === 'ACTIVE');
  const newThisMonth = activeSubs.filter((s) => {
    const d = new Date(s.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const cancelled = subscribers.filter((s) => s.status === 'CANCELLED' || s.cancel_at_period_end);
  const openQaThreads = qaThreads.filter((t) => t.status === 'OPEN');
  const mrr = activeSubs.length * (subscription?.price_credits ?? 0);

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'setup', label: 'Setup', icon: Star },
    { id: 'benefits', label: 'Benefits', icon: Sparkles },
    { id: 'qa', label: 'Q&A', icon: MessageCircle },
    { id: 'subscribers', label: 'Subscribers', icon: Users },
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
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.08)' }}>
          <Star className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-white">Subscriptions</h1>
          <p className="text-[10px] text-white/40">Build recurring monthly revenue from your audience</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-0.5 border-b border-white/[0.04] pb-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
            style={tab === t.id ? { background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT } : { color: 'rgba(255,255,255,0.3)' }}
          >
            <t.icon className="h-3 w-3" strokeWidth={1.5} />
            {t.label}
            {t.id === 'qa' && openQaThreads.length > 0 && (
              <span className="ml-0.5 rounded-full bg-amber-400/20 px-1.5 text-[8px] text-amber-400">{openQaThreads.length}</span>
            )}
          </button>
        ))}
      </div>

      {saveMsg && (
        <div className="mb-4 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-[11px] text-emerald-300">{saveMsg}</div>
      )}

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={Users} label="Active" value={subCount.toString()} />
            <MetricCard icon={DollarSign} label="MRR" value={mrr.toLocaleString()} suffix=" CR" />
            <MetricCard icon={TrendingUp} label="New This Month" value={`+${newThisMonth.length}`} />
            <MetricCard icon={X} label="Cancelled" value={cancelled.length.toString()} />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-white/40">Q&A Waiting</span>
            </div>
            <p className="text-2xl font-bold text-white">{openQaThreads.length}</p>
            <p className="mt-1 text-[10px] text-white/30">{openQaThreads.length === 0 ? 'No questions waiting' : 'Questions awaiting response'}</p>
          </div>
          {!subscription && (
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4">
              <p className="text-[11px] text-amber-300/70">No subscription configured yet. Go to the Setup tab to create your offering.</p>
            </div>
          )}
          {subscription && !subscription.is_active && (
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4">
              <p className="text-[11px] text-amber-300/70">Your subscription is not live. Toggle it active in the Setup tab to start accepting subscribers.</p>
            </div>
          )}
        </div>
      )}

      {/* SETUP */}
      {tab === 'setup' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div>
              <p className="text-[11px] font-semibold text-white/80">Enable Subscriptions</p>
              <p className="mt-0.5 text-[10px] text-white/40">Turn on to accept subscribers</p>
            </div>
            <button onClick={() => void handleToggleActive()}
              className="relative h-6 w-11 rounded-full border transition-colors"
              style={{ borderColor: isActive ? 'rgba(212,165,44,0.3)' : 'rgba(255,255,255,0.1)', background: isActive ? 'rgba(212,165,44,0.15)' : 'rgba(255,255,255,0.03)' }}
            >
              <div className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ left: isActive ? '26px' : '3px', background: isActive ? GOLD : 'rgba(255,255,255,0.3)' }} />
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Subscription Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${creatorName} — Inner Circle`}
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Monthly Price (Credits)</label>
            <input type="number" value={price} onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none focus:border-[#c0911e]/30" />
            <p className="mt-1 text-[9px] text-white/30">1 credit = $0.10 USD. {price} credits = ${(price / 10).toFixed(2)}/month</p>
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Short Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Get exclusive poker content, hands, subscriber Q&As, promotions and opportunities to interact directly."
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
          </div>

          <div>
            <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Banner Image URL (optional)</label>
            <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..."
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
          </div>

          <button onClick={() => void handleSaveSetup()} disabled={saving}
            className="w-full rounded-lg border py-2.5 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
            style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Subscription'}
          </button>
        </div>
      )}

      {/* BENEFITS */}
      {tab === 'benefits' && (
        <div className="space-y-4">
          {benefits.length > 0 && (
            <div className="space-y-2">
              {benefits.map((b) => (
                <div key={b.id} className="flex items-start gap-3 rounded-lg border border-white/[0.04] p-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-white/80">{b.title}</div>
                    {b.description && <p className="mt-0.5 text-[10px] text-white/40">{b.description}</p>}
                    <div className="mt-1 flex gap-1.5">
                      <span className="rounded px-1.5 py-0.5 text-[7px] font-bold tracking-wider uppercase" style={{ background: 'rgba(212,165,44,0.08)', color: GOLD_SOFT }}>{BENEFIT_TYPE_LABELS[b.benefit_type]}</span>
                      <span className="rounded px-1.5 py-0.5 text-[7px] font-bold tracking-wider uppercase text-white/40" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>{DELIVERY_TYPE_LABELS[b.delivery_type]}</span>
                    </div>
                  </div>
                  <button onClick={() => void handleDeleteBenefit(b.id)} className="text-white/20 hover:text-red-400/60">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showBenefitForm ? (
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Title</label>
                <input value={benefitTitle} onChange={(e) => setBenefitTitle(e.target.value)} placeholder="Exclusive Hand Breakdowns"
                  className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Description</label>
                <input value={benefitDesc} onChange={(e) => setBenefitDesc(e.target.value)} placeholder="I'll regularly share selected hands and explain my thought process."
                  className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Type</label>
                  <select value={benefitType} onChange={(e) => setBenefitType(e.target.value as BenefitType)}
                    className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/30">
                    {Object.entries(BENEFIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-bold tracking-widest uppercase text-white/40">Delivery</label>
                  <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                    className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-white outline-none focus:border-[#c0911e]/30">
                    {Object.entries(DELIVERY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowBenefitForm(false)} className="flex-1 rounded-lg border border-white/[0.08] py-2 text-[10px] font-bold tracking-widest uppercase text-white/40">Cancel</button>
                <button onClick={() => void handleAddBenefit()} disabled={!benefitTitle.trim()} className="flex-1 rounded-lg border py-2 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40" style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}>Add Benefit</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowBenefitForm(true)} disabled={!subscription}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] py-3 text-[10px] font-bold tracking-widest uppercase text-white/40 transition hover:border-white/[0.15] hover:text-white/60 disabled:opacity-30">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Add Benefit
            </button>
          )}

          {!subscription && <p className="text-center text-[10px] text-white/30">Save your subscription setup first.</p>}
        </div>
      )}

      {/* QA */}
      {tab === 'qa' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="mb-3 text-[10px] leading-relaxed text-white/40">Configure guaranteed Q&A as a subscription benefit. Track questions, follow-ups, and response targets.</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[9px] font-bold tracking-widest uppercase text-white/40">Questions Included Per Month</label>
                <div className="flex flex-wrap gap-2">
                  {QA_QUESTIONS_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setQuestionsPerMonth(opt.value)}
                      className="rounded-lg border px-3 py-2 text-[10px] font-bold transition-all"
                      style={questionsPerMonth === opt.value ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT } : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-bold tracking-widest uppercase text-white/40">Follow-Ups Per Question</label>
                <div className="flex flex-wrap gap-2">
                  {QA_FOLLOWUPS_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setFollowUpsPerQuestion(opt.value)}
                      className="rounded-lg border px-3 py-2 text-[10px] font-bold transition-all"
                      style={followUpsPerQuestion === opt.value ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT } : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-bold tracking-widest uppercase text-white/40">Response Target</label>
                <div className="flex flex-wrap gap-2">
                  {RESPONSE_WINDOW_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setResponseTarget(opt.value)}
                      className="rounded-lg border px-3 py-2 text-[10px] font-bold transition-all"
                      style={responseTarget === opt.value ? { borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.06)', color: GOLD_SOFT } : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => void handleSaveQA()} disabled={saving || !subscription}
            className="w-full rounded-lg border py-2.5 text-[10px] font-bold tracking-widest uppercase transition disabled:opacity-40"
            style={{ borderColor: BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Q&A Settings'}
          </button>

          {openQaThreads.length > 0 && (
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4">
              <p className="mb-2 text-[10px] font-bold tracking-widest uppercase text-amber-400/60">Questions Waiting</p>
              <div className="space-y-2">
                {openQaThreads.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-[11px] text-white/60">
                    <MessageCircle className="h-3 w-3 text-amber-400/40" strokeWidth={1.5} />
                    <span className="truncate">{t.subject || 'Untitled question'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBSCRIBERS */}
      {tab === 'subscribers' && (
        <div className="space-y-3">
          {activeSubs.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-6 w-6 text-white/20" strokeWidth={1.5} />
              <p className="mt-2 text-[11px] text-white/30">No active subscribers yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activeSubs.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] px-3 py-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-bold text-white/50">
                    <Users className="h-3 w-3" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold text-white/80">{s.subscriber_user_id.slice(0, 8)}…</span>
                    <div className="text-[8px] text-white/30">
                      Renews {new Date(s.billing_period_end).toLocaleDateString()}
                      {s.cancel_at_period_end && ' · CANCELLED'}
                    </div>
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

function MetricCard({ icon: Icon, label, value, suffix }: { icon: typeof Users; label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <Icon className="mb-2 h-4 w-4 text-white/30" strokeWidth={1.5} />
      <div className="text-lg font-bold text-white">{value}{suffix && <span className="ml-1 text-[10px] text-white/40">{suffix}</span>}</div>
      <div className="text-[8px] font-bold tracking-widest uppercase text-white/30">{label}</div>
    </div>
  );
}
