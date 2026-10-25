// ─────────────────────────────────────────────────────────────────────
// DEMO / TEST DATA — Hand Workspace review hands
// A single demo hand is provided so new users see a working replayer
// and playback controls before importing their own hand history.
// Demo data is excluded from analytics stats — it only appears in the
// workspace HandRail and replayer.
// ─────────────────────────────────────────────────────────────────────

import type { NormalizedHand } from '@/features/hh-replayer/types';
import type { HandRecord } from '@/lib/handSorter';
import { DEMO_TOURNAMENT_HAND } from '@/data/demoContent';

export interface DemoReviewHand extends HandRecord {
  id: string;
  review_set_id: string;
  marked_for_coach: boolean;
  parsed_ok: boolean;
  parse_error: string | null;
  pot_amount: number | null;
  stack_size: number | null;
  saw_flop: boolean;
  saw_turn: boolean;
  saw_river: boolean;
  normalized: NormalizedHand;
}

export const DEMO_REVIEW_HANDS: DemoReviewHand[] = [
  {
    id: DEMO_TOURNAMENT_HAND.handId,
    hand_id: DEMO_TOURNAMENT_HAND.handId,
    tournament_id: null,
    position: 'BTN',
    hero_name: 'Hero',
    hero_cards: 'As Qs',
    board: 'Ks Qs 4s 9s 2c',
    net_result: DEMO_TOURNAMENT_HAND.heroNetResult ?? 0,
    stack_size: 41000,
    blinds: DEMO_TOURNAMENT_HAND.stakes,
    pot_amount: DEMO_TOURNAMENT_HAND.pot,
    played_at: '2025-07-20T19:45:00Z',
    raw_hand_text: '',
    site: DEMO_TOURNAMENT_HAND.site,
    game_mode: "Hold'em",
    review_set_id: 'demo',
    marked_for_coach: false,
    parsed_ok: true,
    parse_error: null,
    sort_order: 0,
    hand_title: DEMO_TOURNAMENT_HAND.title ?? 'Demo Hand',
    source: 'demo',
    saw_flop: true,
    saw_turn: true,
    saw_river: true,
    showdown: true,
    normalized: DEMO_TOURNAMENT_HAND,
  },
];

export const DEMO_REVIEW_SET: { id: string; title: string; hand_count: number; status: string; created_at: string } = {
  id: 'demo-review-set',
  title: 'Demo Workspace',
  hand_count: 1,
  status: 'active',
  created_at: new Date().toISOString(),
};
