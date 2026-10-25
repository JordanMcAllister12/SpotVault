import type {
  SolverProvider,
  SolverConfig,
  SolverResult,
  SolverNode,
  SolverJobStatus,
  ActionFrequency,
  HandStrategy,
  HandCellId,
} from './types';
import { HAND_CELLS, CARD_RANKS, CARD_SUITS, type SolverBoardCard, type SolverStreetAction } from './types';
import { classifyPreflopScenario, generatePreflopStrategy } from './preflopRanges';

// Deterministic pseudo-random based on string seed
function seededRandom(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function generateFrequencies(seed: string, actions: { action: ActionFrequency['action']; label: string; amount_pot_pct?: number }[]): ActionFrequency[] {
  const weights = actions.map((_, i) => seededRandom(`${seed}-w${i}`) * 0.8 + 0.1);
  const total = weights.reduce((s, w) => s + w, 0);
  return actions.map((a, i) => ({
    action: a.action,
    label: a.label,
    frequency: weights[i] / total,
    amount_pot_pct: a.amount_pot_pct,
  }));
}

function generateHandStrategiesFromPreflop(
  handStrats: Record<string, { action: string; frequency: number }[]>,
  actions: ActionFrequency[],
  seed: string,
): HandStrategy[] {
  return HAND_CELLS.map((hand) => {
    const handSeed = `${seed}-${hand}`;
    const rawStrat = handStrats[hand] ?? [{ action: 'fold', frequency: 1.0 }];
    // Map preflop strategy actions to the available actions
    const freqs: ActionFrequency[] = actions.map((a) => {
      const matched = rawStrat.find((s) => s.action === a.action);
      return {
        action: a.action,
        label: a.label,
        frequency: matched?.frequency ?? 0,
        amount_pot_pct: a.amount_pot_pct,
      };
    });
    const freqTotal = freqs.reduce((s, f) => s + f.frequency, 0) || 1;
    freqs.forEach((f) => { f.frequency /= freqTotal; });

    const evByAction = actions.map((a, idx) => ({
      action: a.action,
      ev: +(seededRandom(`${handSeed}-ev${idx}`) * 12 - 2).toFixed(2),
    }));
    const equity = +(seededRandom(`${handSeed}-eq`) * 0.6 + 0.2).toFixed(3);

    return { hand, frequencies: freqs, ev_by_action: evByAction, equity };
  });
}

function generateHandStrategies(seed: string, actions: ActionFrequency[]): HandStrategy[] {
  return HAND_CELLS.map((hand) => {
    const handSeed = `${seed}-${hand}`;
    const freqs = actions.map((a, idx) => {
      const variance = seededRandom(`${handSeed}-f${idx}`) * 0.4 - 0.2;
      const base = a.frequency + variance;
      return {
        action: a.action,
        label: a.label,
        frequency: Math.max(0, Math.min(1, base)),
        amount_pot_pct: a.amount_pot_pct,
      };
    });
    const freqTotal = freqs.reduce((s, f) => s + f.frequency, 0) || 1;
    freqs.forEach((f) => { f.frequency /= freqTotal; });

    const evByAction = actions.map((a, idx) => ({
      action: a.action,
      ev: +(seededRandom(`${handSeed}-ev${idx}`) * 12 - 2).toFixed(2),
    }));
    const equity = +(seededRandom(`${handSeed}-eq`) * 0.6 + 0.2).toFixed(3);

    return { hand, frequencies: freqs, ev_by_action: evByAction, equity };
  });
}

function buildNode(
  seed: string,
  street: SolverNode['street'],
  board: SolverBoardCard[],
  pot_bb: number,
  player_to_act: SolverNode['player_to_act'],
  action_to_here: SolverStreetAction[],
  depth: number,
): SolverNode {
  const nodeId = `node-${seed}`;
  const actionDefs =
    street === 'preflop'
      ? [
          { action: 'fold' as const, label: 'Fold' },
          { action: 'call' as const, label: 'Call' },
          { action: 'raise' as const, label: 'Raise 2.2x', amount_pot_pct: undefined },
        ]
      : [
          { action: 'check' as const, label: 'Check' },
          { action: 'bet' as const, label: 'Bet 33%', amount_pot_pct: 33 },
          { action: 'bet' as const, label: 'Bet 75%', amount_pot_pct: 75 },
        ];

  const availableActions = generateFrequencies(seed, actionDefs);
  let strategy: HandStrategy[];
  if (street === 'preflop') {
    const scenario = classifyPreflopScenario(action_to_here, player_to_act);
    const preflopStrat = generatePreflopStrategy(scenario, 40);
    strategy = generateHandStrategiesFromPreflop(preflopStrat, availableActions, seed);
  } else {
    strategy = generateHandStrategies(seed, availableActions);
  }

  const aggregate: ActionFrequency[] = availableActions.map((a) => ({
    ...a,
    frequency: strategy.reduce((sum, h) => {
      const f = h.frequencies.find((f) => f.action === a.action && f.label === a.label);
      return sum + (f?.frequency ?? 0);
    }, 0) / strategy.length,
  }));

  let children: SolverNode[] = [];
  if (depth < 2) {
    children = availableActions.slice(0, 2).map((a, idx) => {
      const childStreet = street;
      const childActions = [...action_to_here, {
        street,
        position: player_to_act,
        action: a.action,
        amount_pot_pct: a.amount_pot_pct,
      }];
      const otherPlayer = player_to_act === 'BTN' ? 'BB' : 'BTN';
      return buildNode(
        `${seed}-c${idx}`,
        childStreet,
        board,
        a.action === 'bet' ? pot_bb * (1 + (a.amount_pot_pct ?? 33) / 100) : pot_bb,
        otherPlayer,
        childActions,
        depth + 1,
      );
    });
  }

  return {
    id: nodeId,
    street,
    board,
    pot_bb,
    player_to_act,
    available_actions: availableActions,
    strategy_by_hand: strategy,
    aggregate_strategy: aggregate,
    children,
    parent_id: null,
    action_to_here,
  };
}

export class MockSolverProvider implements SolverProvider {
  readonly name = 'mock';
  readonly isMock = true;

  private jobs = new Map<string, { status: SolverJobStatus; config: SolverConfig; result?: SolverResult }>();

  async createTree(config: SolverConfig): Promise<{ treeId: string }> {
    const treeId = `tree-${Date.now()}`;
    return { treeId };
  }

  async submitSolve(config: SolverConfig, _treeId: string): Promise<{ jobId: string }> {
    const jobId = `mock-job-${Date.now()}`;
    this.jobs.set(jobId, { status: 'processing', config });
    return { jobId };
  }

  async getSolveStatus(jobId: string): Promise<{ status: SolverJobStatus; progress?: string; error?: string }> {
    const job = this.jobs.get(jobId);
    if (!job) return { status: 'failed', error: 'Job not found' };
    return { status: job.status };
  }

  async getSolveResult(jobId: string): Promise<SolverResult> {
    const job = this.jobs.get(jobId);
    if (!job || !job.result) throw new Error('Result not ready');

    // Mark complete
    job.status = 'complete';
    return job.result;
  }

  async cancelSolve(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  // Called by the solver service to simulate processing and generate result
  generateResult(config: SolverConfig): SolverResult {
    const seed = `${config.hero_position}-${config.villain_position}-${config.board.map((c) => c.rank + c.suit).join('')}-${config.pot_size_bb}`;
    const lastAction = config.action_history[config.action_history.length - 1];
    const playerToAct = lastAction
      ? lastAction.position === config.hero_position
        ? config.villain_position
        : config.hero_position
      : config.hero_position;

    const street = lastAction?.street ?? 'preflop';
    const rootNode = buildNode(seed, street, config.board, config.pot_size_bb, playerToAct, config.action_history, 0);

    return {
      root_node: rootNode,
      provider: this.name,
      is_mock: true,
      source: 'mock' as const,
    };
  }

  // Simulate async processing — transitions processing -> complete after delay
  async processJob(jobId: string, config: SolverConfig): Promise<SolverResult> {
    const result = this.generateResult(config);
    const job = this.jobs.get(jobId);
    if (job) {
      job.result = result;
      job.status = 'complete';
    }
    return result;
  }
}
