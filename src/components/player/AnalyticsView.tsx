import { useState, useCallback, useEffect, useRef, useMemo, type DragEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3, UploadCloud, CheckCircle2, AlertTriangle,
  X, RefreshCw, TrendingUp, Zap, MapPin,
  Loader2, Trash2, Eye, Plus, EyeOff,
  Info, Database, ChevronDown, type LucideIcon,
} from 'lucide-react';
import {
  importPokerFiles, loadImportHistory, loadLatestSnapshot, loadDataStatus, loadDemoSnapshot,
  DEMO_ANALYTICS_USER_ID,
  recalculateAnalytics, detectHandMode, rebuildAnalyticsFromRawHands, clearAllAnalyticsData,
  getActiveAnalyticsJob,
  type RecalcResult,
  type ImportProgress, type ImportBatch, type AnalyticsSnapshot, type AnalyticsMode,
  type RegressionReport,
} from '@/lib/pokerAnalytics';
import { CumulativeLineGraph, graphSeriesToPoints } from '@/components/player/CumulativeLineGraph';
import { HandAnalyzer } from '@/components/player/HandAnalyzer';
import {
  OverviewTab, PreflopTab, FlopTab, TurnTab, RiverTab,
  PositionsTab, StartingHandsTab, BoardTab,
  computeTrends, AnalyticsSviSummary,
  ImportImpactModal, type ImportImpactData,
  type KeyStatsStreet,
} from '@/components/player/AnalyticsTabs';
import { TournamentLibraryTab } from '@/components/player/TournamentLibraryTab';
import { AICoachShell } from '@/components/player/AICoachShell';
import { AnalyticsActivityPanel, type ActivityPanelStatus } from '@/components/player/AnalyticsActivityPanel';
import { logAnalyticsActivity } from '@/lib/analyticsActivityStore';
import { invalidateCachedSnapshot } from '@/lib/analyticsSnapshotCache';
import { isStaffOrAdmin, type SpotVaultAccount } from '@/types';


const GOLD = 'var(--portal-accent, #d4a52c)';
const GOLD_SOFT = 'var(--portal-accent-soft, #f5e6b0)';
const BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.18)';
const BORDER_STRONG = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.4)';
const ANALYTICS_HAND_CAPACITY = 100000;

interface AnalyticsViewProps {
  onOpenAnalytics?: () => void;
  userId?: string;
  account?: SpotVaultAccount | null;
  onPlayHand?: (handId: string) => void;
}

type Tab = 'overview' | 'ai-coach' | 'hand-analyzer' | 'advanced-analytics' | 'positions' | 'starting-hands' | 'board' | 'tournament-library';
type AdvancedStreet = 'preflop' | 'flop' | 'turn' | 'river';
type ImportPhase = 'idle' | 'detecting' | 'confirming' | 'importing' | 'complete' | 'updating' | 'done' | 'failed';
type LoadState = 'loading' | 'loaded' | 'error';

const STAGE_LABELS: Record<ImportProgress['stage'], string> = {
  reading: 'Reading Files',
  parsing: 'Detecting Hands',
  duplicates: 'Checking Duplicates',
  saving: 'Saving Hands',
  calculating: 'Calculating Analytics',
  complete: 'Import Complete',
};

const STAGE_ORDER: ImportProgress['stage'][] = ['reading', 'parsing', 'duplicates', 'saving', 'calculating', 'complete'];

const COMING_SOON_TABS: Tab[] = ['overview', 'ai-coach'];

const TAB_LIST: { id: Tab; label: string }[] = [
  { id: 'advanced-analytics', label: 'Advanced Analytics' },
  { id: 'hand-analyzer', label: 'Hand Analyzer' },
  { id: 'tournament-library', label: 'Tournaments' },
  { id: 'positions', label: 'Positions' },
  { id: 'starting-hands', label: 'Starting Hands' },
  { id: 'board', label: 'Board Analysis' },
  { id: 'overview', label: 'SVI & Rankings' },
  { id: 'ai-coach', label: 'AI Coach' },
];

const ADVANCED_STREETS: { id: AdvancedStreet; label: string }[] = [
  { id: 'preflop', label: 'Preflop' },
  { id: 'flop', label: 'Flop' },
  { id: 'turn', label: 'Turn' },
  { id: 'river', label: 'River' },
];

const KEY_STATS_TABS_INLINE: { id: KeyStatsStreet; label: string }[] = [
  { id: 'all', label: 'All Stats' },
  { id: 'preflop', label: 'Preflop' },
  { id: 'flop', label: 'Flop' },
  { id: 'turn', label: 'Turn' },
  { id: 'river', label: 'River' },
];

export function AnalyticsView({ userId, account, onPlayHand }: AnalyticsViewProps) {
  const [mode, setMode] = useState<AnalyticsMode>('mtt');
  const [tab, setTab] = useState<Tab>('advanced-analytics');
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [dataStatus, setDataStatus] = useState<{ hands: number; latestImport: string | null }>({ hands: 0, latestImport: null });
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [isDemoData, setIsDemoData] = useState(false);
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState<{ handsProcessed: number; totalHands: number; stage: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [detection, setDetection] = useState<{ mode: AnalyticsMode; confidence: 'high' | 'low' } | null>(null);
  const [importerOpen, setImporterOpen] = useState(false);
  const [showLog, setShowLog] = useState<string | null>(null);
  const [recalcFailed, setRecalcFailed] = useState(false);
  const [recalcError, setRecalcError] = useState<string | null>(null);
  const [recalcConfirmOpen, setRecalcConfirmOpen] = useState(false);
  const [recalcComplete, setRecalcComplete] = useState<{ hands: number; at: string } | null>(null);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [analyzerFilters, setAnalyzerFilters] = useState<Record<string, unknown> | null>(null);
  const [analyzerEverOpened, setAnalyzerEverOpened] = useState(false);
  const [regressionReport, setRegressionReport] = useState<RegressionReport | null>(null);
  const [showRegression, setShowRegression] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [uploadStatusOpen, setUploadStatusOpen] = useState(false);
  const [keyStatsStreet, setKeyStatsStreet] = useState<KeyStatsStreet>('all');
  const [advancedStreet, setAdvancedStreet] = useState<AdvancedStreet>('preflop');
  const [importImpact, setImportImpact] = useState<ImportImpactData | null>(null);
  const [mobileTabDropdownOpen, setMobileTabDropdownOpen] = useState(false);
  const [demoHidden, setDemoHidden] = useState(() => {
    try { return localStorage.getItem('sv_hide_demo') === '1'; } catch { return false; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStatusRef = useRef<HTMLDivElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const uploadStatusButtonRef = useRef<HTMLButtonElement>(null);
  const dataMenuButtonRef = useRef<HTMLButtonElement>(null);
  const uploadStatusPanelRef = useRef<HTMLDivElement>(null);
  const dataMenuPanelRef = useRef<HTMLDivElement>(null);
  const [uploadStatusPosition, setUploadStatusPosition] = useState({ top: 0, left: 0 });
  const [dataMenuPosition, setDataMenuPosition] = useState({ top: 0, left: 0 });

  const positionMenu = useCallback((button: HTMLButtonElement | null, width: number, setPosition: (position: { top: number; left: number }) => void) => {
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const gap = 8;
    const estimatedHeight = 220;
    const top = rect.bottom + gap + estimatedHeight <= window.innerHeight ? rect.bottom + gap : Math.max(gap, rect.top - estimatedHeight - gap);
    const left = Math.min(Math.max(gap, rect.right - width), window.innerWidth - width - gap);
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!uploadStatusOpen) return;
    const updatePosition = () => positionMenu(uploadStatusButtonRef.current, 304, setUploadStatusPosition);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!uploadStatusButtonRef.current?.contains(target) && !uploadStatusPanelRef.current?.contains(target)) setUploadStatusOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUploadStatusOpen(false); };
    updatePosition();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [uploadStatusOpen, positionMenu]);

  useEffect(() => {
    if (!dataMenuOpen) return;
    const updatePosition = () => positionMenu(dataMenuButtonRef.current, 208, setDataMenuPosition);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!dataMenuButtonRef.current?.contains(target) && !dataMenuPanelRef.current?.contains(target)) setDataMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDataMenuOpen(false); };
    updatePosition();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [dataMenuOpen, positionMenu]);

    const loadAll = useCallback(async () => {
    if (!userId) { setLoadState('loaded'); return; }
    setLoadState('loading');
    try {
      // Load snapshot and data status first (critical path for rendering dashboard).
      // Import history is non-critical — load it in the background.
      const [snap, status] = await Promise.all([
        loadLatestSnapshot(userId, mode),
        loadDataStatus(userId, mode),
      ]);
      setDataStatus(status);
      if (snap !== null) {
        setSnapshot(snap);
        setIsDemoData(false);
      } else if (status.hands === 0) {
        // No personal data — fall back to platform demo snapshot unless user hid it
        if (demoHidden) {
          setSnapshot(null);
          setIsDemoData(false);
        } else {
          const demoSnap = await loadDemoSnapshot(mode);
          setSnapshot(demoSnap);
          setIsDemoData(demoSnap !== null);
        }
      } else {
        setSnapshot(snap);
        setIsDemoData(false);
      }
      setLoadState('loaded');
      // Load import history in the background — don't block dashboard rendering
      loadImportHistory(userId).then(history => setImports(history)).catch(() => {});
    } catch {
      setLoadState('error');
    }
  }, [userId, mode, demoHidden]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Poll for active analytics job when user has data but no snapshot (or stale snapshot).
  // This handles the case where another tab/mount triggered recalculation — this tab
  // detects the running job and reloads when it completes.
  useEffect(() => {
    if (!userId || loadState !== 'loaded') return;
    if (dataStatus.hands === 0) return;
    // Only skip polling if we have a fresh snapshot and aren't recalculating
    const snapshotHands = snapshot?.source_hand_count ?? 0;
    if (snapshotHands >= dataStatus.hands && !isDemoData && !recalculating) return;

    let cancelled = false;
    const poll = async () => {
      const job = await getActiveAnalyticsJob(userId, mode);
      if (cancelled) return;
      if (job) {
        if (!recalculating) {
          setRecalculating(true);
          setRecalcProgress({ handsProcessed: job.hands_processed ?? 0, totalHands: job.hands_total ?? dataStatus.hands, stage: 'Calculating stats (another tab)' });
        }
      } else if (recalculating) {
        setRecalculating(false);
        setRecalcProgress(null);
        await loadAll();
      }
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userId, mode, dataStatus.hands, snapshot?.source_hand_count, recalculating, loadState, isDemoData, loadAll]);

  const runImport = useCallback(async (files: File[], targetMode: AnalyticsMode) => {
    if (!userId) return;
    setImportPhase('importing');
    const initial: ImportProgress = { stage: 'reading', filesProcessed: 0, filesTotal: files.length, handsFound: 0, handsImported: 0, duplicates: 0, errors: 0, tournaments: 0, summariesImported: 0, elapsedMs: 0, errorSamples: [] };
    setProgress(initial);
    let final = initial;
    void logAnalyticsActivity(userId, 'upload_started', { status: 'started', mode: targetMode, handsSubmitted: files.length });
    await importPokerFiles(userId, targetMode, files, (p) => { final = p; setProgress(p); });

    // Refresh authoritative hand count AFTER DB commit, BEFORE deciding view state
    const status = await loadDataStatus(userId, targetMode);
    setDataStatus(status);

    // Log upload result
    if (final.handsImported > 0 || final.summariesImported > 0) {
      void logAnalyticsActivity(userId, 'upload_completed', {
        status: 'completed', mode: targetMode,
        handsSubmitted: final.handsFound, handsInserted: final.handsImported, handsDuplicates: final.duplicates,
        metadata: { files: final.filesProcessed, summaries: final.summariesImported, errors: final.errors },
      });
    } else if (final.duplicates > 0) {
      void logAnalyticsActivity(userId, 'duplicates_skipped', {
        status: 'completed', mode: targetMode, handsDuplicates: final.duplicates,
      });
    }
    if (final.errors > 0 && final.handsImported === 0 && final.summariesImported === 0) {
      void logAnalyticsActivity(userId, 'upload_failed', {
        status: 'failed', mode: targetMode, errorMessage: final.errorSamples?.[0] ?? `${final.errors} parse errors`,
      });
    }

    // If no hands were found at all (all parsing failed), show failure with error samples
    if (final.handsFound === 0 && final.summariesImported === 0 && final.errors > 0) {
      setRecalcFailed(true);
      setRecalcError(`${final.errors} parse errors. ${final.errorSamples?.[0] ?? 'Unknown format.'}`);
      setImportPhase('failed');
      await loadAll();
      return;
    }

    if (final.handsImported === 0 && final.summariesImported === 0) {
      // Duplicate-only import — no recalculation needed
      setImportPhase('done');
      await loadAll();
      return;
    }

    // New hands were inserted — auto-recalculate exactly once.
    // Always recalculate for the REAL user, never the demo sentinel.
    // The user may have been viewing demo data as a fallback, but once
    // they import their own hands, the snapshot must be saved under their
    // own user_id so loadLatestSnapshot can find it on the next load.
    setIsDemoData(false);
    setImportPhase('updating');
    setRecalculating(true);
    setRecalcFailed(false);
    setRecalcError(null);
    setRecalcProgress(null);
    setProgress({ ...final, stage: 'calculating' });
    void logAnalyticsActivity(userId, 'calculation_started', { status: 'started', mode: targetMode });
    const result = await recalculateAnalytics(userId, targetMode, (p) => setRecalcProgress(p));
    if (result.snapshot) {
      void logAnalyticsActivity(userId, 'calculation_completed', { status: 'completed', mode: targetMode, handsInserted: result.handsProcessed });
    } else if (!result.jobConflict) {
      void logAnalyticsActivity(userId, 'calculation_failed', { status: 'failed', mode: targetMode, errorMessage: result.error ?? 'Unknown error' });
    }
    setRecalculating(false);
    setRecalcProgress(null);
    invalidateCachedSnapshot(userId, mode);
    if (result.snapshot) {
      setSnapshot(result.snapshot); // Immediately update snapshot state so view switches
      setRecalcFailed(false);
      setImportPhase('done');
      await loadAll(); // Refresh remaining state (imports, etc.)
    } else if (result.jobConflict) {
      // Another tab/mount is already calculating — don't show an error, just reload
      setRecalcFailed(false);
      setImportPhase('done');
      await loadAll();
    } else {
      setRecalcFailed(true);
      setRecalcError(result.error || 'Unknown error');
      setImportPhase('failed');
      await loadAll();
    }
  }, [userId, loadAll]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !userId) return;
    const files = Array.from(fileList);
    setImportPhase('detecting');
    setPendingFiles(files);
    const detected = await detectHandMode(files);
    setDetection(detected);
    if (detected.confidence === 'high' && detected.mode !== mode) { setImportPhase('confirming'); return; }
    runImport(files, mode);
  }, [userId, mode, runImport]);

  const confirmSwitchAndImport = useCallback(() => {
    if (!pendingFiles || !detection) return;
    setMode(detection.mode); setPendingFiles(null); setDetection(null);
    runImport(pendingFiles, detection.mode);
  }, [pendingFiles, detection, runImport]);

  const confirmImportAnyway = useCallback(() => {
    if (!pendingFiles) return;
    setPendingFiles(null); setDetection(null);
    runImport(pendingFiles, mode);
  }, [pendingFiles, mode, runImport]);

  const onDrop = useCallback((e: DragEvent) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }, [handleFiles]);

  const handleManualRecalculate = useCallback(async () => {
    if (!userId) return;
    setRecalcConfirmOpen(false);
    if (dataStatus.hands === 0) {
      setRecalcFailed(true);
      setRecalcError('No hand records found. Import your poker hand histories first, then recalculate.');
      return;
    }
    setRecalculating(true); setRecalcFailed(false); setRecalcError(null); setRecalcComplete(null); setRecalcProgress(null);
    void logAnalyticsActivity(userId, 'analytics_recalculated', { status: 'started', mode });
    const result = await recalculateAnalytics(userId, mode, (p) => setRecalcProgress(p));
    setRecalculating(false);
    setRecalcProgress(null);
    invalidateCachedSnapshot(userId, mode);
    if (result.snapshot) {
      void logAnalyticsActivity(userId, 'calculation_completed', { status: 'completed', mode, handsInserted: result.handsProcessed });
      setSnapshot(result.snapshot); setRecalcFailed(false);
      setRecalcComplete({ hands: result.handsProcessed, at: new Date().toISOString() });
      await loadAll();
    } else if (result.jobConflict) {
      setRecalcFailed(false);
      setRecalcError('Analytics calculation is already running in another tab. Your dashboard will update when it completes.');
      await loadAll();
    } else {
      void logAnalyticsActivity(userId, 'calculation_failed', { status: 'failed', mode, errorMessage: result.error ?? 'Unknown error' });
      setRecalcFailed(true); setRecalcError(result.error || 'Unknown error'); await loadAll();
    }
  }, [userId, mode, loadAll, dataStatus.hands]);

  const handleRebuildFromRaw = useCallback(async () => {
    if (!userId) return;
    setRebuilding(true);
    try {
      void logAnalyticsActivity(userId, 'rebuild_from_raw', { status: 'started', mode });
      const report = await rebuildAnalyticsFromRawHands(userId, mode);
      void logAnalyticsActivity(userId, 'rebuild_from_raw', { status: 'completed', mode, handsInserted: report.totalRawRecords });
      setRegressionReport(report);
      setShowRegression(true);
    } catch (err) {
      void logAnalyticsActivity(userId, 'rebuild_from_raw', { status: 'failed', mode, errorMessage: err instanceof Error ? err.message : 'Unknown error' });
      console.error('Rebuild failed:', err);
    }
    setRebuilding(false);
  }, [userId, mode]);

  const resetImporter = useCallback(() => {
    setImportPhase('idle'); setProgress(null); setPendingFiles(null); setDetection(null); setRecalcFailed(false); setRecalcError(null);
  }, []);

  const handleClearData = useCallback(async () => {
    if (!userId) return;
    setClearing(true);
    const handsBefore = dataStatus.hands;
    await clearAllAnalyticsData(userId);
    void logAnalyticsActivity(userId, 'data_cleared', { status: 'completed', mode, handsDeleted: handsBefore });
    invalidateCachedSnapshot(userId);
    setClearing(false);
    setClearConfirmOpen(false);
    setImportPhase('idle');
    setProgress(null);
    setRegressionReport(null);
    setShowRegression(false);
    // Reload: will fall back to demo if not hidden, or show empty state
    await loadAll();
  }, [userId, loadAll]);

  const handleHideDemo = useCallback(() => {
    setMgmtMenuOpen(false);
    try { localStorage.setItem('sv_hide_demo', '1'); } catch { /* ignore */ }
    setDemoHidden(true);
    setSnapshot(null);
    setIsDemoData(false);
  }, []);

  const handleShowDemo = useCallback(() => {
    setMgmtMenuOpen(false);
    try { localStorage.removeItem('sv_hide_demo'); } catch { /* ignore */ }
    setDemoHidden(false);
    loadAll();
  }, [loadAll]);

  const handleTrendClick = useCallback((statKey: string, statLabel: string, currentValue: number | null, _prevValue: number | null, delta: number | null) => {
    if (!snapshot) return;
    const prevSummary = snapshot.previous_summary;
    const prevHandCount = snapshot.previous_hand_count ?? null;
    const isFirstImport = !prevSummary || prevHandCount == null;
    const prevVal = prevSummary ? (prevSummary[statKey] ?? null) : null;
    setImportImpact({
      statKey,
      statLabel,
      currentValue,
      previousValue: prevVal,
      delta,
      previousHandCount: prevHandCount,
      currentHandCount: snapshot.source_hand_count || snapshot.summary.hands || 0,
      isFirstImport,
    });
  }, [snapshot]);

  const trendsMemo = useMemo(() => snapshot ? computeTrends(snapshot) : {}, [snapshot]);

  const handleFiltersConsumed = useCallback(() => setAnalyzerFilters(null), []);

  useEffect(() => {
    if (tab === 'hand-analyzer') setAnalyzerEverOpened(true);
  }, [tab]);

  const hasData = dataStatus.hands > 0;
  const snapshotHands = snapshot?.source_hand_count ?? 0;
  const isStale = hasData && !isDemoData && snapshotHands < dataStatus.hands;
  const newHandsCount = dataStatus.hands - snapshotHands;
  const hasResults = (snapshot !== null && snapshotHands > 0) || isDemoData;
  const canAccessAiCoach = !!account && (account.role === 'developer_admin' || account.isAuthUser === true || isStaffOrAdmin(account));
  const canAccessComingSoonTabs = canAccessAiCoach;
  const isTabLocked = (tabId: Tab): boolean => {
    if (!COMING_SOON_TABS.includes(tabId)) return false;
    if (tabId === 'ai-coach') return !canAccessAiCoach;
    return !canAccessComingSoonTabs;
  };

  // === Loading state ===
  if (loadState === 'loading') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <SkeletonHeader />
        <div className="mt-4 space-y-3">
          <div className="h-8 animate-pulse rounded-lg bg-white/[0.03]" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-white/[0.03]" />)}
          </div>
        </div>
      </div>
    );
  }

  // === Error state ===
  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <StateMessage
          icon={AlertTriangle}
          iconColor="#f59e0b"
          title="Analytics could not be loaded"
          message="There was a problem loading your analytics data."
          actionLabel="Retry"
          onAction={loadAll}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 sm:py-4">
      {/* Unified Analytics header — toolbar + street tabs in one container */}
      <div className="mb-3 rounded-xl backdrop-blur-md" style={{ background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(190, 145, 65, 0.22)', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.5)' }}>
        {/* Row 1: Toolbar with title, mode toggle, and controls */}
        <div className="flex flex-wrap items-center gap-3 overflow-hidden rounded-t-xl px-4 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(192,145,30,0.12), rgba(192,145,30,0.04))', border: '1px solid rgba(192,145,30,0.15)' }}>
            <BarChart3 className="h-4 w-4" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <span className="text-[13px] font-bold tracking-tight text-white">Analytics</span>
          {/* Mode toggle */}
          <div className="inline-flex items-center rounded-lg border p-0.5" style={{ borderColor: 'rgba(var(--portal-accent-rgb, 212,165,44), 0.4)', background: 'rgba(6, 8, 10, 0.55)', width: '120px', height: '30px', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)' }}>
            {(['cash', 'mtt'] as AnalyticsMode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex flex-1 items-center justify-center rounded-md text-[10px] font-bold tracking-wider uppercase transition-all"
                  style={{
                    background: active ? `linear-gradient(135deg, var(--portal-accent, #d4a52c) 0%, var(--portal-accent, #d4a52c) 100%)` : 'rgba(6, 8, 10, 0.6)',
                    color: active ? '#1a1408' : '#e8e6e3',
                    border: active ? '1px solid rgba(245,230,176,0.65)' : '1px solid rgba(212,165,44,0.35)',
                    boxShadow: active ? '0 0 12px rgba(212, 165, 44, 0.42)' : 'none',
                  }}
                >
                  {m === 'mtt' ? 'MTT' : 'Cash'}
                </button>
              );
            })}
          </div>
          {/* DEMO badge */}
          {isDemoData && (
            <span className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase" style={{ color: GOLD, borderColor: 'rgba(212,165,44,0.3)', background: 'rgba(212,165,44,0.08)' }} title="You're viewing sample data. Import poker data to view your personal analytics.">
              <Eye className="h-2.5 w-2.5" strokeWidth={1.5} /> Demo
            </span>
          )}
          {/* Dataset stats inline */}
          {hasData && (
            <div className="hidden items-center gap-4 border-l border-white/[0.06] pl-4 lg:flex">
              <DatasetStat label="Hands" value={dataStatus.hands.toLocaleString()} info="Total hand records stored in the database" />
              <DatasetStat label="Status" value={hasResults ? 'Ready' : 'Pending'} color="#ffffff" info="Whether analytics have been calculated" />
            </div>
          )}
          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Single unified menu — always visible */}
            <div className="relative shrink-0" ref={dataMenuRef}>
              <button
                ref={dataMenuButtonRef}
                onClick={() => setDataMenuOpen((open) => !open)}
                className="hdr-white-btn group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-250 active:scale-95"
              >
                <Database className="h-3.5 w-3.5" strokeWidth={1.5} /> <span className="hidden sm:inline">Manage</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${dataMenuOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
              </button>
              {dataMenuOpen && createPortal(
                <div ref={dataMenuPanelRef} className="fixed z-[1000] w-52 rounded-lg border p-1.5 shadow-2xl backdrop-blur-md" style={{ top: dataMenuPosition.top, left: dataMenuPosition.left, borderColor: BORDER, background: 'rgba(6, 8, 10, 0.92)' }}>
                  <button
                    onClick={() => { setImporterOpen(true); setImportPhase('idle'); setDataMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3 w-3" strokeWidth={1.5} /> Import
                  </button>
                  <button
                    onClick={() => { setRecalcConfirmOpen(true); setDataMenuOpen(false); }}
                    disabled={recalculating || dataStatus.hands === 0}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    {recalculating ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> : <RefreshCw className="h-3 w-3" strokeWidth={1.5} />} Recalculate
                  </button>
                  <button
                    onClick={() => { setClearConfirmOpen(true); setDataMenuOpen(false); }}
                    disabled={clearing || dataStatus.hands === 0}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold text-red-300/70 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Clear Analytics Data
                  </button>
                  {isDemoData && (
                    <button
                      onClick={handleHideDemo}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <EyeOff className="h-3 w-3" strokeWidth={1.5} /> Hide Demo Data
                    </button>
                  )}
                  {demoHidden && !isDemoData && (
                    <button
                      onClick={handleShowDemo}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Eye className="h-3 w-3" strokeWidth={1.5} /> Show Demo Data
                    </button>
                  )}
                </div>,
                document.body,
              )}
            </div>
            {/* Upload Status — standalone button, visible when user has real data */}
            {!isDemoData && hasData && (
              <div className="relative shrink-0" ref={uploadStatusRef}>
                <button
                  ref={uploadStatusButtonRef}
                  onClick={() => { setUploadStatusOpen((open) => !open); setDataMenuOpen(false); }}
                  className="hdr-white-btn group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-250 active:scale-95"
                >
                  <Database className="h-3.5 w-3.5" strokeWidth={1.5} /> <span className="hidden sm:inline">Upload Status</span>
                </button>
                {uploadStatusOpen && createPortal(
                  <UploadStatusPanel
                    panelRef={uploadStatusPanelRef}
                    position={uploadStatusPosition}
                    imports={imports}
                    totalHands={dataStatus.hands}
                    capacity={ANALYTICS_HAND_CAPACITY}
                    importPhase={importPhase}
                    latestImport={dataStatus.latestImport}
                    onClose={() => setUploadStatusOpen(false)}
                  />,
                  document.body,
                )}
              </div>
            )}
          </div>
        </div>
        {/* Row 2: Street tabs — centered horizontally */}
        {hasResults && (
          <div className="flex items-center justify-center gap-1 overflow-x-auto border-t border-white/[0.06] px-4 py-2" style={{ scrollbarWidth: 'thin' }}>
            {KEY_STATS_TABS_INLINE.map(tab => (
              <button key={tab.id} onClick={() => setKeyStatsStreet(tab.id)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${keyStatsStreet === tab.id ? 'bg-[#c0911e]/20 text-[#f5e6b0] shadow-sm' : 'text-white/50 hover:text-white/75'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Analytics Activity & Upload History — persistent collapsible panel with integrated status */}
      {userId && !isDemoData && (
        <div className="mb-1 mt-3">
          <AnalyticsActivityPanel userId={userId} status={{
            recalculating,
            recalcStage: recalcProgress?.stage,
            recalcFailed,
            isStale,
            newHandsCount,
            totalHands: dataStatus.hands,
            snapshot,
          } as ActivityPanelStatus} />
        </div>
      )}

      {/* === IMPORTER: shown when importer open or no data yet === */}
      {(!hasResults || importerOpen) && (
        <div className="mt-4">
          {importPhase === 'idle' && <DropZone mode={mode} dragOver={dragOver} setDragOver={setDragOver} onDrop={onDrop} onPick={() => fileInputRef.current?.click()} />}
          {importPhase === 'detecting' && <DetectingPanel />}
          {importPhase === 'confirming' && detection && <ModeMismatchWarning detectedMode={detection.mode} currentMode={mode} onSwitch={confirmSwitchAndImport} onAnyway={confirmImportAnyway} onCancel={resetImporter} />}
          {importPhase === 'importing' && progress && <ImportProgressPanel progress={progress} />}
          {importPhase === 'updating' && progress && <UpdatingPanel progress={progress} mode={mode} recalcProgress={recalcProgress} totalHandsAvailable={dataStatus.hands} />}
          {importPhase === 'done' && progress && <DonePanel progress={progress} mode={mode} hadNewHands={progress.handsImported > 0} onDone={() => { resetImporter(); }} onViewLog={() => setShowLog(`Files: ${progress.filesProcessed} | Hands: ${progress.handsFound} | Imported: ${progress.handsImported} | Summaries: ${progress.summariesImported} | Dups: ${progress.duplicates} | Errors: ${progress.errors} | Tournaments: ${progress.tournaments} | Elapsed: ${Math.round(progress.elapsedMs / 1000)}s`)} />}
          {importPhase === 'failed' && progress && <FailedPanel progress={progress} mode={mode} onRetry={handleManualRecalculate} onDone={() => { resetImporter(); }} errorMessage={recalcError} />}
        </div>
      )}

      {/* === NO HANDS: show empty state or demo data === */}
      {!hasData && !hasResults && (
        <EmptyAnalyticsState />
      )}

      {/* === HANDS BUT NO SNAPSHOT: show calculate button === */}
      {hasData && !hasResults && (
        <div className="mt-4">
          {recalcFailed && recalcError ? (
            <StateMessage
              icon={AlertTriangle}
              iconColor="#f59e0b"
              title={`Unable to calculate analytics`}
              message={`${dataStatus.hands.toLocaleString()} hands were loaded, but the calculation failed. Error: ${recalcError}`}
              actionLabel="Try Again"
              onAction={handleManualRecalculate}
              actionLoading={recalculating}
            />
          ) : (
            <StateMessage
              icon={BarChart3}
              iconColor={GOLD}
              title={`${dataStatus.hands.toLocaleString()} hands available`}
              message="Analytics have not been calculated yet. Calculate your analytics to see your full performance dashboard."
              actionLabel="Calculate Analytics"
              onAction={handleManualRecalculate}
              actionLoading={recalculating}
            />
          )}
        </div>
      )}


      {/* === SNAPSHOT EXISTS: show full analytics === */}
      {hasResults && (
        <div className="mt-2">
          {/* Statistics grid — above graph per new layout */}
          <AnalyticsSviSummary key={`${tab}-${keyStatsStreet}`} snapshot={snapshot} mode={mode} trends={trendsMemo} street={keyStatsStreet} onTrendClick={handleTrendClick} />

          {/* Cumulative graph — below statistics grid */}
          {snapshot.graph_series && snapshot.graph_series.length > 0 ? (
            <CumulativeLineGraph data={graphSeriesToPoints(snapshot.graph_series as any[])} mode={mode === 'cash' ? 'cash' : 'mtt'} />
          ) : (
            <div className="data-plate rounded-lg p-8 text-center">
              <p className="text-[11px] text-white/30">No graph data available</p>
            </div>
          )}

          {/* Tabs — dark translucent shell, horizontally scrollable on narrow screens */}
          <div className="mb-4 mt-4 flex items-center gap-1 overflow-x-auto rounded-lg border p-2 backdrop-blur-md max-md:hidden" style={{ borderColor: BORDER, background: 'rgba(6, 8, 10, 0.55)', scrollbarWidth: 'thin' }}>
            {TAB_LIST.map((t) => {
              const locked = isTabLocked(t.id);
              const isActive = tab === t.id && !locked;
              return (
                <button
                  key={t.id}
                  onClick={() => { if (!locked) setTab(t.id); }}
                  disabled={locked}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${isActive ? 'bg-[#c0911e]/20 text-[#f5e6b0] shadow-sm' : locked ? 'cursor-not-allowed text-white/25 hover:text-white/25' : 'text-white hover:text-[#f5e6b0]'}`}
                >
                  {t.label}
                  {locked && <span className="ml-1 text-[7px] font-bold tracking-wider opacity-60">(Soon)</span>}
                </button>
              );
            })}
          </div>

          {/* Mobile compact dropdown selector for analytics sections */}
          <div className="relative mb-4 mt-4 md:hidden">
            <button
              onClick={() => setMobileTabDropdownOpen(v => !v)}
              className="flex w-full items-center justify-between rounded-lg border px-4 py-2.5 backdrop-blur-md transition-colors hover:bg-white/[0.02]"
              style={{ borderColor: BORDER, background: 'rgba(6, 8, 10, 0.55)' }}
            >
              <span className="flex items-center gap-2">
                <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Section:</span>
                <span className="text-[12px] font-bold" style={{ color: GOLD_SOFT }}>{TAB_LIST.find(t => t.id === tab)?.label ?? 'Select'}</span>
              </span>
              <ChevronDown size={14} className="text-white/40 transition-transform" style={{ transform: mobileTabDropdownOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {mobileTabDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[40]" onClick={() => setMobileTabDropdownOpen(false)} />
                <div className="absolute z-[41] mt-1 max-h-72 w-full overflow-y-auto rounded-lg border shadow-2xl" style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(5,4,3,0.98)' }}>
                  {TAB_LIST.map(t => {
                    const locked = isTabLocked(t.id);
                    const isActive = tab === t.id && !locked;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { if (!locked) setTab(t.id); setMobileTabDropdownOpen(false); }}
                        disabled={locked}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                        style={{ background: isActive ? 'rgba(212,165,44,0.08)' : 'transparent' }}
                      >
                        <span className={`text-[11px] font-bold ${isActive ? '' : 'text-white/70'}`} style={{ color: isActive ? GOLD_SOFT : undefined }}>
                          {t.label}
                          {locked && <span className="ml-1.5 text-[8px] font-bold tracking-wider opacity-60">(Soon)</span>}
                        </span>
                        {isActive && <CheckCircle2 size={12} style={{ color: GOLD }} strokeWidth={1.5} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Secondary nav for Advanced Analytics */}
          {tab === 'advanced-analytics' && (
            <>
            <div className="mb-3 flex items-center gap-1 overflow-x-auto rounded-lg border p-2 backdrop-blur-md max-md:hidden" style={{ borderColor: BORDER, background: 'rgba(6, 8, 10, 0.55)', scrollbarWidth: 'thin' }}>
              {ADVANCED_STREETS.map(st => (
                <button key={st.id} onClick={() => setAdvancedStreet(st.id)}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${advancedStreet === st.id ? 'bg-[#c0911e]/20 text-[#f5e6b0] shadow-sm' : 'text-white/50 hover:text-white/75'}`}>
                  {st.label}
                </button>
              ))}
            </div>
            {/* Mobile street selector — compact dropdown */}
            <div className="relative mb-3 md:hidden">
              <select
                value={advancedStreet}
                onChange={(e) => setAdvancedStreet(e.target.value as AdvancedStreet)}
                className="w-full rounded-lg border px-3 py-2.5 text-[11px] font-bold text-white/80 backdrop-blur-md outline-none appearance-none"
                style={{ borderColor: BORDER, background: 'rgba(6, 8, 10, 0.55)' }}
              >
                {ADVANCED_STREETS.map(st => (
                  <option key={st.id} value={st.id} className="bg-[#0a0c0e] text-white">{st.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
            </div>
            </>
          )}

          {/* Tab content — conditional mounting for chart tabs; HandAnalyzer stays mounted to preserve filter state */}
          {(() => {
            const trends = trendsMemo;
            const jump = (f: Record<string, unknown>) => { setAnalyzerFilters(f); setTab('hand-analyzer'); };
            return (
              <>
                {tab === 'overview' && (isTabLocked('overview') ? <SviComingSoon /> : <OverviewTab snapshot={snapshot} mode={mode} userId={userId} isDemo={isDemoData} onJumpToAnalyzer={jump} trends={trends} />)}
                {tab === 'ai-coach' && (isTabLocked('ai-coach') ? <AiCoachComingSoon /> : <AICoachShell userId={userId} mode={mode} totalHands={snapshot.summary.hands} onJumpToAnalyzer={jump} isDemo={isDemoData} />)}
                {tab === 'advanced-analytics' && advancedStreet === 'preflop' && <PreflopTab snapshot={snapshot} mode={mode} userId={userId} onJumpToAnalyzer={jump} trends={trends} />}
                {tab === 'advanced-analytics' && advancedStreet === 'flop' && <FlopTab snapshot={snapshot} mode={mode} userId={userId} onJumpToAnalyzer={jump} trends={trends} />}
                {tab === 'advanced-analytics' && advancedStreet === 'turn' && <TurnTab snapshot={snapshot} mode={mode} userId={userId} onJumpToAnalyzer={jump} trends={trends} />}
                {tab === 'advanced-analytics' && advancedStreet === 'river' && <RiverTab snapshot={snapshot} mode={mode} userId={userId} onJumpToAnalyzer={jump} trends={trends} />}
                {tab === 'positions' && <PositionsTab snapshot={snapshot} mode={mode} userId={userId} onJumpToAnalyzer={jump} trends={trends} />}
                {tab === 'starting-hands' && <StartingHandsTab snapshot={snapshot} mode={mode} userId={userId} onJumpToAnalyzer={jump} trends={trends} />}
                {tab === 'board' && <BoardTab snapshot={snapshot} mode={mode} userId={userId} onJumpToAnalyzer={jump} trends={trends} />}
                {tab === 'tournament-library' && <TournamentLibraryTab userId={isDemoData ? DEMO_ANALYTICS_USER_ID : userId} mode={mode} isDemo={isDemoData} onJumpToAnalyzer={jump} snapshot={snapshot} trends={trends} />}
              </>
            );
          })()}
          <div hidden={tab !== 'hand-analyzer'}>{(tab === 'hand-analyzer' || analyzerEverOpened) && <HandAnalyzer userId={isDemoData ? DEMO_ANALYTICS_USER_ID : userId} mode={mode} externalFilters={analyzerFilters} onFiltersConsumed={handleFiltersConsumed} onPlayHand={onPlayHand} />}</div>
        </div>
      )}

      {/* Recalculating indicator with real progress bar — hidden during import 'updating' phase
          to avoid duplicate progress bars (UpdatingPanel already shows the same progress). */}
      {recalculating && !importerOpen && importPhase !== 'updating' && (
        <RecalcProgressPanel progress={recalcProgress} totalHands={dataStatus.hands} mode={mode} />
      )}

      {/* Recalculate Required banner — shown when sanity checks fail */}
      {snapshot && snapshot.sanity_checks && !snapshot.sanity_checks.every(s => s.pass) && !recalculating && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.5} />
            <span className="text-[11px] font-bold text-amber-300">Recalculate Required</span>
          </div>
          <p className="mt-1 text-[10px] text-amber-200/60">Analytics may be inaccurate. Re-import your hand histories and recalculate to verify.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={handleManualRecalculate} disabled={recalculating}
              className="rounded-md border border-amber-500/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-50">
              Recalculate
            </button>
            <button onClick={handleRebuildFromRaw} disabled={rebuilding}
              className="rounded-md border border-amber-500/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/10 disabled:opacity-50">
              {rebuilding ? 'Rebuilding...' : 'Rebuild from Raw'}
            </button>
          </div>
        </div>
      )}

      {/* Regression Report Panel */}
      {showRegression && regressionReport && (
        <div className="mt-4 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-[#d4a52c] uppercase">Analytics Regression Audit</span>
            <button onClick={() => setShowRegression(false)} className="text-white/30 hover:text-white"><X className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
          </div>
          <div className="space-y-1.5 text-[10px] font-mono text-white/60">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Hands:</span><span className={regressionReport.regression.hands.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.handsParsed} (expected ~{regressionReport.regression.hands.expected}) {regressionReport.regression.hands.pass ? 'PASS' : 'FAIL'}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>BB Won:</span><span className={regressionReport.regression.bbWon.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.bbWon} (expected ~{regressionReport.regression.bbWon.expected}) {regressionReport.regression.bbWon.pass ? 'PASS' : 'FAIL'}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>BB/100:</span><span className={regressionReport.regression.bb100.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.bb100} (expected ~{regressionReport.regression.bb100.expected}) {regressionReport.regression.bb100.pass ? 'PASS' : 'FAIL'}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Entries:</span><span className={regressionReport.regression.entries.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.tournamentEntries} (expected ~{regressionReport.regression.entries.expected}) {regressionReport.regression.entries.pass ? 'PASS' : 'FAIL'}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Events:</span><span className="text-white/50">{regressionReport.tournamentEvents}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Re-entries:</span><span className="text-white/50">{regressionReport.reEntries}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Duplicates:</span><span className="text-white/50">{regressionReport.duplicateHandIds}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Valid result:</span><span className="text-white/50">{regressionReport.handsWithValidResult} / {regressionReport.handsParsed}</span></div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Missing result:</span><span className="text-white/50">{regressionReport.handsMissingResult}</span></div>
            <div className="mt-2 border-t border-white/5 pt-2">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>VPIP:</span><span className={regressionReport.regression.vpip?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.vpip.num} / {regressionReport.stats.vpip.denom} = {regressionReport.stats.vpip.pct.toFixed(1)}% (ref {regressionReport.regression.vpip?.expected}) {regressionReport.regression.vpip?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>PFR:</span><span className={regressionReport.regression.pfr?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.pfr.num} / {regressionReport.stats.pfr.denom} = {regressionReport.stats.pfr.pct.toFixed(1)}% (ref {regressionReport.regression.pfr?.expected}) {regressionReport.regression.pfr?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>3-Bet:</span><span className={regressionReport.regression.threeBet?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.threeBet.num} / {regressionReport.stats.threeBet.denom} = {regressionReport.stats.threeBet.pct.toFixed(1)}% (ref {regressionReport.regression.threeBet?.expected}) {regressionReport.regression.threeBet?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Flop C-Bet:</span><span className={regressionReport.regression.cbetFlop?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.cbetFlop?.num ?? 0} / {regressionReport.stats.cbetFlop?.denom ?? 0} = {(regressionReport.stats.cbetFlop?.pct ?? 0).toFixed(1)}% (ref {regressionReport.regression.cbetFlop?.expected}) {regressionReport.regression.cbetFlop?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>Turn Barrel:</span><span className={regressionReport.regression.barrelTurn?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.barrelTurn?.num ?? 0} / {regressionReport.stats.barrelTurn?.denom ?? 0} = {(regressionReport.stats.barrelTurn?.pct ?? 0).toFixed(1)}% (ref {regressionReport.regression.barrelTurn?.expected}) {regressionReport.regression.barrelTurn?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>River Barrel:</span><span className={regressionReport.regression.barrelRiver?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.barrelRiver?.num ?? 0} / {regressionReport.stats.barrelRiver?.denom ?? 0} = {(regressionReport.stats.barrelRiver?.pct ?? 0).toFixed(1)}% (ref {regressionReport.regression.barrelRiver?.expected}) {regressionReport.regression.barrelRiver?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>WTSD:</span><span className={regressionReport.regression.wtsd?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.wtsd.num} / {regressionReport.stats.wtsd.denom} = {regressionReport.stats.wtsd.pct.toFixed(1)}% (ref {regressionReport.regression.wtsd?.expected}) {regressionReport.regression.wtsd?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>W$SD:</span><span className={regressionReport.regression.wsd?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.wsd.num} / {regressionReport.stats.wsd.denom} = {regressionReport.stats.wsd.pct.toFixed(1)}% (ref {regressionReport.regression.wsd?.expected}) {regressionReport.regression.wsd?.pass ? 'PASS' : 'FAIL'}</span></div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between"><span>WWSF:</span><span className={regressionReport.regression.wwsf?.pass ? 'text-green-400' : 'text-red-400'}>{regressionReport.stats.wwsf.num} / {regressionReport.stats.wwsf.denom} = {regressionReport.stats.wwsf.pct.toFixed(1)}% (ref {regressionReport.regression.wwsf?.expected}) {regressionReport.regression.wwsf?.pass ? 'PASS' : 'FAIL'}</span></div>
            </div>
            {regressionReport.sampleHands.length > 0 && (
              <div className="mt-2 border-t border-white/5 pt-2">
                <div className="mb-1 text-white/40">Sample hands:</div>
                {regressionReport.sampleHands.map((h, i) => (
                  <div key={i} className="flex flex-col gap-0.5 text-[9px] text-white/40 sm:flex-row sm:justify-between">
                    <span className="break-all">{h.handId.slice(0, 12)}...</span>
                    <span className="break-all">BB={h.bigBlind} inv={h.invested} col={h.collected} net={h.netChips} bb={h.netBB}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".txt,.hh,.csv" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {/* Import log */}
      {showLog && (
        <div className="mt-4 rounded-lg data-plate p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wide text-white/50">IMPORT LOG</span>
            <button onClick={() => setShowLog(null)} className="text-white/30 hover:text-white"><X className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
          </div>
          <pre className="whitespace-pre-wrap text-[10px] font-mono text-white/40">{showLog}</pre>
        </div>
      )}

      {/* Clear Data confirmation modal */}
      {clearConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !clearing && setClearConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-red-400/20 bg-[#0a0c0e] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-400/20 bg-red-400/10">
                <AlertTriangle className="h-5 w-5 text-red-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-white">Clear all imported poker data?</h3>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-white/50">This will permanently delete your imported hands and all Analytics generated from them. <span className="font-semibold text-red-300">This cannot be undone.</span></p>
            <div className="flex gap-2">
              <button onClick={() => setClearConfirmOpen(false)} disabled={clearing} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-semibold tracking-widest text-white/60 uppercase transition-colors hover:text-white disabled:opacity-50">Cancel</button>
              <button onClick={handleClearData} disabled={clearing} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 py-2.5 text-[11px] font-bold tracking-widest text-red-300 uppercase transition-colors hover:bg-red-400/20 disabled:opacity-50">
                {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />} {clearing ? 'Clearing...' : 'Clear All Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recalculate Confirmation Modal */}
      {recalcConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRecalcConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-[#c0911e]/20 bg-[#0a0c0e] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c0911e]/20 bg-[#c0911e]/10">
                <RefreshCw className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-white">Recalculate Analytics</h3>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-white/50">Rebuild all analytics from your reconciled hand histories? This reprocesses every classified hand and refreshes all tabs. No hand data is modified.</p>
            <div className="flex gap-2">
              <button onClick={() => setRecalcConfirmOpen(false)} className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-[11px] font-semibold tracking-widest text-white/60 uppercase transition-colors hover:text-white">Cancel</button>
              <button onClick={handleManualRecalculate} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2.5 text-[11px] font-bold tracking-widest uppercase transition-colors hover:bg-[#c0911e]/20" style={{ color: GOLD_SOFT }}>
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} /> Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recalculate Completion Banner */}
      {recalcComplete && !recalculating && (
        <div className="mt-4 rounded-lg border border-[#4ade80]/20 bg-[#4ade80]/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: '#4ade80' }} strokeWidth={1.5} />
            <span className="text-[11px] font-bold text-[#4ade80]">Analytics recalculated from {recalcComplete.hands.toLocaleString()} reconciled hands.</span>
            <button onClick={() => setRecalcComplete(null)} className="ml-auto text-white/30 hover:text-white"><X className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
          </div>
        </div>
      )}

      {/* Import Impact Modal */}
      {importImpact && (
        <ImportImpactModal data={importImpact} onClose={() => setImportImpact(null)} />
      )}
    </div>
  );
}
// ============================================================
function ModeSelector({ mode, setMode }: { mode: AnalyticsMode; setMode: (m: AnalyticsMode) => void }) {
  return (
    <div
      className="inline-flex items-center rounded-lg border p-0.5"
      style={{ borderColor: BORDER, background: 'rgba(5,6,7,0.93)', width: '160px', height: '40px' }}
    >
      {(['cash', 'mtt'] as AnalyticsMode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex flex-1 items-center justify-center rounded-md text-[12px] font-bold tracking-wider uppercase transition-all"
            style={{
              background: active ? `linear-gradient(135deg, ${GOLD}, #b78318)` : 'transparent',
              color: active ? '#1a1304' : 'rgba(255,255,255,0.35)',
              boxShadow: active ? '0 2px 8px -2px rgba(212,165,44,0.4)' : 'none',
            }}
          >
            {m === 'mtt' ? 'MTT' : 'Cash'}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// EMPTY ANALYTICS STATE (shown when no real data exists)
// ============================================================
function EmptyAnalyticsState() {
  return (
    <div className="mt-4">
      <div className="data-plate flex flex-col items-center justify-center rounded-xl p-10 text-center">
        <BarChart3 className="mb-3 h-10 w-10" strokeWidth={1.5} style={{ color: GOLD, opacity: 0.4 }} />
        <p className="text-[14px] font-bold text-white">No poker data imported yet</p>
        <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-white/40">Import hand histories to begin building your Analytics. Every number shown will come from your actual imported data.</p>
      </div>
    </div>
  );
}

// ============================================================
// STATE MESSAGE (empty/error/no-snapshot)
// ============================================================
function StateMessage({ icon: Icon, iconColor, title, message, actionLabel, onAction, actionLoading }: {
  icon: LucideIcon; iconColor: string; title: string; message: string; actionLabel?: string; onAction?: () => void; actionLoading?: boolean;
}) {
  return (
    <div className="data-plate flex flex-col items-center justify-center rounded-xl p-8 text-center">
      <Icon className="mb-3 h-10 w-10" strokeWidth={1.5} style={{ color: iconColor, opacity: 0.6 }} />
      <p className="text-[14px] font-bold text-white">{title}</p>
      <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-white/40">{message}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} disabled={actionLoading} className="mt-4 flex items-center gap-2 rounded-lg border px-5 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all hover:scale-[1.02] disabled:opacity-50"
          style={{ borderColor: GOLD, color: '#080706', background: GOLD }}>
          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <BarChart3 className="h-4 w-4" strokeWidth={2} />}
          {actionLoading ? 'Calculating...' : actionLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================
// SKELETON HEADER
// ============================================================
function SkeletonHeader() {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl px-4 py-2.5 backdrop-blur-md" style={{ background: 'rgba(15, 12, 10, 0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(190, 145, 65, 0.22)' }}>
      <div className="h-8 w-8 animate-pulse rounded-lg bg-white/[0.03]" />
      <div className="h-4 w-24 animate-pulse rounded bg-white/[0.03]" />
      <div className="h-7 w-28 animate-pulse rounded-lg bg-white/[0.03]" />
    </div>
  );
}

// ============================================================
// DROP ZONE
// ============================================================
function DropZone({ mode, dragOver, setDragOver, onDrop, onPick }: { mode: AnalyticsMode; dragOver: boolean; setDragOver: (v: boolean) => void; onDrop: (e: DragEvent) => void; onPick: () => void; }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-center">
        <span className="rounded-md border border-[#c0911e]/25 bg-[#c0911e]/8 px-3 py-1 text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Importing to: {mode === 'mtt' ? 'MTT' : 'Cash'} Analytics</span>
      </div>
      <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-14 transition-all"
        style={{ borderColor: dragOver ? GOLD : BORDER_STRONG, background: dragOver ? 'rgba(212,165,44,0.15)' : 'rgba(6,7,8,0.93)', boxShadow: dragOver ? `0 0 30px -5px ${GOLD}40` : 'none' }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={onPick}>
        <UploadCloud className="mb-3 h-14 w-14 transition-all" style={{ color: dragOver ? GOLD : 'rgba(255,255,255,0.4)' }} strokeWidth={1.5} />
        {dragOver ? (
          <><p className="text-[16px] font-bold tracking-wide text-[#f5e6b0]">RELEASE TO IMPORT</p><p className="mt-1 text-[11px] text-[#d4a52c]/60">Drop files now</p></>
        ) : (
          <><p className="text-[16px] font-bold tracking-wide text-white/90">DROP HAND HISTORIES</p><p className="mt-1.5 text-[12px] text-white/50">Drag files here or click to browse</p><p className="mt-2.5 text-[9px] text-white/25">Supported: GG / PokerCraft / PokerStars</p></>
        )}
      </div>
    </div>
  );
}

// ============================================================
// IMPORT PANELS
// ============================================================
function DetectingPanel() {
  return (
    <div className="data-plate mb-4 rounded-xl p-6 text-center">
      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
      <p className="text-[13px] font-bold text-white">Detecting hand type...</p>
    </div>
  );
}

function ModeMismatchWarning({ detectedMode, currentMode, onSwitch, onAnyway, onCancel }: { detectedMode: AnalyticsMode; currentMode: AnalyticsMode; onSwitch: () => void; onAnyway: () => void; onCancel: () => void; }) {
  return (
    <div className="data-plate mb-4 rounded-xl p-5" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
      <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5" style={{ color: '#f59e0b' }} strokeWidth={1.5} /><span className="text-[14px] font-bold text-white">Mode Mismatch Detected</span></div>
      <p className="mb-4 text-[12px] text-white/60">These appear to be <span className="font-bold text-[#f5e6b0]">{detectedMode === 'mtt' ? 'tournament' : 'cash'}</span> hand histories, but you are in <span className="font-bold text-[#f5e6b0]">{currentMode === 'mtt' ? 'MTT' : 'Cash'}</span> mode.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onSwitch} className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all hover:scale-[1.02]" style={{ borderColor: GOLD, color: '#080706', background: GOLD }}><RefreshCw className="h-4 w-4" strokeWidth={2} />Switch to {detectedMode === 'mtt' ? 'MTT' : 'Cash'} &amp; Import</button>
        <button onClick={onAnyway} className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>Import Anyway</button>
        <button onClick={onCancel} className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-medium transition-all hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}><X className="h-4 w-4" strokeWidth={1.5} />Cancel</button>
      </div>
    </div>
  );
}

function ImportProgressPanel({ progress }: { progress: ImportProgress }) {
  const currentIdx = STAGE_ORDER.indexOf(progress.stage);
  return (
    <div className="data-plate mb-4 rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} /><span className="text-[14px] font-bold text-white">FILES RECEIVED</span></div>
      <div className="space-y-2.5">
        {STAGE_ORDER.slice(0, 5).map((stage) => {
          const si = STAGE_ORDER.indexOf(stage);
          const done = si < currentIdx; const active = si === currentIdx;
          return (
            <div key={stage} className="flex items-center gap-2.5">
              {done ? <CheckCircle2 className="h-4 w-4" style={{ color: '#4ade80' }} strokeWidth={1.5} /> : active ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} /> : <div className="h-4 w-4 rounded-full border-2 border-white/15" />}
              <span className={`text-[12px] font-medium ${done ? 'text-white/70' : active ? 'text-white' : 'text-white/25'}`}>{STAGE_LABELS[stage]}</span>
            </div>
          );
        })}
      </div>
      {(progress.handsFound > 0 || progress.summariesImported > 0 || progress.stage === 'saving') && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <StatBox label="Files Processed" value={progress.filesProcessed} />
          {progress.handsFound > 0 && <StatBox label="Hands Found" value={progress.handsFound} />}
          {progress.stage === 'saving' && progress.savingTotal && progress.savingTotal > 0 && (
            <StatBox label="Saving" value={progress.savingDone ?? 0} color="#4ade80" suffix={` / ${progress.savingTotal}`} />
          )}
          {progress.stage === 'saving' && progress.handsImported > 0 && <StatBox label="Hands Imported" value={progress.handsImported} color="#4ade80" />}
          {progress.summariesImported > 0 && <StatBox label="Tournament Results" value={progress.summariesImported} color="#a78bfa" />}
          {progress.tournaments > 0 && <StatBox label="Unique Tournaments" value={progress.tournaments} />}
          {progress.duplicates > 0 && <StatBox label="Duplicates" value={progress.duplicates} color="#f59e0b" />}
          {progress.errors > 0 && <StatBox label="Errors" value={progress.errors} color="#ef4444" />}
          {progress.totalHandsStored != null && <StatBox label="Total Stored" value={progress.totalHandsStored} color="#f5e6b0" />}
        </div>
      )}
      {progress.errors > 0 && progress.errorSamples && progress.errorSamples.length > 0 && (
        <div className="mt-3 rounded-md border border-red-400/20 bg-red-400/[0.05] px-3 py-2">
          <p className="mb-1 text-[9px] font-bold tracking-wide text-red-300/70 uppercase">Parse Error Samples</p>
          {progress.errorSamples.slice(0, 3).map((s, i) => (
            <p key={i} className="text-[9px] font-mono text-red-300/50">{s}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function UpdatingPanel({ progress, mode, recalcProgress, totalHandsAvailable }: { progress: ImportProgress; mode: AnalyticsMode; recalcProgress: { handsProcessed: number; totalHands: number; stage: string } | null; totalHandsAvailable: number }) {
  const stage = recalcProgress?.stage ?? 'Updating Analytics';
  const handsProcessed = recalcProgress?.handsProcessed ?? 0;
  // Prefer recalcProgress total, then totalHandsStored from the import, then the authoritative dataStatus count
  const handsTotal = recalcProgress?.totalHands ?? progress.totalHandsStored ?? totalHandsAvailable ?? 0;
  const pct = handsTotal > 0 ? Math.min(100, Math.round((handsProcessed / handsTotal) * 100)) : 0;

  return (
    <div className="data-plate mb-4 rounded-xl p-5" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
      <div className="mb-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" style={{ color: '#4ade80' }} strokeWidth={1.5} /><span className="text-[14px] font-bold text-white">Import Complete</span></div>
      <div className="mb-3 flex flex-wrap gap-2">
        <StatBox label="Files Processed" value={progress.filesProcessed} />
        {progress.handsImported > 0 && <StatBox label="New Hands" value={progress.handsImported} color="#4ade80" />}
        {progress.summariesImported > 0 && <StatBox label="Tournament Results" value={progress.summariesImported} color="#a78bfa" />}
        {progress.tournaments > 0 && <StatBox label="Unique Tournaments" value={progress.tournaments} />}
        {progress.totalHandsStored != null && <StatBox label="Total Stored" value={progress.totalHandsStored} color="#f5e6b0" />}
      </div>
      <div className="rounded-md border border-[#c0911e]/20 bg-[#c0911e]/5 px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
          <span className="text-[12px] font-medium text-[#f5e6b0]">{stage}</span>
          <span className="ml-auto text-[11px] font-mono font-bold" style={{ color: GOLD_SOFT }}>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: '#302817' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #c0911e, #e5b83c)', boxShadow: '0 0 8px rgba(212,165,44,0.45)' }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono">
          <span className="text-white/40">{handsProcessed.toLocaleString()} / {handsTotal.toLocaleString()} hands</span>
          <span className="text-white/30">{mode === 'mtt' ? 'MTT' : 'Cash'} dataset</span>
        </div>
      </div>
    </div>
  );
}

function DonePanel({ progress, mode, hadNewHands, onDone, onViewLog }: { progress: ImportProgress; mode: AnalyticsMode; hadNewHands: boolean; onDone: () => void; onViewLog: () => void; }) {
  return (
    <div className="data-plate mb-4 rounded-xl p-5" style={{ borderColor: 'rgba(74,222,128,0.3)' }}>
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-6 w-6" style={{ color: '#4ade80' }} strokeWidth={1.5} />
        <span className="text-[16px] font-bold text-white">{hadNewHands ? 'Analytics Updated' : 'Import Complete'}</span>
        <span className="rounded-md border border-[#c0911e]/20 bg-[#c0911e]/10 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase" style={{ color: GOLD_SOFT }}>{mode}</span>
      </div>
      {!hadNewHands ? (
        <div className="mb-4">
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <StatBox label="Files Processed" value={progress.filesProcessed} />
            {progress.summariesImported > 0 && <StatBox label="Tournament Results" value={progress.summariesImported} color="#a78bfa" />}
            {progress.tournaments > 0 && <StatBox label="Unique Tournaments" value={progress.tournaments} />}
            {progress.duplicates > 0 && <StatBox label="Duplicates" value={progress.duplicates} color="#f59e0b" />}
            {progress.totalHandsStored != null && <StatBox label="Total Stored" value={progress.totalHandsStored} color="#f5e6b0" />}
          </div>
          <p className="text-[12px] text-white/50">No new hand histories imported — analytics already up to date.</p>
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <StatBox label="Files Processed" value={progress.filesProcessed} />
          <StatBox label="New Hands" value={progress.handsImported} color="#4ade80" />
          {progress.summariesImported > 0 && <StatBox label="Tournament Results" value={progress.summariesImported} color="#a78bfa" />}
          {progress.tournaments > 0 && <StatBox label="Unique Tournaments" value={progress.tournaments} />}
          {progress.duplicates > 0 && <StatBox label="Duplicates" value={progress.duplicates} color="#f59e0b" />}
          {progress.errors > 0 && <StatBox label="Errors" value={progress.errors} color="#ef4444" />}
          {progress.totalHandsStored != null && <StatBox label="Total Stored" value={progress.totalHandsStored} color="#f5e6b0" />}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onDone} className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all hover:scale-[1.02]" style={{ borderColor: GOLD, color: '#080706', background: GOLD }}><BarChart3 className="h-4 w-4" strokeWidth={2} />View Analytics</button>
        <button onClick={onViewLog} className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-medium transition-all hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}><Eye className="h-4 w-4" strokeWidth={1.5} />View Import Log</button>
      </div>
    </div>
  );
}

function FailedPanel({ progress, mode, onRetry, onDone, errorMessage }: { progress: ImportProgress; mode: AnalyticsMode; onRetry: () => void; onDone: () => void; errorMessage?: string | null }) {
  const allFailed = progress.handsFound === 0 && progress.summariesImported === 0 && progress.errors > 0;
  return (
    <div className="data-plate mb-4 rounded-xl p-5" style={{ borderColor: 'rgba(245,158,11,0.4)' }}>
      <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-6 w-6" style={{ color: '#f59e0b' }} strokeWidth={1.5} /><span className="text-[16px] font-bold text-white">{allFailed ? 'Import Failed — No Hands Parsed' : 'Analytics Update Failed'}</span></div>
      {allFailed ? (
        <p className="mb-2 text-[12px] text-white/50">All {progress.errors.toLocaleString()} hand blocks failed to parse. No hands were stored. This usually means the hand history format is not recognized.</p>
      ) : (
        <p className="mb-2 text-[12px] text-white/50">Import complete — {progress.handsImported.toLocaleString()} new hands stored. But the analytics calculation failed. Your imported hands are safe.</p>
      )}
      {errorMessage && (
        <div className="mb-3 rounded-md border border-red-300/20 bg-red-300/[0.05] px-3 py-2">
          <p className="text-[10px] font-mono text-red-300/70">{errorMessage}</p>
        </div>
      )}
      {progress.errorSamples && progress.errorSamples.length > 0 && (
        <div className="mb-3 rounded-md border border-red-300/20 bg-red-300/[0.05] px-3 py-2">
          <p className="mb-1 text-[9px] font-bold tracking-wide text-red-300/70 uppercase">Error Samples</p>
          {progress.errorSamples.slice(0, 3).map((s, i) => (
            <p key={i} className="text-[9px] font-mono text-red-300/50">{s}</p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {!allFailed && <button onClick={onRetry} className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-bold tracking-wider uppercase transition-all hover:scale-[1.02]" style={{ borderColor: GOLD, color: '#080706', background: GOLD }}><RefreshCw className="h-4 w-4" strokeWidth={2} />Try Recalculate</button>}
        <button onClick={onDone} className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[11px] font-medium transition-all hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>{allFailed ? 'Dismiss' : 'View Existing Analytics'}</button>
      </div>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function StatBox({ label, value, color, suffix }: { label: string; value: number; color?: string; suffix?: string }) {
  return (
    <div className="rounded-md border px-2.5 py-2 text-center" style={{ borderColor: 'rgba(212, 165, 44, 0.15)', background: 'rgba(6, 8, 10, 0.92)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
      <p className="text-[9px] font-medium tracking-wide text-white/45 uppercase">{label}</p>
      <p className="mt-0.5 text-base font-bold" style={{ color: color ?? GOLD }}>{value.toLocaleString()}{suffix}</p>
    </div>
  );
}

function DatasetStat({ label, value, color, info }: { label: string; value: string; color?: string; info?: string }) {
  return (
    <div className="flex items-start gap-1">
      <div>
        <p className="text-[9px] font-medium tracking-wide text-white/40 uppercase">{label}</p>
        <p className="mt-0.5 text-sm font-bold" style={{ color: color ?? 'rgba(255,255,255,0.8)' }}>{value}</p>
      </div>
      {info && (
        <Info className="mt-0.5 h-2.5 w-2.5 shrink-0 text-white/20" strokeWidth={1.5} title={info} />
      )}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return <div className="flex flex-col items-center justify-center py-8 text-center"><p className="text-[11px] text-white/35">{label}</p></div>;
}

// ============================================================
// RECALC PROGRESS PANEL — real progress bar with %, hands, stage, ETA
// ============================================================
function RecalcProgressPanel({ progress, totalHands, mode }: { progress: { handsProcessed: number; totalHands: number; stage: string } | null; totalHands: number; mode: AnalyticsMode }) {
  const stage = progress?.stage ?? 'Starting...';
  const handsProcessed = progress?.handsProcessed ?? 0;
  const handsTotal = progress?.totalHands ?? totalHands;
  const pct = handsTotal > 0 ? Math.min(100, Math.round((handsProcessed / handsTotal) * 100)) : 0;

  return (
    <div className="data-plate mt-4 rounded-xl p-5" style={{ borderColor: 'rgba(192,145,30,0.3)' }}>
      <div className="mb-3 flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[13px] font-bold text-white">{stage}</span>
        <span className="ml-auto text-[11px] font-mono font-bold" style={{ color: GOLD_SOFT }}>{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full" style={{ background: '#302817' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #c0911e, #e5b83c)', boxShadow: '0 0 8px rgba(212,165,44,0.45)' }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono">
        <span className="text-white/50">{handsProcessed.toLocaleString()} / {handsTotal.toLocaleString()} hands</span>
        <span className="text-white/35">{mode === 'mtt' ? 'MTT' : 'Cash'} dataset</span>
      </div>
    </div>
  );
}

// ============================================================
// UPLOAD STATUS PANEL
// ============================================================
function UploadStatusPanel({ panelRef, position, imports, totalHands, capacity, importPhase, latestImport, onClose }: {
  panelRef: RefObject<HTMLDivElement>;
  position: { top: number; left: number };
  imports: ImportBatch[];
  totalHands: number;
  capacity: number;
  importPhase: ImportPhase;
  latestImport: string | null;
  onClose: () => void;
}) {
  const lastBatch = imports[0];
  const isProcessing = importPhase === 'importing' || importPhase === 'updating' || importPhase === 'detecting' || importPhase === 'confirming';
  const isFailed = importPhase === 'failed';
  const statusColor = isProcessing ? '#f59e0b' : isFailed ? '#ef4444' : lastBatch ? '#4ade80' : '#6b7280';
  const statusLabel = isProcessing ? 'Processing' : isFailed ? 'Attention needed' : lastBatch ? 'Up to date' : 'Unavailable';
  const lastUploadDate = lastBatch?.imported_at ?? latestImport;
  const formattedUploadDate = lastUploadDate
    ? new Date(lastUploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + new Date(lastUploadDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'No upload history available';
  const handsAdded = lastBatch?.imported_count ?? lastBatch?.hand_count ?? 0;
  const remaining = Math.max(0, capacity - totalHands);
  const pct = capacity > 0 ? Math.min(100, (totalHands / capacity) * 100) : 0;

  return (
    <div
      ref={panelRef}
      className="fixed z-[1000] w-[calc(100vw-24px)] max-w-[304px] rounded-xl border p-3.5 shadow-2xl sm:p-4"
      style={{ top: position.top, left: position.left, borderColor: 'rgba(192,145,30,0.62)', background: '#050505', boxShadow: '0 14px 40px -12px rgba(0,0,0,0.95)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5" strokeWidth={1.7} style={{ color: GOLD }} />
          <span className="text-[10px] font-bold tracking-[0.12em] text-[#f5e6b0] uppercase">Upload Status</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: statusColor }}>
          <span className={`h-1.5 w-1.5 rounded-full ${isProcessing ? 'animate-pulse' : ''}`} style={{ background: statusColor, boxShadow: `0 0 7px ${statusColor}99` }} />
          <span className="text-[9px] font-semibold tracking-wide">{statusLabel}</span>
        </div>
      </div>

      <div className="my-4 h-px" style={{ background: 'rgba(192,145,30,0.28)' }} />

      <div className="space-y-3">
        <StatusRow label="Last Successful Upload" value={formattedUploadDate} />
        <StatusRow label="Hands Added" value={handsAdded > 0 ? handsAdded.toLocaleString() : '—'} />
        <StatusRow label="Total Stored Hands" value={totalHands.toLocaleString()} />
      </div>

      <div className="my-4 h-px" style={{ background: 'rgba(192,145,30,0.28)' }} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-wide text-[#d4a52c] uppercase">Storage Capacity</span>
          <span className="text-[10px] font-mono text-white/75">{totalHands.toLocaleString()} / {capacity.toLocaleString()}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: '#302817' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #c0911e, #e5b83c)', boxShadow: '0 0 8px rgba(212,165,44,0.45)' }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px] font-mono">
          <span className="text-white/45">{pct.toFixed(2)}% used</span>
          <span className="font-semibold text-[#d4a52c]">{remaining.toLocaleString()} remaining</span>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] leading-4 text-white/45">{label}</span>
      <span className="text-right text-[10px] font-semibold leading-4 text-white/90">{value}</span>
    </div>
  );
}

function SviComingSoon() {
  return (
    <div className="data-plate flex flex-col items-center justify-center rounded-xl p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/20 bg-[#c0911e]/8">
        <BarChart3 className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD, opacity: 0.5 }} />
      </div>
      <p className="text-[14px] font-bold text-white">SVI &amp; Rankings — Coming Soon</p>
      <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-white/40">The SpotVault Index evaluation center, performance breakdown, and global leaderboard will be available here. Stay tuned for the launch.</p>
      <span className="mt-4 rounded-full border border-[#c0911e]/30 bg-[#c0911e]/8 px-3 py-1 text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>In Development</span>
    </div>
  );
}

function AiCoachComingSoon() {
  return (
    <div className="data-plate flex flex-col items-center justify-center rounded-xl p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/20 bg-[#c0911e]/8">
        <span className="text-[20px]" style={{ color: GOLD, opacity: 0.5 }}>AI</span>
      </div>
      <p className="text-[14px] font-bold text-white">AI Coach — Coming Soon</p>
      <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-white/40">AI-powered performance diagnostics and progress reviews will be available here. Stay tuned for the launch.</p>
      <span className="mt-4 rounded-full border border-[#c0911e]/30 bg-[#c0911e]/8 px-3 py-1 text-[9px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>In Development</span>
    </div>
  );
}

