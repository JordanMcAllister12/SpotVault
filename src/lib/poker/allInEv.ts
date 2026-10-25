import { parseCards, computeAllInEquityAuto, extractOpponentShowdownCards } from '@/lib/poker/handEvaluator';

export interface AllInEvResult {
  ev_bb: number | null;
  eligible: boolean;
}

/*
 * Compute all-in adjusted EV for a single hand.
 *
 * Conditions for eligibility:
 * 1. Hero was all-in (preflop or postflop).
 * 2. Hero's hole cards are known.
 * 3. At least one opponent showed their hole cards at showdown.
 * 4. Board cards are known (at least flop).
 * 5. The all-in happened before or on the board where cards are known.
 *
 * Returns ev_bb (expected big blinds won) and eligible flag.
 * If not eligible, ev_bb is null and eligible is false.
 *
 * EV is computed as: equity * pot_in_bb - investment_in_bb
 * For simplicity with the existing bb_won column, we compute:
 *   ev_bb = (equity * total_pot_bb) - hero_investment_bb
 * But since we don't reliably track investment separately,
 * we use the simpler approach:
 *   ev_bb = (equity - actual_result_indicator) * pot_size_bb + actual_bb_won
 * Actually, the standard approach is:
 *   ev_bb = equity * pot_bb - cost_bb
 * Where pot_bb is the total pot in big blinds and cost_bb is hero's
 * contribution. Since net_result already accounts for the actual
 * outcome, and bb_won is the actual BB result, we compute:
 *   allin_ev_bb = (equity * pot_bb) - hero_contribution_bb
 * And the "adjusted" part is the difference between this and bb_won.
 *
 * For aggregation into evBb100, we sum allin_ev_bb across all eligible
 * all-in hands and divide by total hands * 100.
 */
export function computeHandAllInEv(
  heroCardsStr: string | null,
  boardStr: string | null,
  rawHandText: string,
  heroName: string,
  heroAllinPreflop: boolean,
  heroAllinPostflop: boolean,
  bigBlind: number,
  potAmount: number | null,
  showdown: boolean,
  heroInvestedChips?: number | null,
): AllInEvResult {
  if (!heroAllinPreflop && !heroAllinPostflop) {
    return { ev_bb: null, eligible: false };
  }
  if (!heroCardsStr || !showdown) {
    return { ev_bb: null, eligible: false };
  }
  if (!boardStr || !bigBlind || bigBlind <= 0) {
    return { ev_bb: null, eligible: false };
  }

  const heroCards = parseCards(heroCardsStr);
  if (heroCards.length !== 2) return { ev_bb: null, eligible: false };

  const boardCards = parseCards(boardStr);
  if (boardCards.length < 3) return { ev_bb: null, eligible: false };

  const opponentCards = extractOpponentShowdownCards(rawHandText, heroName);
  if (opponentCards.length === 0) return { ev_bb: null, eligible: false };

  const equity = computeAllInEquityAuto(heroCards, opponentCards, boardCards);
  if (equity === null) return { ev_bb: null, eligible: false };

  // EV in big blinds: equity * (pot / big_blind) - (pot / big_blind) / num_players_in_pot
  // Simplified: for heads-up, hero's expected BB = equity * pot_bb - contribution_bb
  // We don't have exact contribution, but for all-in hands the contribution
  // equals the smaller of the two stacks. Since we don't have opponent stack,
  // we use: ev_bb = (equity - 0.5 for HU, or 1/n for multiway) * pot_bb
  // But this isn't quite right. The proper formula:
  //   ev_bb = equity * total_pot_bb - hero_investment_bb
  // hero_investment_bb = what hero put in (in BB). We can approximate
  // from the pot: for heads-up all-in, hero contributed ~pot/2.
  // For n players, hero contributed ~pot/n if all all-in for same amount.
  //
  // However, with uncalled bets the pot includes returned chips.
  // The most reliable approach: ev_bb = (equity * pot_bb) - (pot_bb / num_allin_players)
  // This is approximate but captures the skill component (equity vs result).
  // The SPR component uses the DIFFERENCE between this and actual bb_won
  // to measure luck-adjusted performance.

  if (!potAmount || potAmount <= 0) return { ev_bb: null, eligible: false };

  const potBB = potAmount / bigBlind;
  const numPlayers = 1 + opponentCards.length;

  // Use actual hero investment when available; fall back to pot/n approximation
  const heroInvestmentBB = (heroInvestedChips != null && heroInvestedChips > 0)
    ? heroInvestedChips / bigBlind
    : potBB / numPlayers;

  const evBB = equity * potBB - heroInvestmentBB;

  return {
    ev_bb: Math.round(evBB * 100) / 100,
    eligible: true,
  };
}
