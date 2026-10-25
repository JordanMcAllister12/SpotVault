// ===== Preflop Reference Data =====
// Manually entered, authoritative strategy datasets for specific preflop configurations.
// Each dataset contains the EXACT action frequencies for all 169 hands.
// The UI renders these numbers directly — it does NOT generate or modify them.
//
// Provenance: every dataset carries metadata identifying where it came from.
// When no matching reference dataset exists, the UI shows "no data available"
// rather than fabricating a range.

import type { SolverFormat, SolverPosition, SolverActionType } from './types';

export interface ReferenceHandStrategy {
  action: string;
  frequency: number; // exact 0..1
}

export interface ReferenceNodeStrategy {
  hands: Record<string, ReferenceHandStrategy[]>;
  available_actions: { action: string; label: string }[];
}

export interface ReferenceDataset {
  configurationKey: string;
  format: SolverFormat;
  solveType: 'chipev' | 'icm';
  seatCount: number;
  anteType: 'none' | 'bb_ante' | 'per_player';
  anteBB: number;
  stackBB: number;
  position: SolverPosition;
  scenario: 'unopened' | 'facing_raise' | 'facing_3bet' | 'bb_defense' | 'facing_allin';
  openerPosition?: SolverPosition;
  data: ReferenceNodeStrategy;
  source: 'reference';
  provider: string;
  solverVersion: string;
  notes?: string;
  isEmpty?: boolean;
}

// ===== Configuration key builder =====
// Produces a stable string that uniquely identifies a preflop spot.
export function buildConfigKey(params: {
  format: SolverFormat;
  solveType: 'chipev' | 'icm';
  seatCount: number;
  anteType: string;
  anteBB: number;
  stackBB: number;
  position: SolverPosition;
  scenario: string;
  openerPosition?: SolverPosition;
}): string {
  const ante = params.anteType === 'none' ? 'none' : `${params.anteType}-${params.anteBB}`;
  const opener = params.openerPosition ? `-vs-${params.openerPosition}` : '';
  return [
    params.format,
    params.solveType,
    `${params.seatCount}max`,
    ante,
    `${params.stackBB}bb`,
    params.position,
    params.scenario + opener,
  ].join('|');
}

// ===== Combo weights for aggregate calculation =====
// Pocket pair = 6 combos, Suited = 4 combos, Offsuit = 12 combos
// Total = 169 cells but 1326 combinations
export function comboCount(hand: string): number {
  if (hand.length === 2) return 6; // pair
  if (hand[2] === 's') return 4;  // suited
  return 12;                      // offsuit
}

export const TOTAL_COMBOS = 1326;

// ===== Reference datasets =====
// Each entry is an exact, manually verified strategy for a specific configuration.
// Frequencies are stored as-is from the reference source.

const REFERENCE_DATASETS: ReferenceDataset[] = [
  {
    configurationKey: 'tournament|chipev|8max|bb_ante-1|40bb|UTG|unopened',
    format: 'tournament',
    solveType: 'chipev',
    seatCount: 8,
    anteType: 'bb_ante',
    anteBB: 1,
    stackBB: 40,
    position: 'UTG',
    scenario: 'unopened',
    source: 'reference',
    provider: 'manual-test-data',
    solverVersion: 'reference-v1',
    notes: 'MTT 8-max 40bb ChipEV BB ante, UTG open. Manually entered reference data.',
    data: {
      available_actions: [
        { action: 'fold', label: 'Fold' },
        { action: 'call', label: 'Limp' },
        { action: 'raise', label: 'Raise 2.2' },
        { action: 'all-in', label: 'All-in' },
      ],
      hands: {
        // ===== Premium pairs =====
        'AA': [{ action: 'raise', frequency: 0.95 }, { action: 'all-in', frequency: 0.05 }],
        'KK': [{ action: 'raise', frequency: 0.92 }, { action: 'all-in', frequency: 0.08 }],
        'QQ': [{ action: 'raise', frequency: 0.90 }, { action: 'all-in', frequency: 0.10 }],
        'JJ': [{ action: 'raise', frequency: 0.88 }, { action: 'call', frequency: 0.12 }],
        'TT': [{ action: 'raise', frequency: 0.82 }, { action: 'call', frequency: 0.18 }],

        // ===== Medium pairs =====
        '99': [{ action: 'raise', frequency: 0.72 }, { action: 'call', frequency: 0.28 }],
        '88': [{ action: 'raise', frequency: 0.62 }, { action: 'call', frequency: 0.38 }],
        '77': [{ action: 'raise', frequency: 0.48 }, { action: 'call', frequency: 0.52 }],
        '66': [{ action: 'raise', frequency: 0.28 }, { action: 'call', frequency: 0.72 }],
        '55': [{ action: 'raise', frequency: 0.18 }, { action: 'call', frequency: 0.82 }],

        // ===== Small pairs =====
        '44': [{ action: 'call', frequency: 0.85 }, { action: 'fold', frequency: 0.15 }],
        '33': [{ action: 'call', frequency: 0.72 }, { action: 'fold', frequency: 0.28 }],
        '22': [{ action: 'call', frequency: 0.60 }, { action: 'fold', frequency: 0.40 }],

        // ===== Big slick =====
        'AKs': [{ action: 'raise', frequency: 0.95 }, { action: 'all-in', frequency: 0.05 }],
        'AKo': [{ action: 'raise', frequency: 0.92 }, { action: 'all-in', frequency: 0.08 }],

        // ===== AQ =====
        'AQs': [{ action: 'raise', frequency: 0.90 }, { action: 'call', frequency: 0.10 }],
        'AQo': [{ action: 'raise', frequency: 0.85 }, { action: 'call', frequency: 0.15 }],

        // ===== AJ =====
        'AJs': [{ action: 'raise', frequency: 0.80 }, { action: 'call', frequency: 0.20 }],
        'AJo': [{ action: 'raise', frequency: 0.65 }, { action: 'call', frequency: 0.35 }],

        // ===== AT =====
        'ATs': [{ action: 'raise', frequency: 0.70 }, { action: 'call', frequency: 0.30 }],
        'ATo': [{ action: 'raise', frequency: 0.40 }, { action: 'call', frequency: 0.50 }, { action: 'fold', frequency: 0.10 }],

        // ===== A9-A2 suited =====
        'A9s': [{ action: 'raise', frequency: 0.45 }, { action: 'call', frequency: 0.55 }],
        'A8s': [{ action: 'raise', frequency: 0.35 }, { action: 'call', frequency: 0.65 }],
        'A7s': [{ action: 'raise', frequency: 0.25 }, { action: 'call', frequency: 0.75 }],
        'A6s': [{ action: 'call', frequency: 0.80 }, { action: 'fold', frequency: 0.20 }],
        'A5s': [{ action: 'raise', frequency: 0.30 }, { action: 'call', frequency: 0.70 }],
        'A4s': [{ action: 'call', frequency: 0.75 }, { action: 'fold', frequency: 0.25 }],
        'A3s': [{ action: 'call', frequency: 0.60 }, { action: 'fold', frequency: 0.40 }],
        'A2s': [{ action: 'call', frequency: 0.45 }, { action: 'fold', frequency: 0.55 }],

        // ===== A9-A2 offsuit =====
        'A9o': [{ action: 'fold', frequency: 1.0 }],
        'A8o': [{ action: 'fold', frequency: 1.0 }],
        'A7o': [{ action: 'fold', frequency: 1.0 }],
        'A6o': [{ action: 'fold', frequency: 1.0 }],
        'A5o': [{ action: 'fold', frequency: 1.0 }],
        'A4o': [{ action: 'fold', frequency: 1.0 }],
        'A3o': [{ action: 'fold', frequency: 1.0 }],
        'A2o': [{ action: 'fold', frequency: 1.0 }],

        // ===== KQ =====
        'KQs': [{ action: 'raise', frequency: 0.75 }, { action: 'call', frequency: 0.25 }],
        'KQo': [{ action: 'raise', frequency: 0.50 }, { action: 'call', frequency: 0.40 }, { action: 'fold', frequency: 0.10 }],

        // ===== KJ =====
        'KJs': [{ action: 'raise', frequency: 0.55 }, { action: 'call', frequency: 0.45 }],
        'KJo': [{ action: 'raise', frequency: 0.25 }, { action: 'call', frequency: 0.60 }, { action: 'fold', frequency: 0.15 }],

        // ===== KT =====
        'KTs': [{ action: 'raise', frequency: 0.40 }, { action: 'call', frequency: 0.60 }],
        'KTo': [{ action: 'call', frequency: 0.40 }, { action: 'fold', frequency: 0.60 }],

        // ===== K9-K2 suited =====
        'K9s': [{ action: 'call', frequency: 0.65 }, { action: 'fold', frequency: 0.35 }],
        'K8s': [{ action: 'call', frequency: 0.40 }, { action: 'fold', frequency: 0.60 }],
        'K7s': [{ action: 'call', frequency: 0.25 }, { action: 'fold', frequency: 0.75 }],
        'K6s': [{ action: 'fold', frequency: 1.0 }],
        'K5s': [{ action: 'fold', frequency: 1.0 }],
        'K4s': [{ action: 'fold', frequency: 1.0 }],
        'K3s': [{ action: 'fold', frequency: 1.0 }],
        'K2s': [{ action: 'fold', frequency: 1.0 }],

        // ===== K9-K2 offsuit =====
        'K9o': [{ action: 'fold', frequency: 1.0 }],
        'K8o': [{ action: 'fold', frequency: 1.0 }],
        'K7o': [{ action: 'fold', frequency: 1.0 }],
        'K6o': [{ action: 'fold', frequency: 1.0 }],
        'K5o': [{ action: 'fold', frequency: 1.0 }],
        'K4o': [{ action: 'fold', frequency: 1.0 }],
        'K3o': [{ action: 'fold', frequency: 1.0 }],
        'K2o': [{ action: 'fold', frequency: 1.0 }],

        // ===== QJ =====
        'QJs': [{ action: 'raise', frequency: 0.40 }, { action: 'call', frequency: 0.60 }],
        'QJo': [{ action: 'call', frequency: 0.35 }, { action: 'fold', frequency: 0.65 }],

        // ===== QT =====
        'QTs': [{ action: 'raise', frequency: 0.25 }, { action: 'call', frequency: 0.75 }],
        'QTo': [{ action: 'fold', frequency: 1.0 }],

        // ===== Q9-Q2 suited =====
        'Q9s': [{ action: 'call', frequency: 0.55 }, { action: 'fold', frequency: 0.45 }],
        'Q8s': [{ action: 'call', frequency: 0.30 }, { action: 'fold', frequency: 0.70 }],
        'Q7s': [{ action: 'fold', frequency: 1.0 }],
        'Q6s': [{ action: 'fold', frequency: 1.0 }],
        'Q5s': [{ action: 'fold', frequency: 1.0 }],
        'Q4s': [{ action: 'fold', frequency: 1.0 }],
        'Q3s': [{ action: 'fold', frequency: 1.0 }],
        'Q2s': [{ action: 'fold', frequency: 1.0 }],

        // ===== Q9-Q2 offsuit =====
        'Q9o': [{ action: 'fold', frequency: 1.0 }],
        'Q8o': [{ action: 'fold', frequency: 1.0 }],
        'Q7o': [{ action: 'fold', frequency: 1.0 }],
        'Q6o': [{ action: 'fold', frequency: 1.0 }],
        'Q5o': [{ action: 'fold', frequency: 1.0 }],
        'Q4o': [{ action: 'fold', frequency: 1.0 }],
        'Q3o': [{ action: 'fold', frequency: 1.0 }],
        'Q2o': [{ action: 'fold', frequency: 1.0 }],

        // ===== JT =====
        'JTs': [{ action: 'raise', frequency: 0.30 }, { action: 'call', frequency: 0.70 }],
        'JTo': [{ action: 'call', frequency: 0.25 }, { action: 'fold', frequency: 0.75 }],

        // ===== J9-J2 suited =====
        'J9s': [{ action: 'call', frequency: 0.50 }, { action: 'fold', frequency: 0.50 }],
        'J8s': [{ action: 'call', frequency: 0.25 }, { action: 'fold', frequency: 0.75 }],
        'J7s': [{ action: 'fold', frequency: 1.0 }],
        'J6s': [{ action: 'fold', frequency: 1.0 }],
        'J5s': [{ action: 'fold', frequency: 1.0 }],
        'J4s': [{ action: 'fold', frequency: 1.0 }],
        'J3s': [{ action: 'fold', frequency: 1.0 }],
        'J2s': [{ action: 'fold', frequency: 1.0 }],

        // ===== J9-J2 offsuit =====
        'J9o': [{ action: 'fold', frequency: 1.0 }],
        'J8o': [{ action: 'fold', frequency: 1.0 }],
        'J7o': [{ action: 'fold', frequency: 1.0 }],
        'J6o': [{ action: 'fold', frequency: 1.0 }],
        'J5o': [{ action: 'fold', frequency: 1.0 }],
        'J4o': [{ action: 'fold', frequency: 1.0 }],
        'J3o': [{ action: 'fold', frequency: 1.0 }],
        'J2o': [{ action: 'fold', frequency: 1.0 }],

        // ===== T9 =====
        'T9s': [{ action: 'call', frequency: 0.55 }, { action: 'fold', frequency: 0.45 }],
        'T9o': [{ action: 'fold', frequency: 1.0 }],

        // ===== T8-T2 suited =====
        'T8s': [{ action: 'call', frequency: 0.30 }, { action: 'fold', frequency: 0.70 }],
        'T7s': [{ action: 'fold', frequency: 1.0 }],
        'T6s': [{ action: 'fold', frequency: 1.0 }],
        'T5s': [{ action: 'fold', frequency: 1.0 }],
        'T4s': [{ action: 'fold', frequency: 1.0 }],
        'T3s': [{ action: 'fold', frequency: 1.0 }],
        'T2s': [{ action: 'fold', frequency: 1.0 }],

        // ===== T8-T2 offsuit =====
        'T8o': [{ action: 'fold', frequency: 1.0 }],
        'T7o': [{ action: 'fold', frequency: 1.0 }],
        'T6o': [{ action: 'fold', frequency: 1.0 }],
        'T5o': [{ action: 'fold', frequency: 1.0 }],
        'T4o': [{ action: 'fold', frequency: 1.0 }],
        'T3o': [{ action: 'fold', frequency: 1.0 }],
        'T2o': [{ action: 'fold', frequency: 1.0 }],

        // ===== 98-92 suited =====
        '98s': [{ action: 'call', frequency: 0.45 }, { action: 'fold', frequency: 0.55 }],
        '97s': [{ action: 'call', frequency: 0.20 }, { action: 'fold', frequency: 0.80 }],
        '96s': [{ action: 'fold', frequency: 1.0 }],
        '95s': [{ action: 'fold', frequency: 1.0 }],
        '94s': [{ action: 'fold', frequency: 1.0 }],
        '93s': [{ action: 'fold', frequency: 1.0 }],
        '92s': [{ action: 'fold', frequency: 1.0 }],

        // ===== 98-92 offsuit =====
        '98o': [{ action: 'fold', frequency: 1.0 }],
        '97o': [{ action: 'fold', frequency: 1.0 }],
        '96o': [{ action: 'fold', frequency: 1.0 }],
        '95o': [{ action: 'fold', frequency: 1.0 }],
        '94o': [{ action: 'fold', frequency: 1.0 }],
        '93o': [{ action: 'fold', frequency: 1.0 }],
        '92o': [{ action: 'fold', frequency: 1.0 }],

        // ===== 87-82 suited =====
        '87s': [{ action: 'call', frequency: 0.30 }, { action: 'fold', frequency: 0.70 }],
        '86s': [{ action: 'fold', frequency: 1.0 }],
        '85s': [{ action: 'fold', frequency: 1.0 }],
        '84s': [{ action: 'fold', frequency: 1.0 }],
        '83s': [{ action: 'fold', frequency: 1.0 }],
        '82s': [{ action: 'fold', frequency: 1.0 }],

        // ===== 87-82 offsuit =====
        '87o': [{ action: 'fold', frequency: 1.0 }],
        '86o': [{ action: 'fold', frequency: 1.0 }],
        '85o': [{ action: 'fold', frequency: 1.0 }],
        '84o': [{ action: 'fold', frequency: 1.0 }],
        '83o': [{ action: 'fold', frequency: 1.0 }],
        '82o': [{ action: 'fold', frequency: 1.0 }],

        // ===== 76-72 suited =====
        '76s': [{ action: 'call', frequency: 0.15 }, { action: 'fold', frequency: 0.85 }],
        '75s': [{ action: 'fold', frequency: 1.0 }],
        '74s': [{ action: 'fold', frequency: 1.0 }],
        '73s': [{ action: 'fold', frequency: 1.0 }],
        '72s': [{ action: 'fold', frequency: 1.0 }],

        // ===== 76-72 offsuit =====
        '76o': [{ action: 'fold', frequency: 1.0 }],
        '75o': [{ action: 'fold', frequency: 1.0 }],
        '74o': [{ action: 'fold', frequency: 1.0 }],
        '73o': [{ action: 'fold', frequency: 1.0 }],
        '72o': [{ action: 'fold', frequency: 1.0 }],

        // ===== 65-62 suited =====
        '65s': [{ action: 'fold', frequency: 1.0 }],
        '64s': [{ action: 'fold', frequency: 1.0 }],
        '63s': [{ action: 'fold', frequency: 1.0 }],
        '62s': [{ action: 'fold', frequency: 1.0 }],

        // ===== 65-62 offsuit =====
        '65o': [{ action: 'fold', frequency: 1.0 }],
        '64o': [{ action: 'fold', frequency: 1.0 }],
        '63o': [{ action: 'fold', frequency: 1.0 }],
        '62o': [{ action: 'fold', frequency: 1.0 }],

        // ===== 54-52 suited =====
        '54s': [{ action: 'fold', frequency: 1.0 }],
        '53s': [{ action: 'fold', frequency: 1.0 }],
        '52s': [{ action: 'fold', frequency: 1.0 }],

        // ===== 54-52 offsuit =====
        '54o': [{ action: 'fold', frequency: 1.0 }],
        '53o': [{ action: 'fold', frequency: 1.0 }],
        '52o': [{ action: 'fold', frequency: 1.0 }],

        // ===== 43-42 suited =====
        '43s': [{ action: 'fold', frequency: 1.0 }],
        '42s': [{ action: 'fold', frequency: 1.0 }],

        // ===== 43-42 offsuit =====
        '43o': [{ action: 'fold', frequency: 1.0 }],
        '42o': [{ action: 'fold', frequency: 1.0 }],

        // ===== 32 =====
        '32s': [{ action: 'fold', frequency: 1.0 }],
        '32o': [{ action: 'fold', frequency: 1.0 }],
      },
    },
  },
];

const ALL_DATASETS = [...REFERENCE_DATASETS];

// ===== Runtime import registry =====
// Datasets imported via the admin import tool are stored here at runtime.
// They participate in lookups alongside the hardcoded reference datasets.

const IMPORTED_DATASETS: ReferenceDataset[] = [];

export interface ImportResult {
  success: boolean;
  dataset?: ReferenceDataset;
  error?: string;
  warnings?: string[];
}

export function registerImportedDataset(dataset: ReferenceDataset): void {
  const existingIdx = IMPORTED_DATASETS.findIndex(d => d.configurationKey === dataset.configurationKey);
  if (existingIdx >= 0) {
    IMPORTED_DATASETS[existingIdx] = dataset;
  } else {
    IMPORTED_DATASETS.push(dataset);
  }
}

export function listImportedDatasets(): ReferenceDataset[] {
  return [...IMPORTED_DATASETS];
}

export function removeImportedDataset(configurationKey: string): boolean {
  const idx = IMPORTED_DATASETS.findIndex(d => d.configurationKey === configurationKey);
  if (idx >= 0) {
    IMPORTED_DATASETS.splice(idx, 1);
    return true;
  }
  return false;
}

// ===== Validation helpers for import =====

export function validateHandName(hand: string): boolean {
  return HAND_CELLS_SET.has(hand);
}

const HAND_CELLS_SET: Set<string> = new Set([
  'AA','AKs','AKo','AQs','AQo','AJs','AJo','ATs','ATo','A9s','A9o','A8s','A8o','A7s','A7o','A6s','A6o','A5s','A5o','A4s','A4o','A3s','A3o','A2s','A2o',
  'KK','KQs','KQo','KJs','KJo','KTs','KTo','K9s','K9o','K8s','K8o','K7s','K7o','K6s','K6o','K5s','K5o','K4s','K4o','K3s','K3o','K2s','K2o',
  'QQ','QJs','QJo','QTs','QTo','Q9s','Q9o','Q8s','Q8o','Q7s','Q7o','Q6s','Q6o','Q5s','Q5o','Q4s','Q4o','Q3s','Q3o','Q2s','Q2o',
  'JJ','JTs','JTo','J9s','J9o','J8s','J8o','J7s','J7o','J6s','J6o','J5s','J5o','J4s','J4o','J3s','J3o','J2s','J2o',
  'TT','T9s','T9o','T8s','T8o','T7s','T7o','T6s','T6o','T5s','T5o','T4s','T4o','T3s','T3o','T2s','T2o',
  '99','98s','98o','97s','97o','96s','96o','95s','95o','94s','94o','93s','93o','92s','92o',
  '88','87s','87o','86s','86o','85s','85o','84s','84o','83s','83o','82s','82o',
  '77','76s','76o','75s','75o','74s','74o','73s','73o','72s','72o',
  '66','65s','65o','64s','64o','63s','63o','62s','62o',
  '55','54s','54o','53s','53o','52s','52o',
  '44','43s','43o','42s','42o',
  '33','32s','32o',
  '22',
]);

// ===== JSON Import =====

export interface JsonImportPayload {
  configuration: {
    format: SolverFormat;
    solveType: 'chipev' | 'icm';
    seatCount: number;
    anteType: 'none' | 'bb_ante' | 'per_player';
    anteBB: number;
    stackBB: number;
    position: SolverPosition;
    scenario: 'unopened' | 'facing_raise' | 'facing_3bet' | 'bb_defense' | 'facing_allin';
    openerPosition?: SolverPosition;
  };
  available_actions: { action: string; label: string }[];
  hands: Record<string, { action: string; frequency: number }[]>;
  provider?: string;
  solverVersion?: string;
  notes?: string;
}

export function importFromJson(payload: JsonImportPayload): ImportResult {
  const warnings: string[] = [];
  const c = payload.configuration;

  if (!c.format || !c.solveType || !c.position || !c.scenario) {
    return { success: false, error: 'Missing required configuration fields' };
  }
  if (typeof c.seatCount !== 'number' || typeof c.stackBB !== 'number') {
    return { success: false, error: 'seatCount and stackBB must be numbers' };
  }

  if (!payload.hands || typeof payload.hands !== 'object') {
    return { success: false, error: 'Missing hands data' };
  }

  const hands: Record<string, ReferenceHandStrategy[]> = {};
  let handCount = 0;
  let invalidHandCount = 0;

  for (const [hand, freqs] of Object.entries(payload.hands)) {
    if (!validateHandName(hand)) {
      invalidHandCount++;
      continue;
    }
    if (!Array.isArray(freqs)) {
      warnings.push(`${hand}: frequencies is not an array, skipping`);
      continue;
    }

    const validatedFreqs: ReferenceHandStrategy[] = [];
    let total = 0;
    for (const f of freqs) {
      if (typeof f.frequency !== 'number' || f.frequency < 0 || f.frequency > 1) {
        warnings.push(`${hand}: frequency ${f.frequency} out of range [0,1], clamping`);
        f.frequency = Math.max(0, Math.min(1, f.frequency));
      }
      if (!f.action || typeof f.action !== 'string') {
        warnings.push(`${hand}: missing action string, skipping entry`);
        continue;
      }
      validatedFreqs.push({ action: f.action, frequency: f.frequency });
      total += f.frequency;
    }

    if (validatedFreqs.length > 0 && Math.abs(total - 1.0) > 0.05) {
      warnings.push(`${hand}: frequencies sum to ${total.toFixed(3)}, expected ~1.0`);
    }

    hands[hand] = validatedFreqs;
    handCount++;
  }

  if (invalidHandCount > 0) {
    warnings.push(`${invalidHandCount} invalid hand names skipped`);
  }
  if (handCount === 0) {
    return { success: false, error: 'No valid hands found in import data' };
  }

  const key = buildConfigKey({
    format: c.format,
    solveType: c.solveType,
    seatCount: c.seatCount,
    anteType: c.anteType,
    anteBB: c.anteBB,
    stackBB: c.stackBB,
    position: c.position,
    scenario: c.scenario,
    openerPosition: c.openerPosition,
  });

  const dataset: ReferenceDataset = {
    configurationKey: key,
    format: c.format,
    solveType: c.solveType,
    seatCount: c.seatCount,
    anteType: c.anteType,
    anteBB: c.anteBB,
    stackBB: c.stackBB,
    position: c.position,
    scenario: c.scenario,
    openerPosition: c.openerPosition,
    data: {
      hands,
      available_actions: payload.available_actions ?? [],
    },
    source: 'reference',
    provider: payload.provider ?? 'manual-import',
    solverVersion: payload.solverVersion ?? 'imported',
    notes: payload.notes ?? `Imported on ${new Date().toISOString()}`,
    isEmpty: false,
  };

  registerImportedDataset(dataset);
  return { success: true, dataset, warnings };
}

// ===== CSV Import =====

export function importFromCsv(csvText: string, config: {
  format: SolverFormat;
  solveType: 'chipev' | 'icm';
  seatCount: number;
  anteType: 'none' | 'bb_ante' | 'per_player';
  anteBB: number;
  stackBB: number;
  position: SolverPosition;
  scenario: 'unopened' | 'facing_raise' | 'facing_3bet' | 'bb_defense' | 'facing_allin';
  openerPosition?: SolverPosition;
  actionColumns: { columnName: string; action: string; label: string }[];
}): ImportResult {
  const lines = csvText.trim().split('\n').map(l => l.trim());
  if (lines.length < 2) {
    return { success: false, error: 'CSV must have a header row and at least one data row' };
  }

  const header = lines[0].split(',').map(h => h.trim());
  const handColIdx = header.findIndex(h => h.toLowerCase() === 'hand');
  if (handColIdx < 0) {
    return { success: false, error: 'CSV must have a "Hand" column' };
  }

  const actionIndices = config.actionColumns.map(ac => ({
    ...ac,
    idx: header.findIndex(h => h.toLowerCase() === ac.columnName.toLowerCase()),
  }));

  for (const ac of actionIndices) {
    if (ac.idx < 0) {
      return { success: false, error: `CSV column "${ac.columnName}" not found` };
    }
  }

  const hands: Record<string, ReferenceHandStrategy[]> = {};
  const warnings: string[] = [];
  let handCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const hand = cols[handColIdx];
    if (!validateHandName(hand)) {
      warnings.push(`Row ${i + 1}: invalid hand "${hand}"`);
      continue;
    }

    const freqs: ReferenceHandStrategy[] = [];
    let total = 0;
    for (const ac of actionIndices) {
      const val = parseFloat(cols[ac.idx]) || 0;
      const clamped = Math.max(0, Math.min(1, val));
      if (clamped !== val) warnings.push(`${hand}: ${ac.columnName}=${val} clamped to ${clamped}`);
      if (clamped > 0) {
        freqs.push({ action: ac.action, frequency: clamped });
        total += clamped;
      }
    }

    if (freqs.length === 0) {
      freqs.push({ action: 'fold', frequency: 1.0 });
    } else if (Math.abs(total - 1.0) > 0.05) {
      warnings.push(`${hand}: frequencies sum to ${total.toFixed(3)}, expected ~1.0`);
    }

    hands[hand] = freqs;
    handCount++;
  }

  if (handCount === 0) {
    return { success: false, error: 'No valid hands found in CSV' };
  }

  const availableActions = config.actionColumns.map(ac => ({
    action: ac.action,
    label: ac.label,
  }));

  return importFromJson({
    configuration: {
      format: config.format,
      solveType: config.solveType,
      seatCount: config.seatCount,
      anteType: config.anteType,
      anteBB: config.anteBB,
      stackBB: config.stackBB,
      position: config.position,
      scenario: config.scenario,
      openerPosition: config.openerPosition,
    },
    available_actions: availableActions,
    hands,
    provider: 'csv-import',
    solverVersion: 'imported',
    notes: `Imported from CSV on ${new Date().toISOString()}`,
  });
}

// ===== Lookup =====

export function findReferenceDataset(params: {
  format: SolverFormat;
  solveType: 'chipev' | 'icm';
  seatCount: number;
  anteType: string;
  anteBB: number;
  stackBB: number;
  position: SolverPosition;
  scenario: string;
  openerPosition?: SolverPosition;
}): ReferenceDataset | null {
  const key = buildConfigKey(params);
  const imported = IMPORTED_DATASETS.find((d) => d.configurationKey === key);
  if (imported) return imported;
  return ALL_DATASETS.find((d) => d.configurationKey === key) ?? null;
}

export function listReferenceDatasets(): ReferenceDataset[] {
  return [...ALL_DATASETS, ...IMPORTED_DATASETS];
}
