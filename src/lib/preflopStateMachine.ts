import type { ActionEntry } from './pokerAnalytics';

export interface PreflopState {
  vpip: boolean;
  pfr: boolean;
  threeBetOpportunity: boolean;
  threeBet: boolean;
  raiseLevel: number;
  firstRaiser: string | null;
  heroRaised: boolean;
}

export function analyzePreflopState(actions: ActionEntry[], heroName: string): PreflopState {
  const preflopActions = actions.filter(a => a.street === 'preflop');

  let raiseLevel = 0;
  let firstRaiser: string | null = null;
  let heroRaised = false;
  let heroHad3betOpp = false;
  let heroThreeBet = false;

  for (const a of preflopActions) {
    if (a.action === 'post' || a.action === 'post_ante') continue;

    // 3-bet opportunity: when raiseLevel === 1 and hero faces the raise
    // (folds, calls, or reraises — all count as having had the opportunity)
    if (raiseLevel === 1 && a.player === heroName && !heroRaised) {
      heroHad3betOpp = true;
    }

    if (a.action === 'fold' || a.action === 'check') continue;

    const isRaise = a.action === 'raise' || a.action === 'all-in' || a.action === 'bet';

    if (raiseLevel === 0) {
      if (isRaise) {
        raiseLevel = 1;
        firstRaiser = a.player;
        if (a.player === heroName) heroRaised = true;
      }
    } else {
      if (isRaise) {
        raiseLevel++;
        if (a.player === heroName) {
          if (!heroRaised && raiseLevel === 2) {
            heroThreeBet = true;
          }
          heroRaised = true;
        }
      }
    }
  }

  const vpip = preflopActions.some(a =>
    a.player === heroName &&
    a.street === 'preflop' &&
    ['call', 'bet', 'raise', 'all-in'].includes(a.action)
  );

  const pfr = preflopActions.some(a =>
    a.player === heroName &&
    a.street === 'preflop' &&
    ['raise', 'all-in'].includes(a.action)
  );

  return {
    vpip,
    pfr,
    threeBetOpportunity: heroHad3betOpp,
    threeBet: heroThreeBet,
    raiseLevel,
    firstRaiser,
    heroRaised,
  };
}

export function didReachShowdown(rawHandText: string, heroName?: string): boolean {
  if (!rawHandText) return false;
  // GG Poker shows cards in the preflop/flop section (all-in) or in the
  // SHOWDOWN section. The "shows" line can appear BEFORE the SHOWDOWN marker.
  // PokerStars format: "Hero: shows [As Kh]" in the SHOWDOWN section.
  // GG format: "Hero: shows [Ad 9c]" before the FLOP marker (all-in preflop).
  // GG summary: "Hero showed [Tc Jd] and won" in the SUMMARY section.
  // We search the ENTIRE raw text for any of these patterns.
  if (heroName) {
    const escaped = heroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`${escaped}[^\\n]*?shows\\s+\\[`, 'i').test(rawHandText)) return true;
    if (new RegExp(`${escaped}[^\\n]*?showed\\s+\\[`, 'i').test(rawHandText)) return true;
    return false;
  }
  return /:\s*shows\s+\[/.test(rawHandText) || /:\s*showed\s+\[/.test(rawHandText);
}
