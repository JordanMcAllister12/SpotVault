import type {
  SolverProvider,
  SolverConfig,
  SolverResult,
  SolverJobStatus,
} from './types';

/**
 * DeepSolverProvider implements the SolverProvider interface by calling
 * the deepsolver-solve Supabase Edge Function, which proxies to the
 * DeepSolver CFR solver API.
 *
 * The edge function handles:
 *  - validation
 *  - cache lookup (by config_hash)
 *  - format conversion (SpotVault → DeepSolver)
 *  - scheduling + polling the solve
 *  - format conversion (DeepSolver → SpotVault)
 *  - persisting the result
 */
export class DeepSolverProvider implements SolverProvider {
  readonly name = 'deepsolver';
  readonly isMock = false;

  private config: SolverConfig;
  private configHash: string;
  private userId: string;
  private jobId: string | null;

  constructor(opts: { config: SolverConfig; configHash: string; userId: string; jobId?: string | null }) {
    this.config = opts.config;
    this.configHash = opts.configHash;
    this.userId = opts.userId;
    this.jobId = opts.jobId ?? null;
  }

  setJobId(jobId: string) {
    this.jobId = jobId;
  }

  async createTree(_config: SolverConfig): Promise<{ treeId: string }> {
    return { treeId: `ds-tree-${Date.now()}` };
  }

  async submitSolve(_config: SolverConfig, _treeId: string): Promise<{ jobId: string }> {
    return { jobId: `ds-job-${Date.now()}` };
  }

  async getSolveStatus(_jobId: string): Promise<{ status: SolverJobStatus; progress?: string; error?: string }> {
    return { status: 'processing' };
  }

  async getSolveResult(_jobId: string): Promise<SolverResult> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase environment not configured');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/deepsolver-solve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: this.config,
        config_hash: this.configHash,
        user_id: this.userId,
        job_id: this.jobId ?? undefined,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown error');
      let userMessage = 'Solver request failed. Please retry or contact support.';
      try {
        const parsed = JSON.parse(errBody);
        if (parsed.error) userMessage = parsed.error;
      } catch { /* not JSON */ }
      throw new Error(userMessage);
    }

    const data = await response.json() as { cached: boolean; result: SolverResult; error?: string; technical_error?: string; diagnostics?: unknown };

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.result) {
      throw new Error('DeepSolver returned no result');
    }

    return data.result;
  }

  async cancelSolve(_jobId: string): Promise<void> {
  }
}

/**
 * Compute a deterministic hash of the solver config for cache lookups.
 * This is a simple JSON-based hash — not cryptographic, but sufficient
 * for identifying identical solve configurations.
 */
export function computeConfigHash(config: SolverConfig): string {
  const normalized = {
    game_type: config.game_type,
    format: config.format,
    hero_position: config.hero_position,
    villain_position: config.villain_position,
    effective_stack_bb: config.effective_stack_bb,
    pot_size_bb: config.pot_size_bb,
    table_config: config.table_config,
    board: config.board.map(c => `${c.rank}${c.suit}`).sort(),
    action_history: config.action_history.map(a => ({
      s: a.street,
      p: a.position,
      a: a.action,
      bb: a.amount_bb,
      pct: a.amount_pot_pct,
    })),
    hero_range: config.hero_range.cells,
    villain_range: config.villain_range.cells,
    tree_settings: config.tree_settings,
    accuracy: config.accuracy,
  };
  const json = JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `cfg_${Math.abs(hash).toString(36)}`;
}
