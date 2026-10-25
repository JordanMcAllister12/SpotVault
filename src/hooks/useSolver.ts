import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  createSolverJob,
  fetchUserJobs,
  fetchJobById,
  solveWithDeepSolver,
  updateJobStatus,
  toggleFavorite,
  saveToLibrary,
  fetchLibraryEntries,
  fetchAllJobsForAdmin,
} from '@/lib/solver/solverService';
import type {
  SolverConfig,
  SolverJob,
  SolverResult,
  SolverNode,
  SolverLibraryEntry,
  RangeData,
  SolverBoardCard,
  SolverStreetAction,
  SolverPosition,
  SolverFormat,
  SolverAccuracy,
  SolverTreeSettings,
} from '@/lib/solver/types';
import {
  fullRange,
  DEFAULT_TABLE_CONFIG,
  type SolverTableConfig,
} from '@/lib/solver/types';
import { computeConfigHash as computeConfigHashSync } from '@/lib/solver/deepSolverProvider';

export type SolverView = 'range-source' | 'dashboard' | 'new-solve' | 'processing' | 'results' | 'library' | 'admin';

export type RangeSource = 'library' | 'custom' | null;

export type SolveStatus = 'not-solved' | 'solving' | 'solved' | 'stale' | 'error';

export interface SolverState {
  view: SolverView;
  solveStatus: SolveStatus;
  jobs: SolverJob[];
  libraryEntries: SolverLibraryEntry[];
  currentJob: SolverJob | null;
  currentResult: SolverResult | null;
  currentNode: SolverNode | null;
  nodePath: SolverNode[];
  selectedHand: string | null;
  processingStage: string;
  error: string | null;
  saveModalOpen: boolean;
  solvedConfigHash: string | null;
  config: SolverConfig;
  rangeSource: RangeSource;
  rangeSourceLabel: string | null;
}

const DEFAULT_CONFIG: SolverConfig = {
  game_type: 'nlhe',
  format: 'tournament',
  hero_position: 'BTN',
  villain_position: 'BB',
  effective_stack_bb: 40,
  pot_size_bb: 0,
  table_config: { ...DEFAULT_TABLE_CONFIG },
  board: [],
  action_history: [],
  hero_range: fullRange(),
  villain_range: fullRange(),
  tree_settings: {
    bet_sizes: ['33%', '75%'],
    raise_sizes: ['2.5x', '3x'],
    max_raises: 3,
    donk_bet_allowed: false,
    all_in_sizing: 'All-in',
  },
  accuracy: 'standard',
};

const INITIAL_STATE: SolverState = {
  view: 'range-source',
  solveStatus: 'not-solved',
  jobs: [],
  libraryEntries: [],
  currentJob: null,
  currentResult: null,
  currentNode: null,
  nodePath: [],
  selectedHand: null,
  processingStage: '',
  error: null,
  saveModalOpen: false,
  solvedConfigHash: null,
  config: DEFAULT_CONFIG,
  rangeSource: null,
  rangeSourceLabel: null,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useSolver(userId: string | null) {
  const [state, setState] = useState<SolverState>(INITIAL_STATE);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  void pollRef;

  // The app uses text-based demo account IDs (e.g. "acc-jordan") for its own
  // state, but the solver_jobs table has a uuid user_id column referencing
  // auth.users. Resolve the real Supabase Auth UUID so DB operations succeed.
  const [authUid, setAuthUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user?.id) setAuthUid(data.user.id);
    })();
    return () => { cancelled = true; };
  }, []);

  // Use the real auth UUID for all database operations; fall back to userId
  // only if it is already a valid UUID (e.g. in tests).
  const dbUserId = authUid ?? (userId && UUID_RE.test(userId) ? userId : null);

  // Load jobs when dbUserId changes
  const loadJobs = useCallback(async () => {
    if (!dbUserId) return;
    const jobs = await fetchUserJobs(dbUserId);
    setState((s) => ({ ...s, jobs }));
  }, [dbUserId]);

  const loadLibrary = useCallback(async () => {
    if (!dbUserId) return;
    const entries = await fetchLibraryEntries(dbUserId);
    setState((s) => ({ ...s, libraryEntries: entries }));
  }, [dbUserId]);

  useEffect(() => {
    loadJobs();
    loadLibrary();
  }, [loadJobs, loadLibrary]);

  const markStaleIfSolved = useCallback((s: SolverState): SolverState => {
    if (s.solveStatus === 'solved' && s.solvedConfigHash) {
      const newHash = computeConfigHashSync(s.config);
      if (newHash !== s.solvedConfigHash) return { ...s, solveStatus: 'stale' };
    }
    return s;
  }, []);

  const updateConfig = useCallback((patch: Partial<SolverConfig>) => {
    setState((s) => {
      const newConfig = { ...s.config, ...patch };
      let solveStatus = s.solveStatus;
      if (solveStatus === 'solved' && s.solvedConfigHash) {
        const newHash = computeConfigHashSync(newConfig);
        if (newHash !== s.solvedConfigHash) solveStatus = 'stale';
      }
      return { ...s, config: newConfig, solveStatus };
    });
  }, []);

  const setHeroPosition = useCallback((pos: SolverPosition) => {
    setState((s) => {
      if (pos === s.config.villain_position) return s;
      return markStaleIfSolved({ ...s, config: { ...s.config, hero_position: pos } });
    });
  }, [markStaleIfSolved]);

  const setVillainPosition = useCallback((pos: SolverPosition) => {
    setState((s) => {
      if (pos === s.config.hero_position) return s;
      return markStaleIfSolved({ ...s, config: { ...s.config, villain_position: pos } });
    });
  }, [markStaleIfSolved]);

  const setFormat = useCallback((fmt: SolverFormat) => {
    setState((s) => markStaleIfSolved({ ...s, config: { ...s.config, format: fmt } }));
  }, [markStaleIfSolved]);

  const setStack = useCallback((bb: number) => {
    setState((s) => markStaleIfSolved({ ...s, config: { ...s.config, effective_stack_bb: bb } }));
  }, [markStaleIfSolved]);

  const setTableConfig = useCallback((tableConfig: SolverTableConfig) => {
    setState((s) => markStaleIfSolved({ ...s, config: { ...s.config, table_config: tableConfig } }));
  }, [markStaleIfSolved]);

  const setBoard = useCallback((board: SolverBoardCard[]) => {
    setState((s) => markStaleIfSolved({ ...s, config: { ...s.config, board } }));
  }, [markStaleIfSolved]);

  const setActionHistory = useCallback((actions: SolverStreetAction[]) => {
    setState((s) => markStaleIfSolved({ ...s, config: { ...s.config, action_history: actions } }));
  }, [markStaleIfSolved]);

  const setHeroRange = useCallback((range: RangeData) => {
    setState((s) => ({ ...s, config: { ...s.config, hero_range: range } }));
  }, []);

  const setVillainRange = useCallback((range: RangeData) => {
    setState((s) => ({ ...s, config: { ...s.config, villain_range: range } }));
  }, []);

  const setAccuracy = useCallback((acc: SolverAccuracy) => {
    setState((s) => markStaleIfSolved({ ...s, config: { ...s.config, accuracy: acc } }));
  }, [markStaleIfSolved]);

  const setTreeSettings = useCallback((settings: SolverTreeSettings) => {
    setState((s) => markStaleIfSolved({ ...s, config: { ...s.config, tree_settings: settings } }));
  }, [markStaleIfSolved]);

  const resetConfig = useCallback(() => {
    setState((s) => ({ ...s, config: { ...DEFAULT_CONFIG }, error: null }));
  }, []);

  const startNewSolve = useCallback(() => {
    setState((s) => ({ ...s, view: 'new-solve', config: { ...DEFAULT_CONFIG }, error: null, rangeSource: null, rangeSourceLabel: null }));
  }, []);

  const goToDashboard = useCallback(() => {
    setState((s) => ({ ...s, view: 'new-solve', error: null }));
  }, []);

  const goToRangeSource = useCallback(() => {
    setState((s) => ({ ...s, view: 'range-source', error: null }));
  }, []);

  const setRangeSource = useCallback((source: RangeSource, label: string) => {
    setState((s) => ({ ...s, rangeSource: source, rangeSourceLabel: label }));
  }, []);

  const goToLibrary = useCallback(() => {
    setState((s) => ({ ...s, view: 'library' }));
  }, []);

  const goToAdmin = useCallback(() => {
    setState((s) => ({ ...s, view: 'admin' }));
  }, []);

  const validateConfig = useCallback((config: SolverConfig): string | null => {
    if (config.effective_stack_bb <= 0) return 'Effective stack must be greater than 0';
    if (config.pot_size_bb < 0) return 'Pot size cannot be negative';
    if (config.board.length < 3) return 'A flop is required. Select at least 3 board cards before solving.';
    const boardIds = new Set<string>();
    for (const card of config.board) {
      const id = `${card.rank}${card.suit}`;
      if (boardIds.has(id)) return 'Duplicate card on board';
      boardIds.add(id);
    }
    return null;
  }, []);

  const submitSolve = useCallback(async () => {
    if (!dbUserId) {
      setState((s) => ({ ...s, error: 'Unable to start solve — no authenticated user session found.', solveStatus: 'error' }));
      return;
    }
    const validationError = validateConfig(state.config);
    if (validationError) {
      setState((s) => ({ ...s, error: validationError, solveStatus: 'error' }));
      return;
    }

    const configHash = computeConfigHashSync(state.config);
    setState((s) => ({ ...s, solveStatus: 'solving', processingStage: 'Preparing solve', error: null }));

    const { job, error } = await createSolverJob({ config: state.config, userId: dbUserId, provider: 'deepsolver' });
    if (error || !job) {
      setState((s) => ({ ...s, solveStatus: 'error', error: error ?? 'Failed to create solve' }));
      return;
    }

    setState((s) => ({ ...s, currentJob: job, processingStage: 'Submitting to DeepSolver' }));

    const stages = ['Submitting to DeepSolver', 'Solving on DeepSolver server', 'Converting strategy data', 'Loading results'];
    let stageIdx = 0;
    const stageTimer = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1);
      setState((s) => ({ ...s, processingStage: stages[stageIdx] }));
    }, 2000);

    const { result: dsResult, error: dsError } = await solveWithDeepSolver(state.config, dbUserId, job.id);

    clearInterval(stageTimer);

    if (dsError || !dsResult) {
      await updateJobStatus(job.id, 'failed', dsError ?? 'DeepSolver did not return a result');
      setState((s) => ({
        ...s,
        solveStatus: 'error',
        error: dsError ?? 'DeepSolver solve failed. The solver did not return a result.',
      }));
      return;
    }

    setState((s) => ({
      ...s,
      solveStatus: 'solved',
      solvedConfigHash: configHash,
      processingStage: 'Complete',
      view: 'results',
      currentJob: { ...job, status: 'complete', result_data: dsResult },
      currentResult: dsResult,
      currentNode: dsResult.root_node,
      nodePath: [dsResult.root_node],
      selectedHand: null,
      error: null,
    }));

    loadJobs();
  }, [dbUserId, state.config, validateConfig, loadJobs]);

  const openJob = useCallback(async (jobId: string) => {
    const job = await fetchJobById(jobId);
    if (!job) return;
    if (job.status === 'complete' && job.result_data) {
      setState((s) => ({
        ...s,
        view: 'results',
        currentJob: job,
        currentResult: job.result_data,
        currentNode: job.result_data.root_node,
        nodePath: [job.result_data.root_node],
        selectedHand: null,
      }));
    } else if (job.status === 'processing') {
      setState((s) => ({ ...s, view: 'processing', currentJob: job, processingStage: 'Solving' }));
    }
  }, []);

  const navigateToChild = useCallback((childNode: SolverNode) => {
    setState((s) => ({
      ...s,
      currentNode: childNode,
      nodePath: [...s.nodePath, childNode],
      selectedHand: null,
    }));
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      currentNode: s.nodePath[index],
      nodePath: s.nodePath.slice(0, index + 1),
      selectedHand: null,
    }));
  }, []);

  const selectHand = useCallback((hand: string | null) => {
    setState((s) => ({ ...s, selectedHand: hand }));
  }, []);

  const toggleJobFavorite = useCallback(async (jobId: string, currentFav: boolean) => {
    await toggleFavorite(jobId, !currentFav);
    loadJobs();
  }, [loadJobs]);

  const openSaveModal = useCallback(() => {
    setState((s) => ({ ...s, saveModalOpen: true }));
  }, []);

  const closeSaveModal = useCallback(() => {
    setState((s) => ({ ...s, saveModalOpen: false }));
  }, []);

  const handleSaveToVault = useCallback(async (title: string, notes: string, tags: string[], category: string) => {
    if (!dbUserId || !state.currentJob) return;
    await saveToLibrary(state.currentJob.id, dbUserId, title, notes, tags, category, state.config, state.currentResult);
    setState((s) => ({ ...s, saveModalOpen: false }));
    loadJobs();
    loadLibrary();
  }, [dbUserId, state.currentJob, state.config, state.currentResult, loadJobs, loadLibrary]);

  const handleAddNotes = useCallback((notes: string) => {
    setState((s) => ({ ...s, currentJob: s.currentJob ? { ...s.currentJob, error_message: notes } : null }));
  }, []);

  const handleNewSolve = useCallback(() => {
    setState((s) => ({ ...s, view: 'range-source', solveStatus: 'not-solved', config: { ...DEFAULT_CONFIG }, error: null, currentJob: null, currentResult: null, currentNode: null, nodePath: [], selectedHand: null, solvedConfigHash: null, rangeSource: null, rangeSourceLabel: null }));
  }, []);

  const loadAdminJobs = useCallback(async () => {
    const jobs = await fetchAllJobsForAdmin();
    setState((s) => ({ ...s, jobs }));
  }, []);

  return {
    state,
    actions: {
      updateConfig,
      setHeroPosition,
      setVillainPosition,
      setFormat,
      setStack,
      setTableConfig,
      setBoard,
      setActionHistory,
      setHeroRange,
      setVillainRange,
      setAccuracy,
      setTreeSettings,
      resetConfig,
      startNewSolve,
      goToDashboard,
      goToRangeSource,
      setRangeSource,
      goToLibrary,
      goToAdmin,
      submitSolve,
      openJob,
      navigateToChild,
      navigateToBreadcrumb,
      selectHand,
      toggleJobFavorite,
      openSaveModal,
      closeSaveModal,
      handleSaveToVault,
      handleAddNotes,
      handleNewSolve,
      loadJobs,
      loadLibrary,
      loadAdminJobs,
      setError: (err: string | null) => setState((s) => ({ ...s, error: err })),
    },
  };
}

export type SolverHook = ReturnType<typeof useSolver>;
