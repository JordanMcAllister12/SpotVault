// ===== PLAYER NETWORK — VEGAS TOWER FLOOR CONFIGURATION =====
// Centralized floor definitions. Add, rename, reorder, or change
// qualification rules here without touching React components.

// ===== SHARED PLAYER NETWORK BACKGROUND =====
// Temporary design decision: every Player Network floor/tier uses the
// SAME Vegas hotel-suite image. Unique per-tier environments will be
// designed later. Do NOT change this to a per-floor value yet.
export const PLAYER_NETWORK_DEFAULT_BACKGROUND = '/image copy copy copy copy.webp';

export type FloorId = 1 | 2 | 3 | 4 | 5;

export interface FloorQualificationRule {
  label: string;
  description: string;
}

export interface PlayerNetworkFloor {
  id: FloorId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  aesthetic: 'motel' | 'poker-room' | 'resort' | 'high-roller' | 'penthouse';
  accentColor: string;
  ambientColor: string;
  backgroundGradient: string;
  backgroundImage?: string;
  qualifications: FloorQualificationRule[];
  usersOnline: number;
}

export const PLAYER_NETWORK_FLOORS: PlayerNetworkFloor[] = [
  {
    id: 1,
    name: 'The Motel',
    shortName: 'Motel',
    tagline: 'Where everyone starts',
    description:
      'Old-school Vegas motel energy. Neon signs, parking-lot views, a flickering TV, and poker posters on thin walls. The door is always open.',
    aesthetic: 'motel',
    accentColor: '#e8a040',
    ambientColor: '#3a2a14',
    backgroundGradient:
      'radial-gradient(ellipse at 50% 30%, #4a3a1a 0%, #2a1d0e 35%, #120c06 70%, #050302 100%)',
    backgroundImage: PLAYER_NETWORK_DEFAULT_BACKGROUND,
    qualifications: [
      { label: 'Default Access', description: 'Available to every SpotVault member — no poker data required.' },
    ],
    usersOnline: 847,
  },
  {
    id: 2,
    name: 'The Poker Room',
    shortName: 'Poker Room',
    tagline: 'Verified active players',
    description:
      'A legitimate casino poker room. Felt tables, chip racks, overhead lighting, and the constant shuffle of cards. Respectable, polished, earned.',
    aesthetic: 'poker-room',
    accentColor: '#d4a52c',
    ambientColor: '#2a2010',
    backgroundGradient:
      'radial-gradient(ellipse at 45% 25%, #5a4220 0%, #2a1d10 35%, #100a06 70%, #040302 100%)',
    backgroundImage: PLAYER_NETWORK_DEFAULT_BACKGROUND,
    qualifications: [
      { label: 'Verified Hand Histories', description: 'Uploaded and verified hand history bundles.' },
      { label: 'Verified Tournament Results', description: 'Uploaded and verified tournament summaries.' },
      { label: 'Minimum Activity', description: 'Demonstrated recent poker activity on SpotVault.' },
    ],
    usersOnline: 412,
  },
  {
    id: 3,
    name: 'The Resort',
    shortName: 'Resort',
    tagline: 'Established grinders',
    description:
      'A Vegas resort suite with Strip views, a private bar, a poker table, and modern furniture. Large windows let the city in. You have put in the work.',
    aesthetic: 'resort',
    accentColor: '#c9a44c',
    ambientColor: '#2a2418',
    backgroundGradient:
      'radial-gradient(ellipse at 55% 20%, #6a5a3a 0%, #3a2e1c 35%, #181210 70%, #060403 100%)',
    backgroundImage: PLAYER_NETWORK_DEFAULT_BACKGROUND,
    qualifications: [
      { label: 'Verified Activity', description: 'Consistent recent poker activity verified on SpotVault.' },
      { label: 'Meaningful Volume', description: 'Demonstrated volume across cash or tournament play.' },
      { label: 'ABI / Cash Stakes', description: 'Average buy-in or cash stakes above the qualifying threshold.' },
      { label: 'Recent Play', description: 'Active play within the current qualification window.' },
    ],
    usersOnline: 186,
  },
  {
    id: 4,
    name: 'High Roller Floor',
    shortName: 'High Roller',
    tagline: 'Legitimately high-stakes',
    description:
      'A private high-roller casino lounge. Premium bar, private poker table, luxury seating, and floor-to-ceiling Vegas skyline windows. Dark gold SpotVault styling throughout.',
    aesthetic: 'high-roller',
    accentColor: '#d4a52c',
    ambientColor: '#2a1e10',
    backgroundGradient:
      'radial-gradient(ellipse at 65% 15%, #8a6a2a 0%, #3a2814 30%, #1a1208 65%, #060402 100%)',
    backgroundImage: PLAYER_NETWORK_DEFAULT_BACKGROUND,
    qualifications: [
      { label: 'Cash Stakes', description: 'Verified regular participation around 25/50+ stakes.' },
      { label: 'MTT ABI', description: 'Verified rolling ABI above the high-roller threshold.' },
      { label: 'Verified Volume', description: 'Sustained high-stakes volume over the qualification window.' },
      { label: 'Qualifying Achievement', description: 'A major verified poker accomplishment or title.' },
    ],
    usersOnline: 54,
  },
  {
    id: 5,
    name: 'The Penthouse',
    shortName: 'Penthouse',
    tagline: 'The elite room',
    description:
      'A massive Vegas penthouse. Floor-to-ceiling windows, Bellagio fountain views, private bar, luxury seating, a private poker table, trophy displays, and a terrace. The top of the tower.',
    aesthetic: 'penthouse',
    accentColor: '#f0d070',
    ambientColor: '#3a2e1a',
    backgroundGradient:
      'radial-gradient(ellipse at 50% 12%, #a08850 0%, #4a3a20 28%, #1a1408 60%, #060402 100%)',
    backgroundImage: PLAYER_NETWORK_DEFAULT_BACKGROUND,
    qualifications: [
      { label: 'Cash', description: 'Verified regular participation around 50/100+ stakes.' },
      { label: 'MTT', description: 'Elite verified ABI / volume combination.' },
      { label: 'Major Accomplishment', description: 'A major verified poker accomplishment — title, bracelet, or equivalent.' },
    ],
    usersOnline: 12,
  },
];

// ===== DEMO PLAYER DATA =====
// Simulated SpotVault data for the current demo account.
// In production this will come from verified user uploads.

export interface DemoPlayerData {
  accountId: string;
  accountName: string;
  verifiedHandHistories: number;
  verifiedTournamentResults: number;
  cashStakesLevel: string;
  mttAbi: number;
  recentActivityDays: number;
  totalVolumeHands: number;
  majorAccomplishments: string[];
  label: string;
}

export const DEMO_PLAYER_DATA: DemoPlayerData = {
  accountId: 'acc-demo',
  accountName: 'Test Account',
  verifiedHandHistories: 2341,
  verifiedTournamentResults: 89,
  cashStakesLevel: '5/10',
  mttAbi: 215,
  recentActivityDays: 12,
  totalVolumeHands: 48200,
  majorAccomplishments: [],
  label: 'DEMO DATA',
};

// ===== DEMO TIER EVALUATION RESULT =====
// Pre-computed for the demo account. The tier evaluator below produces
// this same shape; this constant is used so the UI always has a stable
// demo result regardless of when the evaluator is called.

export interface FloorProgress {
  floorId: FloorId;
  percentQualified: number;
  remainingCriteria: string[];
}

export interface PlayerNetworkTierResult {
  currentFloor: FloorId;
  unlockedFloors: FloorId[];
  qualificationReasons: Record<FloorId, string[]>;
  nextFloor: FloorId | null;
  nextFloorProgress: FloorProgress | null;
  isDemo: boolean;
  // Future guest-pass data model — not yet surfaced in UI.
  permanentFloor: FloorId;
  temporaryGuestFloor: FloorId | null;
  guestPassExpiresAt: string | null;
}

export const DEMO_TIER_RESULT: PlayerNetworkTierResult = {
  currentFloor: 3,
  unlockedFloors: [1, 2, 3],
  qualificationReasons: {
    1: ['Default access — available to all members.'],
    2: ['Verified hand histories: 2,341', 'Verified tournament results: 89', 'Recent activity: 12 days'],
    3: ['MTT ABI: $215 (above $150 threshold)', 'Total volume: 48,200 hands', 'Cash stakes: 5/10'],
    4: [],
    5: [],
  },
  nextFloor: 4,
  nextFloorProgress: {
    floorId: 4,
    percentQualified: 72,
    remainingCriteria: [
      'Increase rolling ABI above $500',
      'OR meet qualifying cash-stakes threshold (25/50+)',
      'OR earn a qualifying major achievement',
    ],
  },
  isDemo: true,
};
