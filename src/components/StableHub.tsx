import { useState, useEffect, useCallback } from 'react';
import {
  Users, BarChart3, FileCheck, Activity, Library, BriefcaseBusiness,
  Newspaper, DollarSign, Building2, MessageSquare, Home,
  TrendingUp, TrendingDown, AlertCircle, Clock, ChevronRight,
  ChevronDown, CheckCircle2, XCircle, UserPlus, Mail, Star, Upload, Plus, X,
  Trophy, Target, BookOpen, Loader2, GraduationCap, ArrowRight,
  ArrowUp, ArrowRight as ArrowFlat, ArrowDown, Sparkles,
} from 'lucide-react';
import { PortalRoomShell } from '@/components/PortalRoomShell';
import { buildNavForPortal } from '@/data/portalConfigs';
import { renderSharedPlayerView } from '@/components/player/SharedPlayerViews';
import type { HubTab } from '@/components/player/ProfileSettingsHub';
import { SettingsPage } from '@/components/player/SettingsPage';
import { IndustryRolodex } from '@/components/professional/IndustryRolodex';
import { PaidRequestsPanel } from '@/components/monetization/PaidRequestsPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/lib/supabase';
import { loadLatestSnapshot, type AnalyticsSnapshot, type AnalyticsMode } from '@/lib/pokerAnalytics';
import type { SpotVaultAccount, HubId } from '@/types';
import type { CustomPortalMembership } from '@/lib/portalAccessStore';
import type { PortalId, Demo } from '@/useDemo';
import type { UniversalView } from '@/components/UniversalRail';
import type { ChannelDef } from '@/components/player/ChatPanel';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const GOLD_BORDER = 'rgba(192,145,30,0.25)';

type StableView =
  | 'home' | 'coaches' | 'review-room' | 'intelligence'
  | 'library' | 'recruiting' | 'publishing' | 'earnings' | 'business'
  | 'chat' | 'rolodex' | 'paid-requests' | 'people' | 'opportunities' | 'marketplace' | 'privacy' | 'terms'
  | 'my-spots' | 'my-library' | 'public-library' | 'hand-analysis'
  | 'hh-workspace' | 'analytics' | 'content-lab' | 'solver'
  | 'market-store' | 'spot-store' | 'multispot-store' | 'stakekings-action'
  | 'profile' | 'settings';

interface StablePlayer {
  id: string;
  user_id: string;
  display_name: string;
  screen_names: string[];
  game_type: string | null;
  stakes: string | null;
  abi: number;
  volume_hands: number;
  status: string;
  assigned_coach_id: string | null;
  join_date: string | null;
  makeup_amount: number;
  baseline_completed: boolean;
}

interface StableCandidate {
  id: string;
  user_id: string;
  status: string;
  match_score: number;
  notes: string | null;
}

interface ReviewSubmission {
  id: string;
  player_id: string;
  submission_type: string;
  title: string | null;
  body: string | null;
  status: string;
  created_at: string;
}

interface StableEarning {
  id: string;
  transaction_type: string;
  gross_cents: number;
  spotvault_fee_cents: number;
  stable_proceeds_cents: number;
  player_share_cents: number;
  treatment: string;
  description: string | null;
  created_at: string;
}

interface StableActivityItem {
  id: string;
  activity_type: string;
  description: string;
  player_id: string | null;
  created_at: string;
}

interface StableCoach {
  id: string;
  stable_id: string;
  user_id: string;
  display_name: string;
  role_specialty: string | null;
}

interface PlayerCoachAssignment {
  id: string;
  player_id: string;
  coach_id: string;
  is_primary: boolean;
  role: string;
}

interface TournamentResult {
  id: string;
  player_id: string;
  tournament_date: string;
  site: string | null;
  tournament_name: string | null;
  buy_in_cents: number;
  prize_cents: number;
  finish_position: number | null;
  field_size: number | null;
  profit_cents: number;
}

interface PlayerBaseline {
  id: string;
  player_id: string;
  captured_at: string;
  bb_per_100: number | null;
  key_stats: Record<string, number>;
  sample_size: number;
  notes: string | null;
}

interface PlayerSnapshot {
  id: string;
  player_id: string;
  snapshot_type: string;
  captured_at: string;
  bb_per_100: number | null;
  key_stats: Record<string, number>;
  sample_size: number;
  volume_hands: number;
}

interface Props {
  onBack: () => void;
  account: SpotVaultAccount | null;
  currentPortal: PortalId;
  onSwitchPortal: (portal: HubId) => void;
  portalSwitchOpen: boolean;
  onTogglePortalSwitch: () => void;
  onClosePortalSwitch: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
  demo: Demo;
  onOpenCustomPortals?: () => void;
  customPortalLabel?: string | null;
  activePortalId?: string | null;
  customPortals?: CustomPortalMembership[];
  onEnterCustomPortal?: (portal: CustomPortalMembership) => void;
  onReturnToDefault?: () => void;
}

export function StableHub({
  onBack, account, onSwitchPortal,
  portalSwitchOpen, onTogglePortalSwitch, onClosePortalSwitch,
  onOpenUniversalView, demo,
  onOpenCustomPortals, customPortalLabel, activePortalId,
  customPortals, onEnterCustomPortal, onReturnToDefault,
}: Props) {
  const [view, setView] = useState<StableView>('home');
  const [profileTab, setProfileTab] = useState<HubTab>('profile');
  const [stableId, setStableId] = useState<string | null>(null);
  const [roster, setRoster] = useState<StablePlayer[]>([]);
  const [candidates, setCandidates] = useState<StableCandidate[]>([]);
  const [reviews, setReviews] = useState<ReviewSubmission[]>([]);
  const [earnings, setEarnings] = useState<StableEarning[]>([]);
  const [activity, setActivity] = useState<StableActivityItem[]>([]);
  const [coaches, setCoaches] = useState<StableCoach[]>([]);
  const [assignments, setAssignments] = useState<PlayerCoachAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);

  useEffect(() => {
    if (demo.state.portalContentView) {
      setView(demo.state.portalContentView as StableView);
    }
  }, [demo.state.portalContentView]);

  const STABLE_CHAT_CONFIG: { widgetId: string; portalLabel: string; channels: ChannelDef[]; defaultPos: { x: number; y: number }; defaultSize: { width: number; height: number } } = {
    widgetId: 'stable-chat',
    portalLabel: 'Stable',
    channels: [
      { id: 'general', name: '# General', type: 'channel' as const },
      { id: 'coaches', name: '# Coaches', type: 'channel' as const },
      { id: 'hand-review', name: '# Hand Review', type: 'channel' as const },
      { id: 'announcements', name: '# Announcements', type: 'channel' as const },
      { id: 'recruiting', name: '# Recruiting', type: 'channel' as const },
    ],
    defaultPos: { x: 24, y: 60 },
    defaultSize: { width: 480, height: 440 },
  };

  useEffect(() => {
    if (!account) return;
    (async () => {
      const { data: membership } = await supabase
        .from('stable_members')
        .select('stable_id')
        .eq('user_id', account.id)
        .maybeSingle();
      if (membership) setStableId(membership.stable_id);
      setLoading(false);
    })();
  }, [account]);

  const loadRoster = useCallback(async () => {
    if (!stableId) return;
    const { data } = await supabase
      .from('stable_players')
      .select('*')
      .eq('stable_id', stableId)
      .order('created_at', { ascending: false });
    setRoster((data ?? []) as StablePlayer[]);
  }, [stableId]);

  const loadCandidates = useCallback(async () => {
    if (!stableId) return;
    const { data } = await supabase
      .from('stable_candidates')
      .select('*')
      .eq('stable_id', stableId)
      .order('created_at', { ascending: false });
    setCandidates((data ?? []) as StableCandidate[]);
  }, [stableId]);

  const loadReviews = useCallback(async () => {
    if (!stableId) return;
    const { data } = await supabase
      .from('stable_review_submissions')
      .select('*')
      .eq('stable_id', stableId)
      .order('created_at', { ascending: false })
      .limit(20);
    setReviews((data ?? []) as ReviewSubmission[]);
  }, [stableId]);

  const loadEarnings = useCallback(async () => {
    if (!stableId) return;
    const { data } = await supabase
      .from('stable_earnings')
      .select('*')
      .eq('stable_id', stableId)
      .order('created_at', { ascending: false })
      .limit(20);
    setEarnings((data ?? []) as StableEarning[]);
  }, [stableId]);

  const loadActivity = useCallback(async () => {
    if (!stableId) return;
    const { data } = await supabase
      .from('stable_activity')
      .select('*')
      .eq('stable_id', stableId)
      .order('created_at', { ascending: false })
      .limit(50);
    setActivity((data ?? []) as StableActivityItem[]);
  }, [stableId]);

  const loadCoaches = useCallback(async () => {
    if (!stableId) return;
    const { data } = await supabase
      .from('stable_coaches')
      .select('*')
      .eq('stable_id', stableId)
      .order('display_name');
    setCoaches((data ?? []) as StableCoach[]);
  }, [stableId]);

  const loadAssignments = useCallback(async () => {
    if (!stableId) return;
    const { data } = await supabase
      .from('stable_player_coaches')
      .select('*')
      .eq('stable_id', stableId);
    setAssignments((data ?? []) as PlayerCoachAssignment[]);
  }, [stableId]);

  useEffect(() => {
    if (stableId) {
      loadRoster();
      loadCandidates();
      loadReviews();
      loadEarnings();
      loadActivity();
      loadCoaches();
      loadAssignments();
    }
  }, [stableId, loadRoster, loadCandidates, loadReviews, loadEarnings, loadActivity, loadCoaches, loadAssignments]);

  const navItems = buildNavForPortal('stable', account);

  const pendingReviews = reviews.filter(r => r.status === 'pending');
  const newCandidates = candidates.filter(c => c.status === 'new');
  const activePlayers = roster.filter(p => p.status === 'active');
  const needsAttention = roster.filter(p => p.status === 'warning' || p.status === 'review');
  const needsBaseline = roster.filter(p => !p.baseline_completed);

  const totalGross = earnings.reduce((sum, e) => sum + e.gross_cents, 0);
  const totalFees = earnings.reduce((sum, e) => sum + e.spotvault_fee_cents, 0);
  const totalStable = earnings.reduce((sum, e) => sum + e.stable_proceeds_cents, 0);
  const totalPlayer = earnings.reduce((sum, e) => sum + e.player_share_cents, 0);

  const getCoachName = useCallback((coachId: string | null) => {
    if (!coachId) return null;
    const coach = coaches.find(c => c.user_id === coachId || c.id === coachId);
    return coach?.display_name ?? null;
  }, [coaches]);

  const getPrimaryCoach = useCallback((playerId: string) => {
    const primary = assignments.find(a => a.player_id === playerId && a.is_primary);
    if (primary) return primary;
    return assignments.find(a => a.player_id === playerId) ?? null;
  }, [assignments]);

  const handleNavigate = useCallback((v: string) => {
    if (demo.state.portalContentView) demo.actions.closeUniversalView();
    setView(v as StableView);
    setExpandedPlayerId(null);
    setSelectedCoachId(null);
  }, [demo]);

  return (
    <>
      <PortalRoomShell
        demo={demo}
        icon={Users}
        portalLabel="Stable"
        roomLabel="Stable Room"
        navItems={navItems}
        activeNav={view}
        onNavigate={handleNavigate}
        onSwitchPortal={onSwitchPortal}
        portalSwitchOpen={portalSwitchOpen}
        onTogglePortalSwitch={onTogglePortalSwitch}
        onClosePortalSwitch={onClosePortalSwitch}
        onOpenProfileSettings={(tab) => { setProfileTab(tab); setView('profile' as StableView); }}
      onBack={onBack}
        onOpenUniversalView={onOpenUniversalView}
        pushSecondarySectionsDown
        portalKey="stable"
        widgetUserId={account?.id}
        onOpenCustomPortals={onOpenCustomPortals}
        customPortalLabel={customPortalLabel}
        activePortalId={activePortalId}
        customPortals={customPortals}
        onEnterCustomPortal={onEnterCustomPortal}
        onReturnToDefault={onReturnToDefault}
      >
        {view === 'home' && (
          <RosterCommandCenter
            roster={roster}
            coaches={coaches}
            assignments={assignments}
            activity={activity}
            loading={loading}
            needsBaseline={needsBaseline}
            needsAttention={needsAttention}
            pendingReviews={pendingReviews}
            newCandidates={newCandidates}
            expandedPlayerId={expandedPlayerId}
            onTogglePlayer={(id) => setExpandedPlayerId(prev => prev === id ? null : id)}
            onNavigate={setView}
            getCoachName={getCoachName}
            getPrimaryCoach={getPrimaryCoach}
            stableId={stableId}
            onReloadRoster={loadRoster}
          />
        )}
        {view === 'coaches' && (
          <CoachesView
            coaches={coaches}
            roster={roster}
            assignments={assignments}
            reviews={reviews}
            activity={activity}
            loading={loading}
            stableId={stableId}
            onReloadCoaches={loadCoaches}
            onReloadAssignments={loadAssignments}
            selectedCoachId={selectedCoachId}
            onSelectCoach={setSelectedCoachId}
            onOpenPlayer={(playerId) => {
              setView('home');
              setExpandedPlayerId(playerId);
            }}
          />
        )}
        {view === 'recruiting' && (
          <RecruitingView
            candidates={candidates}
            loading={loading}
            stableId={stableId}
            onReload={loadCandidates}
          />
        )}
        {view === 'review-room' && (
          <ReviewRoomView
            reviews={reviews}
            loading={loading}
            stableId={stableId}
            onReload={loadReviews}
          />
        )}
        {view === 'intelligence' && (
          <IntelligenceView roster={roster} activity={activity} loading={loading} />
        )}
        {view === 'library' && (
          <LibraryView stableId={stableId} />
        )}
        {view === 'publishing' && (
          <PublishingView stableId={stableId} />
        )}
        {view === 'earnings' && (
          <EarningsView
            earnings={earnings}
            totalGross={totalGross}
            totalFees={totalFees}
            totalStable={totalStable}
            totalPlayer={totalPlayer}
            loading={loading}
          />
        )}
        {view === 'business' && (
          <BusinessView stableId={stableId} />
        )}
        {view === 'chat' && account && (
          <div className="flex h-full items-center justify-center p-6">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-8 w-8 text-white/30" strokeWidth={1.5} />
              <p className="text-[12px] text-white/50">Chat channels are available in the floating widget at the bottom-right.</p>
              <p className="mt-1 text-[10px] text-white/30"># General, # Coaches, # Hand Review, # Announcements, # Recruiting</p>
            </div>
          </div>
        )}
        {view === 'paid-requests' && (
          <ErrorBoundary variant="widget">
            <PaidRequestsPanel userId={account?.id ?? ''} portalType="business" />
          </ErrorBoundary>
        )}
        {view === 'rolodex' && (
          <ErrorBoundary variant="widget">
            <IndustryRolodex viewerRole="stable-portal" />
          </ErrorBoundary>
        )}
        {view === 'people' && <PlaceholderView icon={Users} label="People Directory" />}
        {view === 'opportunities' && <PlaceholderView icon={BriefcaseBusiness} label="Opportunities" />}
        {view === 'marketplace' && <PlaceholderView icon={Building2} label="Marketplace" />}
        {view === 'privacy' && <PlaceholderView icon={FileCheck} label="Privacy Policy" />}
        {view === 'terms' && <PlaceholderView icon={FileCheck} label="Terms of Service" />}
        {view === 'settings' && <SettingsPage userId={account?.id} account={account} />}
        {!['home','coaches','review-room','intelligence','library','recruiting','publishing','earnings','business','chat','rolodex','people','opportunities','marketplace','privacy','terms','settings'].includes(view) && renderSharedPlayerView({ view, account, onNavigate: (v) => setView(v as StableView), profileInitialTab: profileTab })}
      </PortalRoomShell>
    </>
  );
}

// ── Roster Command Center (Home) ──────────────────────────────────

function RosterCommandCenter({
  roster, coaches, assignments, activity, loading,
  needsBaseline, needsAttention, pendingReviews, newCandidates,
  expandedPlayerId, onTogglePlayer, onNavigate,
  getCoachName, getPrimaryCoach, stableId, onReloadRoster,
}: {
  roster: StablePlayer[];
  coaches: StableCoach[];
  assignments: PlayerCoachAssignment[];
  activity: StableActivityItem[];
  loading: boolean;
  needsBaseline: StablePlayer[];
  needsAttention: StablePlayer[];
  pendingReviews: ReviewSubmission[];
  newCandidates: StableCandidate[];
  expandedPlayerId: string | null;
  onTogglePlayer: (id: string) => void;
  onNavigate: (v: StableView) => void;
  getCoachName: (id: string | null) => string | null;
  getPrimaryCoach: (playerId: string) => PlayerCoachAssignment | null;
  stableId: string | null;
  onReloadRoster: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-4 flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: GOLD_BORDER, background: 'rgba(10,12,14,0.62)', backdropFilter: 'blur(6px)' }}>
          <Home className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_SOFT }}>Stable Command Center</span>
        </div>
        <div className="flex items-center gap-2">
          {needsBaseline.length > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400/70">
              <AlertCircle size={10} /> {needsBaseline.length} need baseline
            </span>
          )}
          {needsAttention.length > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-red-400/20 bg-red-400/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-400/70">
              <AlertCircle size={10} /> {needsAttention.length} need attention
            </span>
          )}
          {pendingReviews.length > 0 && (
            <button onClick={() => onNavigate('review-room')} className="flex items-center gap-1 rounded-md border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f59e0b]/70 transition-colors hover:bg-[#f59e0b]/10">
              <Clock size={10} /> {pendingReviews.length} reviews pending
            </button>
          )}
          {newCandidates.length > 0 && (
            <button onClick={() => onNavigate('recruiting')} className="flex items-center gap-1 rounded-md border border-pink-400/20 bg-pink-400/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-pink-400/70 transition-colors hover:bg-pink-400/10">
              <Star size={10} /> {newCandidates.length} new candidates
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : roster.length === 0 ? (
        <EmptyState icon={Users} message="No players on the roster yet" subtext="Recruiting will surface candidates here" />
      ) : (
        <div className="space-y-1.5">
          {roster.map((player) => (
            <RosterRow
              key={player.id}
              player={player}
              expanded={expandedPlayerId === player.id}
              onToggle={() => onTogglePlayer(player.id)}
              coaches={coaches}
              assignments={assignments}
              activity={activity}
              getCoachName={getCoachName}
              getPrimaryCoach={getPrimaryCoach}
              stableId={stableId}
              onReloadRoster={onReloadRoster}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'flat' | 'unknown' }) {
  if (trend === 'up') return <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400"><ArrowUp size={11} /> Trending</span>;
  if (trend === 'down') return <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-400"><ArrowDown size={11} /> Declining</span>;
  if (trend === 'flat') return <span className="flex items-center gap-0.5 text-[10px] font-bold text-white/40"><ArrowFlat size={11} /> Stable</span>;
  return <span className="text-[10px] text-white/30">—</span>;
}

function RosterRow({
  player, expanded, onToggle, coaches, assignments, activity,
  getCoachName, getPrimaryCoach, stableId, onReloadRoster, onNavigate,
}: {
  player: StablePlayer;
  expanded: boolean;
  onToggle: () => void;
  coaches: StableCoach[];
  assignments: PlayerCoachAssignment[];
  activity: StableActivityItem[];
  getCoachName: (id: string | null) => string | null;
  getPrimaryCoach: (playerId: string) => PlayerCoachAssignment | null;
  stableId: string | null;
  onReloadRoster: () => void;
  onNavigate: (v: StableView) => void;
}) {
  const statusColor = player.status === 'active' ? '#4ade80' : player.status === 'warning' ? '#fbbf24' : '#f87171';
  const statusLabel = player.status === 'active' ? 'Active' : player.status === 'warning' ? 'Needs Review' : 'Inactive';
  const primaryAssignment = getPrimaryCoach(player.id);
  const coachName = primaryAssignment ? getCoachName(primaryAssignment.coach_id) ?? getCoachName(player.assigned_coach_id) : getCoachName(player.assigned_coach_id);
  const playerActivity = activity.filter(a => a.player_id === player.user_id);
  const trend = playerActivity.length > 2 ? 'up' : 'flat';

  return (
    <div
      className="overflow-hidden rounded-xl border transition-all"
      style={{ borderColor: expanded ? `${GOLD}30` : 'rgba(212,165,44,0.10)', background: 'rgba(12,10,10,0.82)', backdropFilter: 'blur(8px)' }}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold text-white/80"
          style={{ borderColor: `${GOLD}40`, background: `${GOLD}15` }}>
          {player.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12px] font-semibold text-white/90">{player.display_name}</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusColor }} />
            {!player.baseline_completed && (
              <span className="shrink-0 rounded bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-400/70">No Baseline</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/40">
            <span className="font-medium text-white/60">{player.game_type ?? '—'}</span>
            <span>·</span>
            <span>{player.stakes ?? '—'}</span>
            <span>·</span>
            <span>ABI <span className="font-semibold text-white/70">${player.abi.toFixed(0)}</span></span>
            {coachName && (
              <>
                <span>·</span>
                <span>Coach: <span className="font-medium text-white/60">{coachName}</span></span>
              </>
            )}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <TrendIndicator trend={trend} />
          <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: `${statusColor}15`, color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        {expanded ? <ChevronDown size={14} className="shrink-0 text-white/30" /> : <ChevronRight size={14} className="shrink-0 text-white/20" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] p-3">
          <ExpandedPlayerView
            player={player}
            coaches={coaches}
            assignments={assignments}
            activity={activity}
            getCoachName={getCoachName}
            getPrimaryCoach={getPrimaryCoach}
            stableId={stableId}
            onReloadRoster={onReloadRoster}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </div>
  );
}

// ── Expanded Player View ──────────────────────────────────────────

function ExpandedPlayerView({
  player, coaches, assignments, activity,
  getCoachName, getPrimaryCoach, stableId, onReloadRoster, onNavigate,
}: {
  player: StablePlayer;
  coaches: StableCoach[];
  assignments: PlayerCoachAssignment[];
  activity: StableActivityItem[];
  getCoachName: (id: string | null) => string | null;
  getPrimaryCoach: (playerId: string) => PlayerCoachAssignment | null;
  stableId: string | null;
  onReloadRoster: () => void;
  onNavigate: (v: StableView) => void;
}) {
  const [tab, setTab] = useState<'results' | 'activity' | 'analytics'>('analytics');
  const [tournaments, setTournaments] = useState<TournamentResult[]>([]);
  const [baseline, setBaseline] = useState<PlayerBaseline | null>(null);
  const [snapshots, setSnapshots] = useState<PlayerSnapshot[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      const [tourRes, baseRes, snapRes] = await Promise.all([
        supabase.from('stable_tournament_results').select('*').eq('player_id', player.user_id).order('tournament_date', { ascending: false }).limit(20),
        supabase.from('stable_player_baselines').select('*').eq('player_id', player.user_id).maybeSingle(),
        supabase.from('stable_player_snapshots').select('*').eq('player_id', player.user_id).order('captured_at', { ascending: true }),
      ]);
      setTournaments((tourRes.data ?? []) as TournamentResult[]);
      setBaseline((baseRes.data as PlayerBaseline | null) ?? null);
      setSnapshots((snapRes.data ?? []) as PlayerSnapshot[]);

      const mode = (player.game_type === 'mtt' ? 'mtt' : 'cash') as AnalyticsMode;
      const snap = await loadLatestSnapshot(player.user_id, mode);
      setCurrentSnapshot(snap);
      setLoadingData(false);
    })();
  }, [player.user_id, player.game_type]);

  const playerActivity = activity.filter(a => a.player_id === player.user_id);
  const playerAssignments = assignments.filter(a => a.player_id === player.id);
  const primaryAssignment = playerAssignments.find(a => a.is_primary) ?? playerAssignments[0] ?? null;
  const additionalCoaches = playerAssignments.filter(a => !a.is_primary);

  const currentBB = currentSnapshot?.summary?.bb_per_100 ?? snapshots.find(s => s.snapshot_type === 'current')?.bb_per_100 ?? null;
  const baselineBB = baseline?.bb_per_100 ?? snapshots.find(s => s.snapshot_type === 'baseline')?.bb_per_100 ?? null;
  const bbChange = currentBB != null && baselineBB != null ? currentBB - baselineBB : null;

  const currentStats = currentSnapshot?.summary ?? {};
  const baselineStats = baseline?.key_stats ?? {};

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-3 flex items-center gap-1">
        {(['analytics', 'results', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest transition-colors"
            style={tab === t ? { background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT } : { color: 'rgba(255,255,255,0.3)' }}
          >
            {t === 'analytics' ? 'Analytics & Trend' : t === 'results' ? 'Tournament Results' : 'SpotVault Activity'}
          </button>
        ))}
      </div>

      {/* Coach info */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Primary Coach:</span>
        {primaryAssignment ? (
          <button
            onClick={() => onNavigate('coaches')}
            className="flex items-center gap-1 rounded-md border border-[#d4a52c]/20 bg-[#d4a52c]/5 px-2 py-1 text-[10px] font-semibold text-[#f5e6b0] transition-colors hover:bg-[#d4a52c]/10"
          >
            <GraduationCap size={11} /> {getCoachName(primaryAssignment.coach_id) ?? 'Coach'}
          </button>
        ) : (
          <span className="text-[10px] text-white/30">Unassigned</span>
        )}
        {additionalCoaches.length > 0 && (
          <>
            <span className="text-[10px] text-white/40">· Additional:</span>
            {additionalCoaches.map(ac => (
              <span key={ac.id} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-white/50">
                {getCoachName(ac.coach_id) ?? 'Coach'}
              </span>
            ))}
          </>
        )}
        <span className="ml-auto text-[10px] text-white/30">
          Joined: {player.join_date ?? '—'} · {player.screen_names.length > 0 ? player.screen_names.join(', ') : 'No screen names'}
        </span>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-white/30" />
        </div>
      ) : tab === 'analytics' ? (
        <AnalyticsTab
          player={player}
          baseline={baseline}
          snapshots={snapshots}
          currentSnapshot={currentSnapshot}
          currentBB={currentBB}
          baselineBB={baselineBB}
          bbChange={bbChange}
          currentStats={currentStats}
          baselineStats={baselineStats}
          stableId={stableId}
          onReloadRoster={onReloadRoster}
        />
      ) : tab === 'results' ? (
        <TournamentResultsTab tournaments={tournaments} />
      ) : (
        <SpotVaultActivityTab activity={playerActivity} />
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────

function AnalyticsTab({
  player, baseline, snapshots, currentSnapshot,
  currentBB, baselineBB, bbChange, currentStats, baselineStats,
  stableId, onReloadRoster,
}: {
  player: StablePlayer;
  baseline: PlayerBaseline | null;
  snapshots: PlayerSnapshot[];
  currentSnapshot: AnalyticsSnapshot | null;
  currentBB: number | null;
  baselineBB: number | null;
  bbChange: number | null;
  currentStats: Record<string, number>;
  baselineStats: Record<string, number>;
  stableId: string | null;
  onReloadRoster: () => void;
}) {
  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [baselineBBInput, setBaselineBBInput] = useState('');
  const [baselineSample, setBaselineSample] = useState('');
  const [baselineNotes, setBaselineNotes] = useState('');
  const [savingBaseline, setSavingBaseline] = useState(false);

  const trend = bbChange != null ? (bbChange > 0.5 ? 'up' : bbChange < -0.5 ? 'down' : 'flat') : 'unknown';
  const sampleSize = currentSnapshot?.source_hand_count ?? 0;

  const keyStatKeys = ['vpip', 'pfr', 'three_bet', 'cbet_flop', 'wtsd'];
  const statLabels: Record<string, string> = {
    vpip: 'VPIP', pfr: 'PFR', three_bet: '3-Bet', cbet_flop: 'Flop C-Bet', wtsd: 'WTSD',
  };

  const saveBaseline = async () => {
    if (!stableId || !player.user_id) return;
    setSavingBaseline(true);
    await supabase.from('stable_player_baselines').insert({
      stable_id: stableId,
      player_id: player.user_id,
      bb_per_100: baselineBBInput ? parseFloat(baselineBBInput) : null,
      sample_size: baselineSample ? parseInt(baselineSample) : 0,
      notes: baselineNotes || null,
      key_stats: {},
    });
    await supabase.from('stable_players').update({ baseline_completed: true }).eq('id', player.id);
    await supabase.from('stable_player_snapshots').insert({
      stable_id: stableId,
      player_id: player.user_id,
      snapshot_type: 'baseline',
      bb_per_100: baselineBBInput ? parseFloat(baselineBBInput) : null,
      sample_size: baselineSample ? parseInt(baselineSample) : 0,
      volume_hands: player.volume_hands,
      key_stats: {},
    });
    setSavingBaseline(false);
    setShowBaselineForm(false);
    onReloadRoster();
  };

  return (
    <div className="space-y-3">
      {/* Baseline status */}
      {!player.baseline_completed && !showBaselineForm && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
          <AlertCircle size={16} className="shrink-0 text-amber-400/70" />
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-amber-400/80">Analytics baseline required</p>
            <p className="text-[10px] text-white/40">This player is not fully onboarded. Capture their starting baseline to begin tracking improvement.</p>
          </div>
          <button
            onClick={() => setShowBaselineForm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 transition-all hover:scale-105"
          >
            <Upload size={11} /> Submit Baseline
          </button>
        </div>
      )}

      {showBaselineForm && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Analytics Baseline Submission</h4>
          <p className="mb-3 text-[10px] text-white/40">Capture the player's starting point. This baseline is timestamped and preserved — it will never be overwritten by future data.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-white/40">Starting BB/100</label>
              <input
                type="number"
                value={baselineBBInput}
                onChange={e => setBaselineBBInput(e.target.value)}
                placeholder="e.g. -2.5"
                step="0.1"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-white/40">Sample Size</label>
              <input
                type="number"
                value={baselineSample}
                onChange={e => setBaselineSample(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-white/40">Notes</label>
              <input
                type="text"
                value={baselineNotes}
                onChange={e => setBaselineNotes(e.target.value)}
                placeholder="Source / material reference"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveBaseline}
              disabled={savingBaseline}
              className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#f5e6b0] transition-all hover:scale-105 disabled:opacity-50"
            >
              {savingBaseline ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Save Baseline
            </button>
            <button
              onClick={() => setShowBaselineForm(false)}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors hover:text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Improvement summary */}
      {player.baseline_completed && baseline && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={13} style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Since Joining Stable</span>
            <span className="text-[9px] text-white/30">Baseline: {new Date(baseline.captured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Starting BB/100</p>
              <p className="mt-0.5 text-[14px] font-bold text-white/70">{baselineBB != null ? baselineBB.toFixed(1) : '—'}</p>
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Current BB/100</p>
              <p className="mt-0.5 text-[14px] font-bold text-white/70">{currentBB != null ? currentBB.toFixed(1) : '—'}</p>
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Change</p>
              <p className="mt-0.5 text-[14px] font-bold" style={{ color: bbChange != null ? (bbChange > 0 ? '#4ade80' : bbChange < 0 ? '#f87171' : 'rgba(255,255,255,0.7)') : 'rgba(255,255,255,0.4)' }}>
                {bbChange != null ? `${bbChange > 0 ? '+' : ''}${bbChange.toFixed(1)}` : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Sample Size</p>
              <p className="mt-0.5 text-[14px] font-bold text-white/70">{sampleSize.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-white/40">Trend:</span>
            <TrendIndicator trend={trend} />
            <span className="text-[9px] text-white/25">· {snapshots.length} snapshots recorded</span>
          </div>
        </div>
      )}

      {/* Key stats comparison */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Key Statistics — Baseline vs Current</h4>
        {Object.keys(currentStats).length === 0 && Object.keys(baselineStats).length === 0 ? (
          <p className="py-3 text-center text-[10px] text-white/25">No analytics data available yet. Analytics will appear when the player imports hand histories.</p>
        ) : (
          <div className="space-y-1.5">
            {keyStatKeys.map(key => {
              const baseVal = baselineStats[key];
              const currVal = currentStats[key];
              if (baseVal == null && currVal == null) return null;
              const diff = baseVal != null && currVal != null ? currVal - baseVal : null;
              return (
                <div key={key} className="flex items-center gap-3 rounded-md border border-white/[0.03] bg-black/20 px-2.5 py-1.5">
                  <span className="w-20 shrink-0 text-[10px] font-semibold text-white/60">{statLabels[key] ?? key}</span>
                  <span className="w-14 text-right text-[11px] text-white/40">{baseVal != null ? `${baseVal.toFixed(1)}%` : '—'}</span>
                  <ArrowRight size={11} className="text-white/20" />
                  <span className="w-14 text-right text-[11px] font-bold text-white/80">{currVal != null ? `${currVal.toFixed(1)}%` : '—'}</span>
                  {diff != null && (
                    <span className="text-[10px] font-bold" style={{ color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical snapshots timeline */}
      {snapshots.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Historical Snapshots</h4>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {snapshots.map((snap, i) => (
              <div key={snap.id} className="flex items-center gap-1">
                <div className="flex flex-col items-center rounded-md border border-white/[0.04] bg-black/20 px-2.5 py-1.5">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">{snap.snapshot_type}</span>
                  <span className="text-[10px] font-bold text-white/70">{snap.bb_per_100 != null ? snap.bb_per_100.toFixed(1) : '—'}</span>
                  <span className="text-[8px] text-white/25">{new Date(snap.captured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                {i < snapshots.length - 1 && <div className="h-px w-4 bg-white/10" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graph placeholder */}
      {currentSnapshot && currentSnapshot.graph_series && currentSnapshot.graph_series.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Profit Graph</h4>
          <MiniGraph series={currentSnapshot.graph_series} />
        </div>
      )}
    </div>
  );
}

function MiniGraph({ series }: { series: { index: number; profit: number }[] }) {
  if (series.length < 2) return <p className="py-3 text-center text-[10px] text-white/25">Not enough data for graph</p>;
  const profits = series.map(s => s.profit);
  const min = Math.min(...profits);
  const max = Math.max(...profits);
  const range = max - min || 1;
  const width = 100;
  const height = 40;
  const points = series.map((s, i) => {
    const x = (i / (series.length - 1)) * width;
    const y = height - ((s.profit - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={GOLD} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.06)" strokeWidth="0.3" strokeDasharray="1,1" />
    </svg>
  );
}

// ── Tournament Results Tab ────────────────────────────────────────

function TournamentResultsTab({ tournaments }: { tournaments: TournamentResult[] }) {
  if (tournaments.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="py-4 text-center text-[10px] text-white/25">No tournament results imported yet. Results will appear when the player imports tournament summaries.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {tournaments.map(t => {
        const profit = t.profit_cents;
        const cashed = t.prize_cents > 0;
        return (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: cashed ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)', background: cashed ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.02)' }}>
              <Trophy size={14} style={{ color: cashed ? '#4ade80' : 'rgba(255,255,255,0.2)' }} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-white/80">{t.tournament_name ?? 'Tournament'}</p>
              <p className="text-[10px] text-white/40">
                {new Date(t.tournament_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {t.site && ` · ${t.site}`}
                {` · $${(t.buy_in_cents / 100).toFixed(0)} buy-in`}
                {t.field_size && ` · ${t.field_size.toLocaleString()} entries`}
              </p>
            </div>
            <div className="text-right">
              {t.finish_position && (
                <p className="text-[10px] text-white/40">Finish: <span className="font-semibold text-white/70">{ordinal(t.finish_position)}</span></p>
              )}
              <p className="text-[11px] font-bold" style={{ color: profit > 0 ? '#4ade80' : profit < 0 ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
                {profit > 0 ? '+' : ''}{(profit / 100).toFixed(2)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// ── SpotVault Activity Tab ───────────────────────────────────────

function SpotVaultActivityTab({ activity }: { activity: StableActivityItem[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="py-4 text-center text-[10px] text-white/25">No recent SpotVault activity. Hands uploaded, study sessions, solver usage, and content consumed will appear here.</p>
      </div>
    );
  }
  const iconMap: Record<string, typeof Users> = {
    hand_upload: Upload,
    hand_review: FileCheck,
    solver_session: Target,
    hh_replayer: Activity,
    study_session: BookOpen,
    course_consumed: BookOpen,
    note_created: FileCheck,
    content_shared: Newspaper,
    coaching_interaction: GraduationCap,
  };
  return (
    <div className="space-y-1.5">
      {activity.slice(0, 15).map(a => {
        const Icon = iconMap[a.activity_type] ?? Activity;
        return (
          <div key={a.id} className="flex items-start gap-2.5 rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
              <Icon size={11} style={{ color: GOLD }} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-white/70">{a.description}</p>
              <p className="text-[9px] text-white/25">{timeAgo(a.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Coaches View ──────────────────────────────────────────────────

function CoachesView({
  coaches, roster, assignments, reviews, activity, loading,
  stableId, onReloadCoaches, onReloadAssignments,
  selectedCoachId, onSelectCoach, onOpenPlayer,
}: {
  coaches: StableCoach[];
  roster: StablePlayer[];
  assignments: PlayerCoachAssignment[];
  reviews: ReviewSubmission[];
  activity: StableActivityItem[];
  loading: boolean;
  stableId: string | null;
  onReloadCoaches: () => void;
  onReloadAssignments: () => void;
  selectedCoachId: string | null;
  onSelectCoach: (id: string | null) => void;
  onOpenPlayer: (playerId: string) => void;
}) {
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachSpecialty, setNewCoachSpecialty] = useState('');
  const [savingCoach, setSavingCoach] = useState(false);

  const addCoach = async () => {
    if (!stableId || !newCoachName.trim()) return;
    setSavingCoach(true);
    const { data: membership } = await supabase
      .from('stable_members')
      .select('user_id')
      .eq('stable_id', stableId)
      .limit(1)
      .maybeSingle();
    await supabase.from('stable_coaches').insert({
      stable_id: stableId,
      user_id: membership?.user_id ?? crypto.randomUUID(),
      display_name: newCoachName.trim(),
      role_specialty: newCoachSpecialty.trim() || null,
    });
    setSavingCoach(false);
    setNewCoachName('');
    setNewCoachSpecialty('');
    setShowAddCoach(false);
    onReloadCoaches();
  };

  if (loading) return <LoadingState />;

  const selectedCoach = coaches.find(c => c.id === selectedCoachId);

  const getCoachPlayers = (coachId: string) => {
    const coachAssignments = assignments.filter(a => a.coach_id === coachId);
    return coachAssignments.map(a => roster.find(p => p.id === a.player_id)).filter(Boolean) as StablePlayer[];
  };

  const getCoachWorkload = (coachId: string) => {
    const coachPlayers = getCoachPlayers(coachId);
    const playerIds = new Set(coachPlayers.map(p => p.user_id));
    const pendingReviewCount = reviews.filter(r => r.status === 'pending' && playerIds.has(r.player_id)).length;
    const recentActivityCount = activity.filter(a => a.player_id && playerIds.has(a.player_id) && a.activity_type === 'coaching_interaction').length;
    return { playerCount: coachPlayers.length, pendingReviews: pendingReviewCount, recentActivity: recentActivityCount };
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={GraduationCap} title="Coaches" subtitle={`${coaches.length} coaches`} />

      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setShowAddCoach(!showAddCoach)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
          style={{ borderColor: GOLD_BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.08)' }}
        >
          <Plus size={12} /> Add Coach
        </button>
      </div>

      {showAddCoach && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-white/40">Display Name</label>
              <input
                type="text"
                value={newCoachName}
                onChange={e => setNewCoachName(e.target.value)}
                placeholder="e.g. Sarah M."
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-white/40">Role / Specialty</label>
              <input
                type="text"
                value={newCoachSpecialty}
                onChange={e => setNewCoachSpecialty(e.target.value)}
                placeholder="e.g. MTT Coach"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
              />
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={addCoach} disabled={savingCoach || !newCoachName.trim()} className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#f5e6b0] transition-all hover:scale-105 disabled:opacity-50">
              {savingCoach ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Save
            </button>
            <button onClick={() => setShowAddCoach(false)} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70">Cancel</button>
          </div>
        </div>
      )}

      {selectedCoach ? (
        <CoachDetailPanel
          coach={selectedCoach}
          players={getCoachPlayers(selectedCoach.id)}
          workload={getCoachWorkload(selectedCoach.id)}
          onBack={() => onSelectCoach(null)}
          onOpenPlayer={onOpenPlayer}
          roster={roster}
          assignments={assignments}
          stableId={stableId}
          onReloadAssignments={onReloadAssignments}
        />
      ) : (
        <div className="space-y-2">
          {coaches.length === 0 ? (
            <EmptyState icon={GraduationCap} message="No coaches added yet" subtext="Add coaches to assign players and track workload" />
          ) : (
            coaches.map(coach => {
              const workload = getCoachWorkload(coach.id);
              const coachPlayers = getCoachPlayers(coach.id);
              return (
                <button
                  key={coach.id}
                  onClick={() => onSelectCoach(coach.id)}
                  className="group w-full rounded-xl border p-3 text-left transition-all hover:scale-[1.01]"
                  style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(12,10,10,0.82)', backdropFilter: 'blur(8px)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-white/80"
                      style={{ borderColor: `${GOLD}40`, background: `${GOLD}15` }}>
                      {coach.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-white/90">{coach.display_name}</p>
                      <p className="text-[10px] text-white/40">{coach.role_specialty ?? 'Coach'}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-white/50">{workload.playerCount} players</span>
                      {workload.pendingReviews > 0 && (
                        <span className="flex items-center gap-1 text-amber-400/70"><Clock size={10} /> {workload.pendingReviews}</span>
                      )}
                      <ChevronRight size={14} className="text-white/20 group-hover:text-white/40" />
                    </div>
                  </div>
                  {coachPlayers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {coachPlayers.slice(0, 5).map(p => (
                        <span key={p.id} className="rounded-md border border-white/[0.04] bg-white/[0.02] px-1.5 py-0.5 text-[9px] text-white/50">{p.display_name}</span>
                      ))}
                      {coachPlayers.length > 5 && <span className="px-1.5 py-0.5 text-[9px] text-white/30">+{coachPlayers.length - 5} more</span>}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function CoachDetailPanel({
  coach, players, workload, onBack, onOpenPlayer,
  roster, assignments, stableId, onReloadAssignments,
}: {
  coach: StableCoach;
  players: StablePlayer[];
  workload: { playerCount: number; pendingReviews: number; recentActivity: number };
  onBack: () => void;
  onOpenPlayer: (playerId: string) => void;
  roster: StablePlayer[];
  assignments: PlayerCoachAssignment[];
  stableId: string | null;
  onReloadAssignments: () => void;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [assignPlayerId, setAssignPlayerId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);

  const unassignedPlayers = roster.filter(p => !assignments.some(a => a.coach_id === coach.id && a.player_id === p.id));

  const assignPlayer = async () => {
    if (!stableId || !assignPlayerId) return;
    await supabase.from('stable_player_coaches').insert({
      stable_id: stableId,
      player_id: assignPlayerId,
      coach_id: coach.id,
      is_primary: isPrimary,
      role: 'coach',
    });
    if (isPrimary) {
      await supabase.from('stable_player_coaches')
        .update({ is_primary: false })
        .eq('player_id', assignPlayerId)
        .neq('coach_id', coach.id);
    }
    setAssignPlayerId('');
    setIsPrimary(true);
    setShowAssign(false);
    onReloadAssignments();
  };

  const removeAssignment = async (playerId: string) => {
    await supabase.from('stable_player_coaches')
      .delete()
      .eq('player_id', playerId)
      .eq('coach_id', coach.id);
    onReloadAssignments();
  };

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(12,10,10,0.82)', backdropFilter: 'blur(8px)' }}>
      <button onClick={onBack} className="mb-3 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
        <ChevronRight size={14} className="rotate-180" /> Back to Coaches
      </button>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border text-[14px] font-bold text-white/80"
          style={{ borderColor: `${GOLD}40`, background: `${GOLD}15` }}>
          {coach.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-white">{coach.display_name}</h2>
          <p className="text-[11px] text-white/40">{coach.role_specialty ?? 'Coach'}</p>
        </div>
      </div>

      {/* Workload */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatBox label="Players Assigned" value={workload.playerCount.toString()} />
        <StatBox label="Reviews Pending" value={workload.pendingReviews.toString()} accent={workload.pendingReviews > 0 ? '#f59e0b' : undefined} />
        <StatBox label="Recent Activity" value={workload.recentActivity.toString()} />
      </div>

      {/* Assigned players */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50">Assigned Players</h3>
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/50 transition-colors hover:text-white/80"
          >
            <Plus size={10} /> Assign Player
          </button>
        </div>

        {showAssign && unassignedPlayers.length > 0 && (
          <div className="mb-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <select
              value={assignPlayerId}
              onChange={e => setAssignPlayerId(e.target.value)}
              className="mb-2 w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-[#c0911e]/35"
            >
              <option value="">Select a player...</option>
              {unassignedPlayers.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
            <label className="mb-2 flex items-center gap-2 text-[10px] text-white/50">
              <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="accent-amber-500" />
              Set as primary coach
            </label>
            <button onClick={assignPlayer} disabled={!assignPlayerId} className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#f5e6b0] transition-all hover:scale-105 disabled:opacity-50">
              <CheckCircle2 size={11} /> Confirm Assignment
            </button>
          </div>
        )}

        {players.length === 0 ? (
          <p className="py-3 text-center text-[10px] text-white/25">No players assigned to this coach</p>
        ) : (
          <div className="space-y-1.5">
            {players.map(p => {
              const assignment = assignments.find(a => a.player_id === p.id && a.coach_id === coach.id);
              return (
                <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
                  <button onClick={() => onOpenPlayer(p.id)} className="flex flex-1 items-center gap-2.5 text-left">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold text-white/80"
                      style={{ borderColor: `${GOLD}40`, background: `${GOLD}15` }}>
                      {p.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-white/80">{p.display_name}</p>
                      <p className="text-[10px] text-white/40">{p.game_type ?? '—'} · ${p.abi.toFixed(0)} ABI</p>
                    </div>
                  </button>
                  {assignment?.is_primary && <span className="rounded bg-[#d4a52c]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#f5e6b0]">Primary</span>}
                  <button onClick={() => removeAssignment(p.id)} className="rounded-md p-1 text-white/30 transition-colors hover:text-red-400/70" title="Remove assignment">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recruiting View ───────────────────────────────────────────────

function RecruitingView({ candidates, loading, stableId, onReload }: {
  candidates: StableCandidate[];
  loading: boolean;
  stableId: string | null;
  onReload: () => void;
}) {
  const [pipelineFilter, setPipelineFilter] = useState<'all' | 'new' | 'contacted' | 'interviewing' | 'offer' | 'passed'>('all');
  const filtered = pipelineFilter === 'all' ? candidates : candidates.filter(c => c.status === pipelineFilter);

  const updateStatus = async (candidateId: string, status: string) => {
    await supabase.from('stable_candidates').update({ status, updated_at: new Date().toISOString() }).eq('id', candidateId);
    onReload();
  };

  if (loading) return <LoadingState />;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={BriefcaseBusiness} title="Recruiting" subtitle={`${candidates.length} candidates`} />
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
        {(['all', 'new', 'contacted', 'interviewing', 'offer', 'passed'] as const).map(stage => (
          <button
            key={stage}
            onClick={() => setPipelineFilter(stage)}
            className="rounded-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest transition-colors"
            style={pipelineFilter === stage ? { background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT } : { color: 'rgba(255,255,255,0.3)' }}
          >
            {stage === 'all' ? 'All' : stage === 'offer' ? 'Offer Made' : stage.charAt(0).toUpperCase() + stage.slice(1)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={BriefcaseBusiness} message="No candidates in this stage" subtext="SpotVault will auto-surface matching players here" />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} onUpdate={updateStatus} />)}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate, onUpdate }: { candidate: StableCandidate; onUpdate: (id: string, status: string) => void }) {
  const scoreColor = candidate.match_score >= 70 ? '#4ade80' : candidate.match_score >= 50 ? '#fbbf24' : '#f87171';
  const statusColor = candidate.status === 'new' ? '#60a5fa' : candidate.status === 'contacted' ? '#fbbf24' : candidate.status === 'interviewing' ? '#a78bfa' : candidate.status === 'offer' ? '#34d399' : '#6b7280';

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(12,10,10,0.82)', backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center justify-between">
        <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: `${statusColor}15`, color: statusColor }}>{candidate.status}</span>
        <div className="flex items-center gap-1">
          <Star size={11} style={{ color: scoreColor }} fill={scoreColor} />
          <span className="text-[10px] font-bold" style={{ color: scoreColor }}>{candidate.match_score}</span>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-[12px] font-semibold text-white/90">Player {candidate.user_id.slice(0, 8)}</p>
        <p className="mt-0.5 text-[10px] text-white/40">{candidate.notes ?? 'No notes'}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {candidate.status === 'new' && (
          <button onClick={() => onUpdate(candidate.id, 'contacted')} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ borderColor: GOLD_BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.08)' }}>
            <Mail size={10} /> Contact
          </button>
        )}
        {candidate.status === 'contacted' && (
          <button onClick={() => onUpdate(candidate.id, 'interviewing')} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ borderColor: GOLD_BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.08)' }}>
            Interview
          </button>
        )}
        {candidate.status === 'interviewing' && (
          <>
            <button onClick={() => onUpdate(candidate.id, 'offer')} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}>
              <CheckCircle2 size={10} /> Offer
            </button>
            <button onClick={() => onUpdate(candidate.id, 'passed')} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ borderColor: 'rgba(248,113,113,0.3)', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}>
              <XCircle size={10} /> Pass
            </button>
          </>
        )}
        {candidate.status === 'offer' && (
          <button onClick={() => onUpdate(candidate.id, 'accepted')} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}>
            <UserPlus size={10} /> Accept to Roster
          </button>
        )}
        {candidate.status !== 'passed' && candidate.status !== 'accepted' && (
          <button onClick={() => onUpdate(candidate.id, 'passed')} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-all hover:scale-105" style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
            Pass
          </button>
        )}
      </div>
    </div>
  );
}

// ── Review Room ───────────────────────────────────────────────────

function ReviewRoomView({ reviews, loading, stableId, onReload }: {
  reviews: ReviewSubmission[];
  loading: boolean;
  stableId: string | null;
  onReload: () => void;
}) {
  const [selectedReview, setSelectedReview] = useState<ReviewSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const respond = async (reviewId: string) => {
    await supabase.from('stable_review_submissions').update({
      status: 'responded',
      review_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
    }).eq('id', reviewId);
    setReviewNotes('');
    setSelectedReview(null);
    onReload();
  };

  if (loading) return <LoadingState />;

  if (selectedReview) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <button onClick={() => setSelectedReview(null)} className="mb-3 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
          <ChevronRight size={14} className="rotate-180" /> Back to Review Queue
        </button>
        <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(12,10,10,0.82)', backdropFilter: 'blur(8px)' }}>
          <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            {selectedReview.submission_type}
          </span>
          <h2 className="mt-2 text-[14px] font-bold text-white">{selectedReview.title ?? 'Untitled submission'}</h2>
          {selectedReview.body && <p className="mt-2 text-[11px] leading-relaxed text-white/70">{selectedReview.body}</p>}
          <div className="mt-4">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-white/40">Review Notes</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Write your review response..."
              rows={4}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#c0911e]/35"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => respond(selectedReview.id)} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105" style={{ borderColor: GOLD_BORDER, color: GOLD_SOFT, background: 'rgba(192,145,30,0.1)' }}>
              <CheckCircle2 size={12} /> Respond to Player
            </button>
            <button onClick={() => { void supabase.from('stable_review_submissions').update({ status: 'complete' }).eq('id', selectedReview.id); setSelectedReview(null); onReload(); }} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105" style={{ borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}>
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={FileCheck} title="Review Room" subtitle={`${reviews.filter(r => r.status === 'pending').length} pending`} />
      {reviews.length === 0 ? (
        <EmptyState icon={FileCheck} message="No submissions yet" subtext="Players can send hands and notes from their Player Portal" />
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <button
              key={review.id}
              onClick={() => { setSelectedReview(review); setReviewNotes(''); }}
              className="group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:scale-[1.01]"
              style={{ borderColor: review.status === 'pending' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', background: 'rgba(12,10,10,0.82)', backdropFilter: 'blur(8px)' }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(192,145,30,0.08)' }}>
                <FileCheck size={14} style={{ color: GOLD }} strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12px] font-semibold text-white/90">{review.title ?? 'Untitled'}</span>
                  <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{
                    background: review.status === 'pending' ? 'rgba(245,158,11,0.15)' : review.status === 'responded' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
                    color: review.status === 'pending' ? '#f59e0b' : review.status === 'responded' ? '#4ade80' : 'rgba(255,255,255,0.4)',
                  }}>
                    {review.status}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-white/40">{review.submission_type} · {timeAgo(review.created_at)}</p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-white/20 group-hover:text-white/40" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Intelligence View ─────────────────────────────────────────────

function IntelligenceView({ roster, activity, loading }: { roster: StablePlayer[]; activity: StableActivityItem[]; loading: boolean }) {
  if (loading) return <LoadingState />;
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={Activity} title="Stable Intelligence" subtitle="Development tracking & insights" />
      <div className="mb-3 rounded-xl border p-3" style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(12,10,10,0.82)', backdropFilter: 'blur(8px)' }}>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Development Score</h3>
        <p className="text-[10px] leading-relaxed text-white/50">
          The Development Score measures observable activity through SpotVault: hands reviewed, study sessions,
          solver usage, HH Replayer usage, notes created, content consumed, and coaching interactions.
          It does not measure effort — only measurable development activity.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {roster.map((player) => {
          const playerActivity = activity.filter(a => a.player_id === player.user_id);
          const score = Math.min(100, playerActivity.length * 15);
          return (
            <div key={player.id} className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(12,10,10,0.72)', backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-white/90">{player.display_name}</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${score}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: GOLD_SOFT }}>{score}</span>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/40">
                <Activity size={10} /> {playerActivity.length} recent activities
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Library View ──────────────────────────────────────────────────

function LibraryView({ stableId }: { stableId: string | null }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={Library} title="Stable Library" subtitle="Internal resources & learning material" />
      <EmptyState icon={Library} message="No resources uploaded yet" subtext="Upload strategy material, hand packs, and courses for your roster" />
    </div>
  );
}

// ── Publishing View ───────────────────────────────────────────────

function PublishingView({ stableId }: { stableId: string | null }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={Newspaper} title="Publishing" subtitle="Publish resources to the SpotVault community" />
      <EmptyState icon={Newspaper} message="No published content yet" subtext="Publish courses, videos, and strategy material to the marketplace" />
    </div>
  );
}

// ── Earnings View ─────────────────────────────────────────────────

function EarningsView({ earnings, totalGross, totalFees, totalStable, totalPlayer, loading }: {
  earnings: StableEarning[];
  totalGross: number;
  totalFees: number;
  totalStable: number;
  totalPlayer: number;
  loading: boolean;
}) {
  if (loading) return <LoadingState />;
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={DollarSign} title="Earnings & Makeup" subtitle="Content revenue ledger" />
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Gross Sales" value={`$${(totalGross / 100).toFixed(2)}`} />
        <StatBox label="SpotVault Fees" value={`$${(totalFees / 100).toFixed(2)}`} accent="#f87171" />
        <StatBox label="Stable Proceeds" value={`$${(totalStable / 100).toFixed(2)}`} accent="#4ade80" />
        <StatBox label="Player Share" value={`$${(totalPlayer / 100).toFixed(2)}`} accent="#60a5fa" />
      </div>
      {earnings.length === 0 ? (
        <EmptyState icon={DollarSign} message="No transactions yet" subtext="Content sales will appear here" />
      ) : (
        <div className="space-y-2">
          {earnings.map((e) => (
            <div key={e.id} className="rounded-lg border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(12,10,10,0.72)', backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-white/90">{e.description ?? e.transaction_type}</span>
                <span className="text-[10px] text-white/30">{timeAgo(e.created_at)}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px]">
                <span className="text-white/50">Gross: <span className="font-semibold text-white/70">${(e.gross_cents / 100).toFixed(2)}</span></span>
                <span className="text-red-400/50">Fee: ${(e.spotvault_fee_cents / 100).toFixed(2)}</span>
                <span className="text-emerald-400/60">Stable: ${(e.stable_proceeds_cents / 100).toFixed(2)}</span>
                <span className="text-blue-400/60">Player: ${(e.player_share_cents / 100).toFixed(2)}</span>
                <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: 'rgba(212,165,44,0.12)', color: GOLD_SOFT }}>{e.treatment}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Business View ────────────────────────────────────────────────

function BusinessView({ stableId }: { stableId: string | null }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <SectionHeader icon={Building2} title="Stable Business" subtitle="Organization administration" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(12,10,10,0.72)', backdropFilter: 'blur(8px)' }}>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Stable Profile</h3>
          <p className="text-[10px] text-white/40">Manage your stable's public profile and description.</p>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(12,10,10,0.72)', backdropFilter: 'blur(8px)' }}>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Seat Management</h3>
          <p className="text-[10px] text-white/40">$30/month per player seat. Manage billing and active seats.</p>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(12,10,10,0.72)', backdropFilter: 'blur(8px)' }}>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Staff & Permissions</h3>
          <p className="text-[10px] text-white/40">Owner, Admin, Manager, Coach, Reviewer, Recruiter roles.</p>
        </div>
        <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(12,10,10,0.72)', backdropFilter: 'blur(8px)' }}>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/50">Commercial Arrangements</h3>
          <p className="text-[10px] text-white/40">Stable Creator agreements, profit splits, and marketplace settings.</p>
        </div>
      </div>
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Users; title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex shrink-0 items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: GOLD_BORDER, background: 'rgba(10,12,14,0.62)', backdropFilter: 'blur(6px)' }}>
        <Icon className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_SOFT }}>{title}</span>
      </div>
      <span className="text-[10px] text-white/30">{subtitle}</span>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold" style={{ color: accent ?? 'rgba(255,255,255,0.9)' }}>{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-white/30" />
    </div>
  );
}

function EmptyState({ icon: Icon, message, subtext }: { icon: typeof Users; message: string; subtext: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={28} className="mb-2 text-white/15" strokeWidth={1.5} />
      <p className="text-[12px] text-white/40">{message}</p>
      <p className="mt-1 text-[10px] text-white/25">{subtext}</p>
    </div>
  );
}

function PlaceholderView({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Icon size={28} className="mx-auto mb-2 text-white/15" strokeWidth={1.5} />
        <p className="text-[12px] text-white/40">{label}</p>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
