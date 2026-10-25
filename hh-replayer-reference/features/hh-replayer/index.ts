// ── SpotVault HH Replayer — self-contained portable module ──
//
// Usage:
//   import { HHReplayer, parsedHandToNormalized } from '@/features/hh-replayer';
//
//   <HHReplayer hand={normalizedHand} />
//   <HHReplayer hands={normalizedHands} />
//
// To adapt from a different schema, create a new adapter that produces
// a NormalizedHand and pass it to <HHReplayer>.

export { HHReplayer } from './components/HHReplayer';
export type { HHReplayerProps } from './components/HHReplayer';

export { parsedHandToNormalized, normalizedToParsedHand } from './adapters/spotVaultAdapter';

export type {
  NormalizedHand,
  NormalizedPlayer,
  NormalizedAction,
  NormalizedBoard,
  NormalizedWinner,
  Street,
  ActionType,
} from './types/NormalizedHand';

export { EMPTY_NORMALIZED_HAND } from './types/NormalizedHand';
