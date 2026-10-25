import { useState, useCallback, useEffect } from 'react';
import {
  Brain, TrendingUp, Target, Loader2, CheckCircle2, AlertTriangle,
  ChevronRight, ChevronDown, History, Zap, ArrowUp, ArrowDown, Minus, Lock,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type MembershipTier, tierHasAiCoach, hasCapability,
  TIER_DISPLAY, type Capability,
} from '@/lib/entitlements';

const GOLD = 'var(--portal-accent, #d4a52c)';
const GOLD_SOFT = 'var(--portal-accent-soft, #f5e6b0)';
const BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.18)';
const SHELL_BG = 'rgba(6, 8, 10, 0.55)';
const SHELL_BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.15)';

const MIN_HANDS = 5000;

type AnalysisArea = 'complete_game' | 'preflop' | 'postflop';
type AnalysisDepth = 'standard' | 'deep';

interface FocusArea {
  title: string;
  category: string;
  description: string;
  statKey: string;
  statValue: number;
  benchmark: string;
  priority: 'high' | 'medium';
  whyItMatters?: string;
  actionPlan?: string;
  confidence?: string;
  relatedMetrics?: string[];
}

interface ExampleHand {
  handId: string;
  handHash: string;
  position: string;
  potType: string;
  bbDeep: number;
  description: string;
}

interface ContextualOutlier {
  metric: string;
  explanation: string;
  actionRequired: boolean;
}

interface AiPriority {
  title: string;
  category: string;
  confidence: string;
  explanation: string;
  whyItMatters: string;
  relatedMetrics: string[];
  exampleHandIds: string[];
  actionPlan: string;
}

interface DiagnosticRecord {
  id: string;
  diagnostic_type: 'baseline' | 'progress_review';
  created_at: string;
  window_hand_count: number;
  classified_hand_count_at_checkpoint: number;
  total_eligible_at_checkpoint?: number;
  lifetime_snapshot?: Record<string, number>;
  excess_new_hands?: number;
  statistical_snapshot: Record<string, number>;
  focus_areas: FocusArea[];
  relevant_candidate_hand_ids: string[];
  selected_example_hand_ids: string[];
  ai_output: {
    summary: string;
    recommendations: string[];
    priorities?: AiPriority[];
    contextual_outliers?: ContextualOutlier[];
  };
  progress_comparison?: ProgressComparison;
  new_hands_since_last: number | null;
  area?: string;
  depth?: string;
  ai_provider?: string | null;
  ai_model?: string | null;
}

interface ProgressComparison {
  previousSnapshot: Record<string, number>;
  currentSnapshot: Record<string, number>;
  changes: Array<{
    statKey: string;
    label: string;
    previous: number;
    current: number;
    change: number;
    meaningful: boolean;
  }>;
  previousFocusAssessments: Array<{
    title: string;
    status: 'improving' | 'stable' | 'needs_attention' | 'insufficient_sample';
    detail: string;
  }>;
}

interface CoachStatus {
  eligible: boolean;
  totalEligibleHands: number;
  minRequired: number;
  hasBaseline: boolean;
  diagnosticCount: number;
  newHandsSinceLast: number;
  nextWindowHandsNeeded: number;
  readyForProgressReview: boolean;
  lastDiagnosticType: string | null;
  lastDiagnosticDate: string | null;
}

interface HandCheckResult {
  totalHands: number;
  classifiedHands: number;
  aiEligibleHands: number;
  minRequired: number;
  status: 'ready' | 'insufficient';
  excludedReason: string | null;
}

interface AICoachShellProps {
  userId?: string;
  mode: string;
  totalHands: number;
  onJumpToAnalyzer?: (filters: Record<string, unknown>) => void;
  membershipTier?: MembershipTier;
  isDemo?: boolean;
}

const AREA_OPTIONS: { value: AnalysisArea; label: string }[] = [
  { value: 'complete_game', label: 'Complete Game' },
  { value: 'preflop', label: 'Preflop' },
  { value: 'postflop', label: 'Postflop' },
];

const DEPTH_OPTIONS: { value: AnalysisDepth; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' },
];

export function AICoachShell({ userId, mode, totalHands, onJumpToAnalyzer, membershipTier, isDemo }: AICoachShellProps) {
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticRecord[]>([]);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<DiagnosticRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [resolvedTier, setResolvedTier] = useState<MembershipTier>(membershipTier ?? 'free');
  const [area, setArea] = useState<AnalysisArea>('complete_game');
  const [depth, setDepth] = useState<AnalysisDepth>('standard');

  const [showDeepLock, setShowDeepLock] = useState(false);
  const [demoViewActive, setDemoViewActive] = useState(false);

  const canUseAiCoach = tierHasAiCoach(resolvedTier);
  const canUseDeep = hasCapability(resolvedTier, 'AI_COACH_DEEP' as Capability);
  // Owner-data bypass: if the user is NOT in demo context and has enough
  // personal hands, they get personal AI Coach regardless of membership tier.
  // This ensures the dataset owner (Jordan) gets PERSONAL mode on their own data
  // even with a core/free membership.
  const hasPersonalData = !isDemo && totalHands >= MIN_HANDS;
  const canAccessPersonal = canUseAiCoach || hasPersonalData;
  // effectiveIsDemo: true when viewing demo data (either via isDemo prop or
  // demoViewActive toggle). False when the user owns data and is in personal mode.
  const effectiveIsDemo = isDemo || demoViewActive;

  useEffect(() => {
    if (membershipTier) { setResolvedTier(membershipTier); return; }
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_memberships')
          .select('tier_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        if (!cancelled && data?.tier_id) {
          setResolvedTier(data.tier_id as MembershipTier);
        } else if (!cancelled) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('primary_role')
            .eq('user_id', userId)
            .maybeSingle();
          if (!cancelled && (profile?.primary_role === 'superuser' || profile?.primary_role === 'staff' || profile?.primary_role === 'universal_access')) {
            setResolvedTier('elite');
          }
        }
      } catch { /* default free */ }
    })();
    return () => { cancelled = true; };
  }, [userId, membershipTier]);

  const callEdge = useCallback(async (body: Record<string, unknown>) => {
    if (!userId) return null;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setError('Not authenticated.'); return null; }

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ userId, mode, is_demo: effectiveIsDemo, ...body }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Request failed.');
    }
    return data;
  }, [userId, mode, effectiveIsDemo]);

  const loadStatus = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const data = await callEdge({ action: 'status' });
      if (data) { setStatus(data); setError(null); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load AI Coach status.');
    }
    setLoading(false);
  }, [callEdge, userId]);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await callEdge({ action: 'history' });
      if (data?.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
    } catch { /* silent */ }
  }, [callEdge, userId]);

  useEffect(() => {
    loadStatus();
    loadHistory();
  }, [loadStatus, loadHistory]);

  const runDiagnostic = useCallback(async () => {
    if (!userId) return;
    setRunning(true);
    setError(null);
    try {
      await callEdge({ action: 'run', area, depth });
      await loadStatus();
      const data = await callEdge({ action: 'history' });
      if (data?.diagnostics && data.diagnostics.length > 0) {
        setDiagnostics(data.diagnostics);
        setSelectedDiagnostic(data.diagnostics[data.diagnostics.length - 1]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostic failed.');
    }
    setRunning(false);
  }, [callEdge, userId, area, depth, loadStatus]);

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="mt-6 rounded-xl border p-6 backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: SHELL_BG }}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[12px] font-bold text-white/60">Loading AI Coach...</span>
        </div>
      </div>
    );
  }

  // ===== ERROR =====
  if (error && !status) {
    return (
      <div className="mt-6 rounded-xl border p-6 backdrop-blur-md" style={{ borderColor: 'rgba(239,68,68,0.2)', background: SHELL_BG }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" strokeWidth={1.5} />
          <span className="text-[12px] font-bold text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  const hasDiagnostic = diagnostics.length > 0;
  const progressPct = status ? Math.min(100, (status.newHandsSinceLast / MIN_HANDS) * 100) : 0;

  // Determine which mode to render:
  // - isDemo prop = true: AnalyticsView is showing demo data
  // - canAccessPersonal + !effectiveIsDemo: personal mode (owns data or has tier)
  // - !canAccessPersonal + !effectiveIsDemo: show demo intro
  const showDemoIntro = !effectiveIsDemo && !canAccessPersonal;
  const showPersonalMode = !effectiveIsDemo && canAccessPersonal;

  return (
    <div className="mt-6 rounded-xl border backdrop-blur-md" style={{ borderColor: SHELL_BORDER, background: SHELL_BG, boxShadow: '0 4px 20px -8px rgba(0,0,0,0.6)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-5 py-3.5" style={{ borderColor: SHELL_BORDER }}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(212,165,44,0.15), rgba(212,165,44,0.04))', border: '1px solid rgba(212,165,44,0.2)' }}>
          <Brain className="h-4.5 w-4.5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-bold tracking-tight text-white">
            {effectiveIsDemo ? 'SPOTVAULT AI COACH DEMO' : 'SPOTVAULT AI COACH'}
          </h3>
          <p className="text-[9px] font-medium tracking-widest uppercase" style={{ color: GOLD_SOFT, opacity: 0.7 }}>
            {effectiveIsDemo ? 'Demonstration Dataset' : 'Performance Diagnostic & Progress Review'}
          </p>
        </div>
        {hasDiagnostic && !showDemoIntro && (
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all hover:bg-white/5" style={{ borderColor: BORDER, color: 'rgba(255,255,255,0.5)' }}>
            <History className="h-3.5 w-3.5" strokeWidth={1.5} /> History
          </button>
        )}
        {/* Personal mode users with tier access: show View Demo option */}
        {showPersonalMode && canUseAiCoach && (
          <button
            onClick={() => { setDemoViewActive(true); }}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all hover:bg-white/5"
            style={{ borderColor: BORDER, color: 'rgba(255,255,255,0.4)' }}
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> View Demo
          </button>
        )}
        {/* In demo view (elite/pro): show Back to Personal */}
        {demoViewActive && canUseAiCoach && (
          <button
            onClick={() => { setDemoViewActive(false); }}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-all hover:bg-white/5"
            style={{ borderColor: BORDER, color: 'rgba(255,255,255,0.4)' }}
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" strokeWidth={1.5} /> My Analysis
          </button>
        )}
      </div>

      <div className="p-5">
        {/* Demo banner */}
        {effectiveIsDemo && (
          <div className="mb-4 rounded-lg border px-4 py-2.5" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(212,165,44,0.04)' }}>
            <div className="flex items-center gap-2">
              <span className="rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD, borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)' }}>Demo Data</span>
              <span className="text-[10px] text-white/50">This analysis uses SpotVault demonstration hand history. Upgrade to Elite or Pro to analyze your own game.</span>
            </div>
          </div>
        )}

        {showDemoIntro ? (
          /* ===== DEMO INTRO — free/core users ===== */
          <DemoIntroView onExploreDemo={() => { setDemoViewActive(true); }} tier={resolvedTier} />
        ) : showHistory && hasDiagnostic ? (
          <DiagnosticHistory diagnostics={diagnostics} selectedId={selectedDiagnostic?.id} onSelect={(d) => { setSelectedDiagnostic(d); setShowHistory(false); }} />
        ) : !selectedDiagnostic ? (
          /* ===== PRE-DIAGNOSTIC: CONFIG + ELIGIBILITY (also shown when history exists but none selected) ===== */
          <PreDiagnosticView
            status={status}
            totalHands={totalHands}
            running={running}
            error={error}
            onRun={runDiagnostic}
            area={area}
            setArea={setArea}
            depth={depth}
            setDepth={setDepth}
            canUseDeep={effectiveIsDemo ? true : canUseDeep}
            onDeepLocked={() => setShowDeepLock(true)}

          />
        ) : selectedDiagnostic ? (
          /* ===== DIAGNOSTIC OR PROGRESS REVIEW DISPLAY ===== */
          <DiagnosticView
            diagnostic={selectedDiagnostic}
            status={status}
            running={running}
            error={error}
            onRun={runDiagnostic}
            progressPct={progressPct}
            onJumpToAnalyzer={onJumpToAnalyzer}
            area={area}
            setArea={setArea}
            depth={depth}
            setDepth={setDepth}
            canUseDeep={effectiveIsDemo ? true : canUseDeep}
            onDeepLocked={() => setShowDeepLock(true)}
          />
        ) : null}

        {/* Deep lock modal */}
        {showDeepLock && (
          <DeepLockModal onClose={() => setShowDeepLock(false)} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPACT RADIO SELECTOR — shared by area and depth
// ============================================================
function RadioOption({
  label, active, onClick, locked,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 py-1 text-[12px] font-medium transition-colors"
    >
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all"
        style={{
          borderColor: active ? GOLD : 'rgba(255,255,255,0.2)',
          background: active ? 'rgba(212,165,44,0.12)' : 'transparent',
        }}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />}
      </span>
      <span
        className="transition-colors"
        style={{ color: active ? GOLD_SOFT : 'rgba(255,255,255,0.55)' }}
      >
        {label}
      </span>
      {locked && <Lock className="h-3 w-3" style={{ color: GOLD, opacity: 0.6 }} strokeWidth={1.5} />}
    </button>
  );
}

// ============================================================
// AREA + DEPTH SELECTOR — compact radio style
// ============================================================
function AreaDepthSelector({
  area, setArea, depth, setDepth, canUseDeep, onDeepLocked,
}: {
  area: AnalysisArea;
  setArea: (a: AnalysisArea) => void;
  depth: AnalysisDepth;
  setDepth: (d: AnalysisDepth) => void;
  canUseDeep: boolean;
  onDeepLocked: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Question 1 — Area */}
      <div>
        <p className="mb-1.5 text-[11px] font-bold tracking-wide text-white/50">
          1. What would you like me to examine?
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {AREA_OPTIONS.map((opt) => (
            <RadioOption
              key={opt.value}
              label={opt.label}
              active={area === opt.value}
              onClick={() => setArea(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Question 2 — Depth */}
      <div>
        <p className="mb-1.5 text-[11px] font-bold tracking-wide text-white/50">
          2. How deep should I analyze?
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {DEPTH_OPTIONS.map((opt) => {
            const isLocked = opt.value === 'deep' && !canUseDeep;
            return (
              <RadioOption
                key={opt.value}
                label={opt.label}
                active={depth === opt.value}
                locked={isLocked}
                onClick={() => {
                  if (isLocked) { onDeepLocked(); return; }
                  setDepth(opt.value);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PRE-DIAGNOSTIC VIEW (no baseline yet)
// ============================================================
function PreDiagnosticView({
  status, totalHands, running, error, onRun,
  area, setArea, depth, setDepth, canUseDeep, onDeepLocked,
}: {
  status: CoachStatus | null;
  totalHands: number;
  running: boolean;
  error: string | null;
  onRun: () => void;
  area: AnalysisArea;
  setArea: (a: AnalysisArea) => void;
  depth: AnalysisDepth;
  setDepth: (d: AnalysisDepth) => void;
  canUseDeep: boolean;
  onDeepLocked: () => void;
}) {
  const eligible = status?.eligible ?? false;
  const eligibleHands = status?.totalEligibleHands ?? totalHands;
  const [showExplainer, setShowExplainer] = useState(false);

  return (
    <div className="space-y-4">
      {/* Explainer — always visible on desktop, collapsible on mobile */}
      <div className="hidden lg:block space-y-2">
        <p className="text-[12px] leading-relaxed text-white/55">
          Turn your hand history into a focused development plan. Once you have at least <span className="font-semibold" style={{ color: GOLD_SOFT }}>5,000 classified hands</span>, SpotVault will analyze your most recent 5,000-hand sample across your available analytics.
        </p>
        <p className="text-[12px] leading-relaxed text-white/55">
          We'll identify up to <span className="font-semibold text-white/80">1-2 of the strongest areas</span> worth your attention, then search the relevant hand histories for examples that help explain what we're seeing.
        </p>
        <p className="text-[12px] leading-relaxed text-white/55">
          Your diagnostic is saved as a checkpoint. After you build your next sample, SpotVault compares the new hands against your previous review, measures meaningful statistical changes, evaluates your progress, and determines what you should focus on next.
        </p>
      </div>

      {/* Mobile collapsible explainer */}
      <div className="lg:hidden">
        <button
          onClick={() => setShowExplainer(!showExplainer)}
          className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[11px] font-bold tracking-wider uppercase transition-all hover:bg-white/5"
          style={{ borderColor: BORDER, color: 'rgba(255,255,255,0.45)' }}
        >
          How AI Coach Works
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExplainer ? 'rotate-180' : ''}`} strokeWidth={1.5} />
        </button>
        {showExplainer && (
          <div className="mt-2 space-y-2 px-1">
            <p className="text-[11px] leading-relaxed text-white/50">
              Turn your hand history into a focused development plan. Once you have at least <span className="font-semibold" style={{ color: GOLD_SOFT }}>5,000 classified hands</span>, SpotVault will analyze your most recent 5,000-hand sample across your available analytics.
            </p>
            <p className="text-[11px] leading-relaxed text-white/50">
              We'll identify up to <span className="font-semibold text-white/75">1-2 of the strongest areas</span> worth your attention, then search the relevant hand histories for examples that help explain what we're seeing.
            </p>
            <p className="text-[11px] leading-relaxed text-white/50">
              Your diagnostic is saved as a checkpoint. After you build your next sample, SpotVault compares the new hands against your previous review, measures meaningful statistical changes, evaluates your progress, and determines what you should focus on next.
            </p>
          </div>
        )}
      </div>

      {/* Area + Depth selectors */}
      <AreaDepthSelector
        area={area}
        setArea={setArea}
        depth={depth}
        setDepth={setDepth}
        canUseDeep={canUseDeep}
        onDeepLocked={onDeepLocked}
      />

      {/* Eligibility display — auto from status */}
      {status && (
        <div className="rounded-lg border p-3" style={{
          borderColor: status.eligible ? 'rgba(74,222,128,0.2)' : 'rgba(245,158,11,0.2)',
          background: status.eligible ? 'rgba(74,222,128,0.04)' : 'rgba(245,158,11,0.04)',
        }}>
          <div className="flex items-center gap-2">
            {status.eligible
              ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#4ade80' }} strokeWidth={1.5} />
              : <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} strokeWidth={1.5} />}
            <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: status.eligible ? '#4ade80' : '#f59e0b' }}>
              {status.eligible ? 'Ready for First Diagnostic' : `${MIN_HANDS.toLocaleString()} Hand Minimum`}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className="text-white/40">Eligible Hands</span>
            <span className="font-bold" style={{ color: GOLD_SOFT }}>{status.totalEligibleHands.toLocaleString()}</span>
            <span className="text-white/20">|</span>
            <span className="text-white/40">Required</span>
            <span className="font-bold text-white/70">{status.minRequired.toLocaleString()}</span>
            <span className="text-white/20">|</span>
            <span className="text-white/40">Status</span>
            <span className="font-bold" style={{ color: status.eligible ? '#ffffff' : '#f59e0b' }}>
              {status.eligible ? 'READY' : 'INSUFFICIENT'}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" strokeWidth={1.5} />
            <span className="text-[11px] font-medium text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Action */}
      <button
        onClick={onRun}
        disabled={!eligible || running}
        className="flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[12px] font-bold tracking-wider uppercase transition-all hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
        style={{ borderColor: eligible ? GOLD : 'rgba(255,255,255,0.1)', color: eligible ? '#080706' : 'rgba(255,255,255,0.3)', background: eligible ? GOLD : 'transparent' }}
      >
        {running ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Analyzing 5,000 Hands...</> : <><Zap className="h-4 w-4" strokeWidth={2} /> Run Diagnostic</>}
      </button>
    </div>
  );
}

// ============================================================
// DIAGNOSTIC VIEW (baseline or progress review)
// ============================================================
function DiagnosticView({
  diagnostic, status, running, error, onRun, progressPct, onJumpToAnalyzer,
  area, setArea, depth, setDepth, canUseDeep, onDeepLocked,
}: {
  diagnostic: DiagnosticRecord;
  status: CoachStatus | null;
  running: boolean;
  error: string | null;
  onRun: () => void;
  progressPct: number;
  onJumpToAnalyzer?: (filters: Record<string, unknown>) => void;
  area: AnalysisArea;
  setArea: (a: AnalysisArea) => void;
  depth: AnalysisDepth;
  setDepth: (d: AnalysisDepth) => void;
  canUseDeep: boolean;
  onDeepLocked: () => void;
}) {
  const isProgressReview = diagnostic.diagnostic_type === 'progress_review';
  const d = diagnostic;
  const priorities = d.ai_output?.priorities ?? [];
  const contextualOutliers = d.ai_output?.contextual_outliers ?? [];
  const focusAreas = d.focus_areas || [];
  const examples = d.selected_example_hand_ids || [];
  const progressComparison = d.progress_comparison;
  const aiProvider = d.ai_provider;

  return (
    <div className="space-y-5">
      {/* Area + Depth selectors (for next run) */}
      {(status?.readyForProgressReview ?? false) && (
        <AreaDepthSelector
          area={area}
          setArea={setArea}
          depth={depth}
          setDepth={setDepth}
          canUseDeep={canUseDeep}
          onDeepLocked={onDeepLocked}
        />
      )}

      {/* AI-generated priorities (structured output) */}
      {priorities.length > 0 ? (
        <div>
          <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">Current Focus</h4>
          <div className="space-y-3">
            {priorities.map((p, i) => (
              <div key={i} className="rounded-lg border p-4" style={{ borderColor: SHELL_BORDER, background: 'rgba(8,7,6,0.6)' }}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: 'rgba(239,68,68,0.12)' }}>
                    <span className="text-[11px] font-bold text-red-300">{i + 1}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-white">{p.title}</span>
                      <span className="rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide" style={{ borderColor: BORDER, color: GOLD_SOFT }}>{p.category}</span>
                      {p.confidence && (
                        <span className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-white/40">{p.confidence}</span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-white/65">{p.explanation}</p>
                    {p.whyItMatters && (
                      <div className="rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                        <span className="text-[9px] font-bold tracking-widest text-white/35 uppercase">Why It Matters</span>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/55">{p.whyItMatters}</p>
                      </div>
                    )}
                    {p.actionPlan && (
                      <div className="rounded-md border px-3 py-2" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(212,165,44,0.03)' }}>
                        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Action Plan</span>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/65">{p.actionPlan}</p>
                      </div>
                    )}
                    {p.relatedMetrics && p.relatedMetrics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.relatedMetrics.map((m, j) => (
                          <span key={j} className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[9px] font-mono text-white/40">{m}</span>
                        ))}
                      </div>
                    )}
                    {p.exampleHandIds && p.exampleHandIds.length > 0 && (
                      <div className="space-y-1.5">
                        {p.exampleHandIds.map((handId, j) => (
                          <HandExampleButton key={j} handId={handId} index={j} onJumpToAnalyzer={onJumpToAnalyzer} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : focusAreas.length > 0 ? (
        /* Fallback to heuristic focus areas */
        <div>
          <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">Current Focus</h4>
          <div className="space-y-2">
            {focusAreas.map((area2, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ borderColor: SHELL_BORDER, background: 'rgba(8,7,6,0.6)' }}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: area2.priority === 'high' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }}>
                    <span className="text-[10px] font-bold" style={{ color: area2.priority === 'high' ? '#f87171' : '#f59e0b' }}>{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-white">{area2.title}</span>
                      <span className="rounded border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide" style={{ borderColor: BORDER, color: GOLD_SOFT }}>{area2.category}</span>
                      {area2.priority === 'high' && <span className="rounded border border-red-400/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-red-300">Priority</span>}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/55">{area2.description}</p>
                    <p className="mt-1 text-[10px] font-mono text-white/35">Benchmark: {area2.benchmark} · Current: {area2.statValue}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Contextual outliers (no action required) */}
      {contextualOutliers.length > 0 && (
        <div>
          <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">Contextual Observations</h4>
          <div className="space-y-2">
            {contextualOutliers.map((o, i) => (
              <div key={i} className="rounded-lg border border-white/[0.04] bg-white/[0.015] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white/70">{o.metric}</span>
                  {!o.actionRequired && (
                    <span className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-white/40">No Action Required</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-white/45">{o.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress comparison table */}
      {isProgressReview && progressComparison && (
        <ProgressComparisonView comparison={progressComparison} />
      )}

      {/* AI Coach Assessment */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(212,165,44,0.03)' }}>
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>AI Coach Assessment</span>
          {aiProvider && (
            <span className="ml-auto text-[8px] font-mono text-white/25">{aiProvider}</span>
          )}
        </div>
        <p className="text-[12px] leading-relaxed text-white/70">{d.ai_output?.summary}</p>
        {d.ai_output?.recommendations && d.ai_output.recommendations.length > 0 && (
          <div className="mt-3 space-y-2">
            {d.ai_output.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                <p className="text-[11px] leading-relaxed text-white/55">{rec}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Example hands (non-priority) */}
      {examples.length > 0 && priorities.length === 0 && (
        <div>
          <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">Hands Worth Reviewing</h4>
          <div className="space-y-1.5">
            {examples.map((handId, i) => (
              <HandExampleButton key={i} handId={handId} index={i} onJumpToAnalyzer={onJumpToAnalyzer} />
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic metadata */}
      <div className="rounded-lg border border-white/[0.04] bg-white/[0.015] p-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="font-bold text-white/50">
            {isProgressReview ? 'Progress Review' : 'Baseline Diagnostic'}
          </span>
          <span className="text-white/25">·</span>
          <span className="text-white/40">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          {d.area && d.area !== 'complete_game' && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-white/40 uppercase">{d.area.replace('_', ' ')}</span>
            </>
          )}
          {d.depth && d.depth !== 'standard' && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-white/40 uppercase">{d.depth}</span>
            </>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <span className="text-[8px] font-medium tracking-widest text-white/30 uppercase">Investigation Window</span>
            <p className="text-[12px] font-bold text-white">{d.window_hand_count.toLocaleString()} hands</p>
          </div>
          <div>
            <span className="text-[8px] font-medium tracking-widest text-white/30 uppercase">Total at Checkpoint</span>
            <p className="text-[12px] font-bold text-white">{(d.total_eligible_at_checkpoint ?? d.classified_hand_count_at_checkpoint).toLocaleString()}</p>
          </div>
          {isProgressReview && d.new_hands_since_last != null && (
            <div>
              <span className="text-[8px] font-medium tracking-widest text-white/30 uppercase">New Hands Since Last</span>
              <p className="text-[12px] font-bold text-white">{d.new_hands_since_last.toLocaleString()}</p>
            </div>
          )}
        </div>
        {d.excess_new_hands && d.excess_new_hands > 0 && (
          <p className="mt-2 text-[9px] text-white/30">
            {d.excess_new_hands.toLocaleString()} additional new hands beyond the 5,000-hand window will be included in the next review.
          </p>
        )}
      </div>

      {/* Next window progress */}
      {status && !status.readyForProgressReview && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.03)' }}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: '#f59e0b' }} strokeWidth={1.5} />
            <span className="text-[10px] font-bold tracking-wider uppercase text-amber-300/80">Progress Toward Next Review</span>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="text-white/40">New hands since last review</span>
              <span className="font-mono text-white/60">{status.newHandsSinceLast.toLocaleString()} / {MIN_HANDS.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.04]">
              <div className="h-2 rounded-full transition-all" style={{ width: `${progressPct}%`, background: GOLD }} />
            </div>
            <p className="mt-2 text-[10px] text-white/35">{status.nextWindowHandsNeeded.toLocaleString()} more classified hands needed</p>
          </div>
        </div>
      )}

      {/* Ready for progress review */}
      {status?.readyForProgressReview && (
        <button
          onClick={onRun}
          disabled={running}
          className="flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-[12px] font-bold tracking-wider uppercase transition-all hover:scale-[1.01] disabled:opacity-40"
          style={{ borderColor: GOLD, color: '#080706', background: GOLD }}
        >
          {running ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Running Progress Review...</> : <><TrendingUp className="h-4 w-4" strokeWidth={2} /> Run Progress Review</>}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" strokeWidth={1.5} />
              <span className="text-[11px] font-medium text-red-300">{error}</span>
            </div>
            <button onClick={onRun} disabled={running} className="rounded-md border border-red-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-50">
              {running ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HAND EXAMPLE BUTTON (clickable, opens in analyzer)
// ============================================================
function HandExampleButton({ handId, index, onJumpToAnalyzer }: { handId: string; index: number; onJumpToAnalyzer?: (filters: Record<string, unknown>) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: SHELL_BORDER, background: 'rgba(8,7,6,0.6)' }}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.06)' }}>
        <span className="text-[10px] font-bold" style={{ color: GOLD }}>{index + 1}</span>
      </div>
      <div className="flex-1">
        <span className="text-[11px] font-mono text-white/70">Hand #{handId.slice(0, 8)}</span>
      </div>
      {onJumpToAnalyzer && (
        <button
          onClick={() => onJumpToAnalyzer({ handId })}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-medium transition-all hover:bg-white/5"
          style={{ borderColor: BORDER, color: GOLD_SOFT }}
        >
          <Eye className="h-3 w-3" strokeWidth={1.5} /> View Hand
        </button>
      )}
    </div>
  );
}

// ============================================================
// PROGRESS COMPARISON VIEW
// ============================================================
function ProgressComparisonView({ comparison }: { comparison: ProgressComparison }) {
  const { changes, previousFocusAssessments } = comparison;

  return (
    <div className="space-y-4">
      {/* Previous focus evaluation */}
      {previousFocusAssessments.length > 0 && (
        <div>
          <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">Previous Focus Evaluation</h4>
          <div className="space-y-2">
            {previousFocusAssessments.map((assessment, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ borderColor: SHELL_BORDER, background: 'rgba(8,7,6,0.6)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white">{assessment.title}</span>
                  <StatusBadge status={assessment.status} />
                </div>
                <p className="mt-1 text-[10px] text-white/45">{assessment.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat change table */}
      <div>
        <h4 className="mb-2 text-[10px] font-bold tracking-widest text-white/45 uppercase">Progress Since Last Review</h4>
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: SHELL_BORDER }}>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: SHELL_BORDER, background: 'rgba(8,7,6,0.6)' }}>
                <th className="px-3 py-2 text-left text-[9px] font-bold tracking-widest text-white/40 uppercase">Stat</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Previous</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Current</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold tracking-widest text-white/40 uppercase">Change</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.03)', background: c.meaningful ? 'rgba(212,165,44,0.03)' : 'transparent' }}>
                  <td className="px-3 py-2 text-[11px] font-medium text-white/70">{c.label}</td>
                  <td className="px-3 py-2 text-right text-[11px] font-mono text-white/50">{c.previous.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-[11px] font-mono text-white/70">{c.current.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold" style={{ color: c.change > 0 ? '#4ade80' : c.change < 0 ? '#f87171' : '#9ca3af' }}>
                      {c.change > 0 ? <ArrowUp className="h-3 w-3" strokeWidth={2} /> : c.change < 0 ? <ArrowDown className="h-3 w-3" strokeWidth={2} /> : <Minus className="h-3 w-3" strokeWidth={2} />}
                      {c.change > 0 ? '+' : ''}{c.change.toFixed(1)} pts
                    </span>
                    {c.meaningful && <span className="ml-1.5 rounded border px-1 py-0.5 text-[7px] font-bold uppercase" style={{ borderColor: 'rgba(212,165,44,0.3)', color: GOLD_SOFT }}>Shift</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { color: string; bg: string; border: string; label: string }> = {
    improving: { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)', label: 'Improving' },
    stable: { color: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)', label: 'Stable' },
    needs_attention: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', label: 'Needs Attention' },
    insufficient_sample: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Insufficient Sample' },
  };
  const s = styles[status] ?? styles.stable;
  return (
    <span className="rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide" style={{ color: s.color, borderColor: s.border, background: s.bg }}>
      {s.label}
    </span>
  );
}

// ============================================================
// DIAGNOSTIC HISTORY
// ============================================================
function DiagnosticHistory({ diagnostics, selectedId, onSelect }: { diagnostics: DiagnosticRecord[]; selectedId?: string; onSelect: (d: DiagnosticRecord) => void }) {
  return (
    <div>
      <h4 className="mb-3 text-[10px] font-bold tracking-widest text-white/45 uppercase">Diagnostic History</h4>
      <div className="space-y-2">
        {diagnostics.map((d, i) => (
          <button
            key={d.id}
            onClick={() => onSelect(d)}
            className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all hover:bg-white/[0.03]"
            style={{ borderColor: d.id === selectedId ? GOLD : SHELL_BORDER, background: d.id === selectedId ? 'rgba(var(--portal-accent-rgb, 212,165,44), 0.04)' : 'rgba(8,7,6,0.4)' }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.06)' }}>
              {d.diagnostic_type === 'baseline' ? <Zap className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} /> : <TrendingUp className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-white">
                  {d.diagnostic_type === 'baseline' ? 'Baseline Diagnostic' : `Progress Review #${i}`}
                </span>
                <span className="text-[10px] text-white/35">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/40">{d.window_hand_count.toLocaleString()} hands analyzed</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/20" strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DEEP LOCK MODAL
// ============================================================
function DeepLockModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(212,165,44,0.08)', border: '1px solid rgba(212,165,44,0.15)' }}>
          <Lock className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <h3 className="mt-4 text-[14px] font-bold text-white">Deep Analysis</h3>
        <p className="mt-2 text-[12px] text-white/50">Available with Premium membership. Upgrade to unlock deeper investigation of position vs position, stack depth, board texture, and multi-street sequences.</p>
        <button
          onClick={() => { window.location.hash = '#store'; onClose(); }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all hover:scale-[1.02]"
          style={{ borderColor: GOLD, color: '#080706', background: GOLD }}
        >
          <Zap className="h-3.5 w-3.5" strokeWidth={2} /> Upgrade
        </button>
        <button onClick={onClose} className="mt-2 text-[10px] text-white/30 hover:text-white/50">Maybe later</button>
      </div>
    </div>
  );
}

// ============================================================
// LOCKED VIEW — ineligible membership
// ============================================================
function DemoIntroView({ onExploreDemo, tier }: { onExploreDemo: () => void; tier: MembershipTier }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-[12px] leading-relaxed text-white/55">
          Explore AI Coach using a real 7,000-hand demonstration dataset. SpotVault identifies 1-2 high-impact areas to work on, finds relevant hand examples from the sample, then measures progress over your next 5,000 hands.
        </p>
        <p className="text-[11px] leading-relaxed text-white/40">
          Elite and Pro members can unlock AI Coach analysis using their own hand history.
        </p>
      </div>
      <div className="rounded-lg border p-5 text-center" style={{ borderColor: 'rgba(212,165,44,0.15)', background: 'rgba(212,165,44,0.03)' }}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(212,165,44,0.08)', border: '1px solid rgba(212,165,44,0.15)' }}>
          <Brain className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-[13px] font-bold text-white">SPOTVAULT AI COACH DEMO</p>
        <p className="mt-1 text-[11px] text-white/40">Explore AI Coach using a real 7,000-hand demonstration dataset.</p>
        <button
          onClick={onExploreDemo}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all hover:scale-[1.02]"
          style={{ borderColor: GOLD, color: '#080706', background: GOLD }}
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={2} /> Explore Demo Analysis
        </button>
        <button
          onClick={() => { window.location.hash = '#store'; }}
          className="mt-2 block mx-auto text-[10px] text-white/30 hover:text-white/50"
        >
          Upgrade to Elite or Pro for personal analysis
        </button>
      </div>
    </div>
  );
}
