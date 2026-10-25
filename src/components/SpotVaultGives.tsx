import { useState } from 'react';
import {
  X, Heart, ArrowRight, Sparkles, GraduationCap, Users,
  HelpCircle, Lock, Check, FileText, BookOpen, Award, ChevronRight,
  HandHeart, ShieldCheck, Building2, type LucideIcon,
} from 'lucide-react';
import {
  type GivesCategory, type ContributionPrivacy, type Contribution,
  GIVES_CATEGORIES, CONTRIBUTION_AMOUNTS, MONTHLY_IMPACT,
  ALL_TIME_CREDITS, CATEGORY_IMPACT, TRANSPARENCY_ALLOCATIONS,
  NEXT_CHAPTER_FUND, COMMUNITY_STORIES, DEMO_SPONSOR_MATCH,
  FUND_BALANCES, CONTRIBUTOR_BADGES,
} from '@/data/spotVaultGives';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212, 165, 44, 0.18)';

// ===== WIDGET (for Community right column) =====

interface WidgetProps {
  onContribute: () => void;
  onSeeImpact: () => void;
}

export function SpotVaultGivesWidget({ onContribute, onSeeImpact }: WidgetProps) {
  return (
    <div
      className="p-4"
      style={{
        background: 'rgba(8, 9, 10, 0.72)',
        border: `1px solid ${BORDER}`,
        borderRadius: '12px',
        boxShadow: '0 8px 32px -12px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'rgba(212,165,44,0.12)', border: `1px solid ${BORDER}` }}
        >
          <Heart className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-[0.15em] text-white">SPOTVAULT GIVES</div>
          <div className="text-[8px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Community Impact</div>
        </div>
      </div>

      <div className="space-y-2">
        <ImpactStat label="Credits Contributed" value={MONTHLY_IMPACT.totalCredits.toLocaleString()} />
        <div className="grid grid-cols-3 gap-1.5">
          <MiniStat value={String(MONTHLY_IMPACT.wellnessSessions)} label="Sessions" />
          <MiniStat value={`$${MONTHLY_IMPACT.educationCredits.toLocaleString()}`} label="Education" />
          <MiniStat value={String(MONTHLY_IMPACT.communityProjects)} label="Projects" />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onContribute}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[9px] font-bold tracking-[0.15em] uppercase transition-all hover:bg-[#c0911e]/20"
          style={{ borderColor: `${GOLD}50`, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
        >
          <Heart className="h-3 w-3" strokeWidth={1.5} /> Contribute
        </button>
        <button
          onClick={onSeeImpact}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-[9px] font-bold tracking-[0.15em] text-white/60 uppercase transition-all hover:text-white/90"
        >
          See Impact <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
      <div className="text-[8px] font-mono tracking-[0.2em] text-white/30 uppercase">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5 text-center">
      <div className="text-xs font-bold" style={{ color: GOLD }}>{value}</div>
      <div className="text-[7px] font-mono tracking-widest text-white/30 uppercase">{label}</div>
    </div>
  );
}

// ===== CONTRIBUTE MODAL =====

interface ContributeModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (contribution: Contribution) => void;
}

export function ContributeModal({ open, onClose, onComplete }: ContributeModalProps) {
  const [step, setStep] = useState<'amount' | 'category' | 'privacy'>('amount');
  const [amount, setAmount] = useState<number>(250);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [useCustom, setUseCustom] = useState(false);
  const [category, setCategory] = useState<GivesCategory | null>(null);
  const [privacy, setPrivacy] = useState<ContributionPrivacy | null>(null);

  if (!open) return null;

  const finalAmount = useCustom ? parseInt(customAmount) || 0 : amount;

  const reset = () => {
    setStep('amount');
    setAmount(250);
    setCustomAmount('');
    setUseCustom(false);
    setCategory(null);
    setPrivacy(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleComplete = () => {
    if (!category || !privacy) return;
    onComplete({
      id: `gives-${Date.now()}`,
      contributorName: 'You',
      amount: finalAmount,
      category,
      privacy,
      timestamp: new Date().toISOString(),
    });
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#050608]/80 backdrop-blur-sm">
      <div
        className="relative w-[520px] max-w-[94vw] rounded-2xl p-7"
        style={{
          background: 'rgba(8, 9, 10, 0.92)',
          border: `1px solid ${BORDER}`,
          boxShadow: '0 24px 80px -20px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg border border-white/10 bg-white/5 p-2 text-white/40 transition-all hover:text-white/80"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
          <h2 className="text-base font-bold tracking-tight text-white">Contribute to SpotVault Gives</h2>
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-2">
          {(['amount', 'category', 'privacy'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  background: step === s ? 'rgba(212,165,44,0.2)' : 'rgba(255,255,255,0.05)',
                  color: step === s ? GOLD : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${step === s ? BORDER : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {i + 1}
              </div>
              {i < 2 && <div className="h-px w-8" style={{ background: 'rgba(255,255,255,0.08)' }} />}
            </div>
          ))}
        </div>

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <div className="mt-5">
            <p className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">Choose Amount</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CONTRIBUTION_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setAmount(amt); setUseCustom(false); }}
                  className="rounded-lg border py-3 text-sm font-bold transition-all"
                  style={{
                    borderColor: !useCustom && amount === amt ? BORDER : 'rgba(255,255,255,0.08)',
                    background: !useCustom && amount === amt ? 'rgba(212,165,44,0.1)' : 'rgba(255,255,255,0.03)',
                    color: !useCustom && amount === amt ? GOLD_SOFT : 'rgba(255,255,255,0.6)',
                  }}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>

            <button
              onClick={() => setUseCustom(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-left transition-all"
              style={{
                borderColor: useCustom ? BORDER : 'rgba(255,255,255,0.08)',
                background: useCustom ? 'rgba(212,165,44,0.1)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase">Custom</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/20"
                style={{ color: useCustom ? GOLD_SOFT : 'rgba(255,255,255,0.6)' }}
                autoFocus={useCustom}
              />
              <span className="text-[10px] text-white/30">credits</span>
            </button>

            <button
              onClick={() => setStep('category')}
              disabled={useCustom ? !customAmount || parseInt(customAmount) < 1 : false}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[10px] font-bold tracking-[0.2em] uppercase transition-all hover:bg-[#c0911e]/20 disabled:opacity-30"
              style={{ borderColor: `${GOLD}50`, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Step 2: Category */}
        {step === 'category' && (
          <div className="mt-5">
            <p className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">Direct Your Contribution</p>
            <div className="mt-3 space-y-2">
              {GIVES_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all"
                  style={{
                    borderColor: category === cat.id ? `${cat.accent}40` : 'rgba(255,255,255,0.08)',
                    background: category === cat.id ? `${cat.accent}10` : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <CategoryIcon categoryId={cat.id} accent={cat.accent} />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white">{cat.label}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-white/40">{cat.description}</div>
                  </div>
                  {category === cat.id && (
                    <Check className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: cat.accent }} />
                  )}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
              <Lock className="h-3 w-3 text-white/25" strokeWidth={1.5} />
              <p className="text-[9px] text-white/30">
                Funds do not automatically move between categories. Each category is tracked separately.
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setStep('amount')}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase transition-all hover:text-white/80"
              >
                Back
              </button>
              <button
                onClick={() => setStep('privacy')}
                disabled={!category}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-[10px] font-bold tracking-[0.2em] uppercase transition-all hover:bg-[#c0911e]/20 disabled:opacity-30"
                style={{ borderColor: `${GOLD}50`, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
              >
                Continue <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Privacy */}
        {step === 'privacy' && (
          <div className="mt-5">
            <p className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">Show Your Contribution?</p>
            <div className="mt-3 space-y-2">
              <PrivacyOption
                icon={Users}
                label="Yes — Show My Name"
                description="Your name appears with the contribution in the community feed."
                selected={privacy === 'public'}
                onClick={() => setPrivacy('public')}
              />
              <PrivacyOption
                icon={Heart}
                label="Yes — Anonymous"
                description="Your contribution appears as 'A community member' in the feed."
                selected={privacy === 'anonymous'}
                onClick={() => setPrivacy('anonymous')}
              />
              <PrivacyOption
                icon={Lock}
                label="No — Keep Private"
                description="Your contribution will not appear anywhere publicly."
                selected={privacy === 'private'}
                onClick={() => setPrivacy('private')}
              />
            </div>

            {/* Summary */}
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Amount</span>
                <span className="text-sm font-bold" style={{ color: GOLD }}>{finalAmount.toLocaleString()} credits</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Category</span>
                <span className="text-xs font-semibold text-white">
                  {GIVES_CATEGORIES.find((c) => c.id === category)?.label}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setStep('category')}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 py-3 text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase transition-all hover:text-white/80"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={!privacy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-[10px] font-bold tracking-[0.2em] uppercase transition-all hover:bg-[#c0911e]/20 disabled:opacity-30"
                style={{ borderColor: `${GOLD}50`, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
              >
                <Heart className="h-3.5 w-3.5" strokeWidth={1.5} /> Confirm Contribution
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-[9px] font-mono tracking-[0.3em] text-white/15 uppercase">
          Demo Only · No Credits Are Actually Transferred
        </div>
      </div>
    </div>
  );
}

function PrivacyOption({
  icon: Icon, label, description, selected, onClick,
}: {
  icon: LucideIcon; label: string; description: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all"
      style={{
        borderColor: selected ? BORDER : 'rgba(255,255,255,0.08)',
        background: selected ? 'rgba(212,165,44,0.08)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <Icon
        className="h-4 w-4 shrink-0 mt-0.5"
        strokeWidth={1.5}
        style={{ color: selected ? GOLD : 'rgba(255,255,255,0.3)' }}
      />
      <div className="flex-1">
        <div className="text-xs font-bold" style={{ color: selected ? GOLD_SOFT : 'rgba(255,255,255,0.8)' }}>{label}</div>
        <div className="mt-0.5 text-[10px] leading-relaxed text-white/40">{description}</div>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: GOLD }} />}
    </button>
  );
}

function CategoryIcon({ categoryId, accent }: { categoryId: GivesCategory; accent: string }) {
  const icons: Record<GivesCategory, LucideIcon> = {
    wellness: Heart,
    education: GraduationCap,
    community: Users,
    'where-needed': HelpCircle,
  };
  const Icon = icons[categoryId];
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} style={{ color: accent }} />
    </div>
  );
}

// ===== IMPACT CENTER MODAL =====

interface ImpactModalProps {
  open: boolean;
  onClose: () => void;
  onContribute: () => void;
}

export function ImpactCenterModal({ open, onClose, onContribute }: ImpactModalProps) {
  const [showTransparency, setShowTransparency] = useState(false);
  const [showNextChapter, setShowNextChapter] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#050608]/80 backdrop-blur-sm">
      <div
        className="relative max-h-[90vh] w-[680px] max-w-[94vw] overflow-y-auto rounded-2xl p-7"
        style={{
          background: 'rgba(8, 9, 10, 0.92)',
          border: `1px solid ${BORDER}`,
          boxShadow: '0 24px 80px -20px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg border border-white/10 bg-white/5 p-2 text-white/40 transition-all hover:text-white/80"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'rgba(212,165,44,0.12)', border: `1px solid ${BORDER}` }}
          >
            <Heart className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">SpotVault Gives</h2>
            <p className="text-[10px] font-mono tracking-[0.2em] text-[#c0911e]/60 uppercase">Community Impact</p>
          </div>
        </div>

        {/* This Month + All Time */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <span className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase">This Month</span>
            <div className="mt-1 text-xl font-bold text-white">{MONTHLY_IMPACT.totalCredits.toLocaleString()}</div>
            <div className="text-[10px] text-white/40">Credits Contributed</div>
          </div>
          <div className="rounded-xl border border-[#a8c4b8]/10 bg-[#a8c4b8]/[0.04] p-4">
            <span className="text-[9px] font-mono tracking-[0.2em] text-[#a8c4b8]/60 uppercase">All Time</span>
            <div className="mt-1 text-xl font-bold" style={{ color: '#a8c4b8' }}>{ALL_TIME_CREDITS.toLocaleString()}</div>
            <div className="text-[10px] text-white/40">Credits Contributed</div>
          </div>
        </div>

        {/* Category Impact */}
        <div className="mt-5">
          <h3 className="text-xs font-bold text-white">Impact by Category</h3>
          <div className="mt-3 space-y-3">
            {CATEGORY_IMPACT.map((cat) => {
              const config = GIVES_CATEGORIES.find((c) => c.id === cat.categoryId)!;
              return (
                <div key={cat.categoryId} className="rounded-xl border border-white/[0.06] bg-black/25 p-4">
                  <div className="flex items-center gap-2">
                    <CategoryIcon categoryId={cat.categoryId} accent={config.accent} />
                    <span className="text-xs font-bold text-white">{config.label}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cat.stats.map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                        <div className="text-sm font-bold" style={{ color: config.accent }}>{stat.value}</div>
                        <div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Chapter Fund */}
        <div className="mt-5 rounded-xl border p-4" style={{ borderColor: `${GOLD}25`, background: 'rgba(212,165,44,0.05)' }}>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
            <span className="text-xs font-bold text-white">{NEXT_CHAPTER_FUND.title}</span>
          </div>
          <p className="mt-0.5 text-[10px] font-mono tracking-widest text-[#c0911e]/60 uppercase">{NEXT_CHAPTER_FUND.subtitle}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">{NEXT_CHAPTER_FUND.description}</p>

          {showNextChapter && (
            <div className="mt-3">
              <div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Eligible Uses</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {NEXT_CHAPTER_FUND.eligibleUses.map((use) => (
                  <span key={use} className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-white/50">{use}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowNextChapter(!showNextChapter)}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-bold tracking-widest text-white/50 uppercase transition-all hover:text-white/80"
            >
              {showNextChapter ? 'Hide' : 'Learn More'}
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border px-3 py-2 text-[9px] font-bold tracking-widest uppercase transition-all"
              style={{ borderColor: `${GOLD}40`, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
            >
              <Lock className="h-3 w-3" strokeWidth={1.5} /> Apply Privately
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[9px] text-white/25">
            <Lock className="h-2.5 w-2.5" strokeWidth={1.5} /> Applications are private. Nothing appears publicly unless you choose to share.
          </p>
        </div>

        {/* Transparency */}
        <div className="mt-5">
          <h3 className="text-xs font-bold text-white">Where the Support Went</h3>
          <div className="mt-3 space-y-2">
            {TRANSPARENCY_ALLOCATIONS.map((alloc) => (
              <div key={alloc.category}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/60">{alloc.category}</span>
                  <span className="text-[11px] font-bold text-white">{alloc.percentage}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full" style={{ width: `${alloc.percentage}%`, background: alloc.color }} />
                </div>
              </div>
            ))}
          </div>

          {showTransparency && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/25 p-4">
              <div className="grid grid-cols-2 gap-3">
                <TransparencyRow label="Credits Contributed" value={ALL_TIME_CREDITS.toLocaleString()} />
                <TransparencyRow label="Funds Allocated" value="1,192,800" />
                <TransparencyRow label="Program Expenses" value="847,200" />
                <TransparencyRow label="Unused Balances" value="91,700" />
              </div>
              <div className="mt-3 space-y-1.5">
                {FUND_BALANCES.map((fund) => (
                  <div key={fund.categoryId} className="flex items-center justify-between text-[10px]">
                    <span className="text-white/40">{fund.label} Balance</span>
                    <span className="font-mono font-semibold text-white/70">{fund.balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowTransparency(!showTransparency)}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-bold tracking-widest text-white/50 uppercase transition-all hover:text-white/80"
          >
            <FileText className="h-3 w-3" strokeWidth={1.5} />
            {showTransparency ? 'Hide' : 'View'} Transparency Report
          </button>
        </div>

        {/* Community Stories */}
        <div className="mt-5">
          <h3 className="text-xs font-bold text-white">Community Stories</h3>
          <p className="mt-0.5 text-[10px] text-white/30">Optional stories from recipients who chose to share.</p>
          <div className="mt-3 space-y-2">
            {COMMUNITY_STORIES.map((story) => (
              <div key={story.id} className="rounded-xl border border-white/[0.06] bg-black/25 p-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
                  <span className="text-xs font-bold text-white">{story.title}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{story.excerpt}</p>
                <button className="mt-2 flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD }}>
                  Read Story <ChevronRight className="h-2.5 w-2.5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sponsor Matching */}
        <div className="mt-5 rounded-xl border border-[#7a9b8e]/15 bg-[#7a9b8e]/[0.04] p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" strokeWidth={1.5} style={{ color: '#7a9b8e' }} />
            <span className="text-xs font-bold text-white">Community Match Week</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[8px] font-bold tracking-widest text-white/30 uppercase">Community Match Week</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-white">{DEMO_SPONSOR_MATCH.communityContributions.toLocaleString()}</div>
              <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Community</div>
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: '#7a9b8e' }}>{DEMO_SPONSOR_MATCH.matchedBy}</div>
              <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Matched By</div>
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: GOLD }}>{DEMO_SPONSOR_MATCH.totalImpact.toLocaleString()}</div>
              <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Total Impact</div>
            </div>
          </div>
        </div>

        {/* Contributor Badge */}
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/25 p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
            <span className="text-xs font-bold text-white">Contributor Recognition</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONTRIBUTOR_BADGES.map((badge) => (
              <div key={badge.id} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.06)' }}>
                <Sparkles className="h-3 w-3" strokeWidth={1.5} style={{ color: GOLD }} />
                <span className="text-[10px] font-semibold" style={{ color: GOLD_SOFT }}>{badge.label}</span>
                <span className="text-[8px] text-white/30">{badge.threshold.toLocaleString()}+ credits</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-white/25">No leaderboards. No rankings. Recognition stays tasteful.</p>
        </div>

        {/* Contribute button */}
        <button
          onClick={onContribute}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[10px] font-bold tracking-[0.2em] uppercase transition-all hover:bg-[#c0911e]/20"
          style={{ borderColor: `${GOLD}50`, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
        >
          <Heart className="h-4 w-4" strokeWidth={1.5} /> Contribute
        </button>

        <div className="mt-3 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-white/20" strokeWidth={1.5} />
          <p className="text-[9px] text-white/25">Recipient identities are never revealed. Only contributions and aggregate impact are public.</p>
        </div>
      </div>
    </div>
  );
}

function TransparencyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

// ===== FEED EVENT (for community feed) =====

export function GivesFeedEvent({ contribution }: { contribution: Contribution }) {
  if (contribution.privacy === 'private') return null;

  const config = GIVES_CATEGORIES.find((c) => c.id === contribution.category)!;
  const displayName = contribution.privacy === 'anonymous' ? 'A community member' : contribution.contributorName;

  return (
    <div
      className="p-4"
      style={{
        background: 'rgba(8, 9, 10, 0.72)',
        border: `1px solid ${BORDER}`,
        borderRadius: '12px',
        boxShadow: '0 8px 32px -12px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'rgba(212,165,44,0.12)', border: `1px solid ${BORDER}` }}
        >
          <Heart className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
        </div>
        <span className="text-[10px] font-bold tracking-[0.15em] text-white">SPOTVAULT GIVES</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/70">
        <span className="font-semibold text-white">{displayName}</span> contributed{' '}
        <span className="font-bold" style={{ color: GOLD }}>{contribution.amount.toLocaleString()} Credits</span>
      </p>
      <p className="mt-0.5 text-[10px] text-white/40">
        Supporting {config.label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-medium text-white/50 transition-all hover:text-white/80">
          <Heart className="h-3 w-3" strokeWidth={1.5} /> Support
        </button>
      </div>
    </div>
  );
}

// ===== HELP HUB — Community Support Section =====

export function HelpHubCommunitySupport() {
  return (
    <div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(212,165,44,0.04)' }}>
      <div className="flex items-center gap-2">
        <HandHeart className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
        <span className="text-xs font-bold text-white">Community Support May Be Available</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/50">
        SpotVault Gives may subsidize eligible support services for members of our community.
        Some wellness programs may receive support through the SpotVault Community Fund.
      </p>
      <button
        className="mt-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[9px] font-bold tracking-widest uppercase transition-all"
        style={{ borderColor: `${GOLD}40`, background: 'rgba(212,165,44,0.1)', color: GOLD_SOFT }}
      >
        <ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Check Eligibility
      </button>
      <p className="mt-2 flex items-center gap-1 text-[9px] text-white/25">
        <Lock className="h-2.5 w-2.5" strokeWidth={1.5} /> Donor identities are never shown here. Your interest is completely private.
      </p>
    </div>
  );
}
