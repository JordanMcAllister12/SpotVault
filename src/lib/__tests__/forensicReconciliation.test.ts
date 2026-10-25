import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Forensic stat reconciliation', () => {
  it('should compute exact stat values for 7028 hands', async () => {
    const allHands: Record<string, unknown>[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('poker_hand_records')
        .select('*')
        .eq('user_id', 'acc-jordan')
        .eq('game_mode', 'mtt')
        .order('played_at', { ascending: true })
        .range(offset, offset + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      allHands.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    expect(allHands.length).toBe(7028);

    // Use the actual parser from pokerAnalytics
    const { parseHandBlock, computeNetChipsFromActions, parseBigBlind } = await import('@/lib/pokerAnalytics');
    const { analyzePreflopState, didReachShowdown } = await import('@/lib/preflopStateMachine');
    const { createEmptyAdvancedStats, computeAdvancedStatsForHand } = await import('@/lib/advancedStats');

    let vpipCount = 0, pfrCount = 0, threeBetCount = 0, threeBetOppCount = 0;
    let sawFlopCount = 0, showdownCount = 0, wtsdCount = 0, wsdCount = 0, wwsfCount = 0;
    let cbetFlopCount = 0, cbetFlopOppCount = 0, barrelTurnCount = 0, barrelTurnOppCount = 0;
    let barrelRiverCount = 0, barrelRiverOppCount = 0;

    const adv = createEmptyAdvancedStats();

    // Debug: track all-in preflop detection
    let allInPfDetected = 0;
    let allInPfMissed = 0;
    const missedHands: string[] = [];

    for (const h of allHands) {
      const rawText = h.raw_hand_text as string | null;
      const heroName = h.hero_name as string | null;
      const site = (h.site as string) || 'unknown';
      if (!rawText || !heroName) continue;

      const parsed = parseHandBlock(rawText, site, 'mtt');
      if (!parsed) continue;

      // Check if hero is all-in preflop according to parser
      const heroActs = parsed.actions.filter((a) => a.player === heroName);
      const parserAllInPf = heroActs.some((a) => a.street === 'preflop' && a.action === 'all-in');
      // Check if raw text has "Hero: ... all-in" in preflop section
      const flopIdx = rawText.indexOf('*** FLOP');
      const pfText = flopIdx > 0 ? rawText.substring(0, flopIdx) : rawText;
      const rawAllInPf = /Hero:[^\n]*all[- ]?in/i.test(pfText);

      if (rawAllInPf && !parserAllInPf) {
        allInPfMissed++;
        if (missedHands.length < 5) {
          const allPfActions = heroActs.filter((a) => a.street === 'preflop').map((a) => `${a.action}:${a.amount}`).join(', ');
          const rawPfLine = rawText.match(/Hero:[^\n]*?all[- ]?in/i)?.[0] || 'NOT FOUND';
          missedHands.push(`${h.hand_hash}: raw=${rawPfLine}, parser=${allPfActions}, sawFlop=${parsed.sawFlop}`);
        }
      }
      if (parserAllInPf) allInPfDetected++;

      // Also check: hands where sawFlop is true but raw text shows all-in
      if (parsed.sawFlop && rawAllInPf) {
        allInSawFlopMissed++;
        if (sawFlopMissedHands.length < 3) {
          sawFlopMissedHands.push(h.hand_hash as string);
        }
      }

      const { netChips } = computeNetChipsFromActions(parsed.actions, heroName);
      const bigBlind = parseBigBlind(parsed.blinds);
      let netBB: number | null = null;
      if (netChips !== null && bigBlind && bigBlind > 0) {
        netBB = Math.round((netChips / bigBlind) * 100) / 100;
      }

      const heroActions = parsed.actions.filter((a) => a.player === heroName);
      const heroFoldedPreflop = heroActions.some((a) => a.street === 'preflop' && a.action === 'fold');
      const heroFoldedFlop = heroActions.some((a) => a.street === 'flop' && a.action === 'fold');
      const heroFoldedTurn = heroActions.some((a) => a.street === 'turn' && a.action === 'fold');
      const sawFlop = parsed.sawFlop;
      const sawTurn = parsed.sawTurn;
      const sawRiver = parsed.sawRiver;

      const pfState = analyzePreflopState(parsed.actions, heroName);
      if (pfState.vpip) vpipCount++;
      if (pfState.pfr) pfrCount++;
      if (pfState.threeBetOpportunity) threeBetOppCount++;
      if (pfState.threeBet) threeBetCount++;
      if (sawFlop) sawFlopCount++;

      // C-Bet
      const preflopActions = parsed.actions.filter((a) => a.street === 'preflop');
      const preflopRaises = preflopActions.filter((a) => ['raise', 'bet', 'all-in'].includes(a.action));
      const lastRaiser = preflopRaises.length > 0 ? preflopRaises[preflopRaises.length - 1].player : null;
      const heroIsAggressor = lastRaiser === heroName;
      if (heroIsAggressor && sawFlop) {
        cbetFlopOppCount++;
        const hfb = heroActions.filter((a) => a.street === 'flop' && ['bet', 'raise', 'all-in'].includes(a.action));
        if (hfb.length > 0) cbetFlopCount++;
        if (hfb.length > 0 && sawTurn) {
          barrelTurnOppCount++;
          const htb = heroActions.filter((a) => a.street === 'turn' && ['bet', 'raise', 'all-in'].includes(a.action));
          if (htb.length > 0) barrelTurnCount++;
          if (htb.length > 0 && sawRiver) {
            barrelRiverOppCount++;
            const hrb = heroActions.filter((a) => a.street === 'river' && ['bet', 'raise', 'all-in'].includes(a.action));
            if (hrb.length > 0) barrelRiverCount++;
          }
        }
      }

      const handShowdown = didReachShowdown(rawText, heroName);
      if (handShowdown) {
        showdownCount++;
        if (sawFlop) wtsdCount++;
        if (netBB !== null && netBB > 0) wsdCount++;
      }
      if (sawFlop && netBB !== null && netBB > 0) wwsfCount++;

      // Advanced stats
      const heroPosition = parsed.position;
      computeAdvancedStatsForHand(adv, parsed.actions, heroName, heroPosition, sawFlop, sawTurn ?? false, sawRiver ?? false);
    }

    const total = allHands.length;
    console.log('\n=== FORENSIC REGRESSION TABLE ===');
    console.log(`VPIP: ${vpipCount} / ${total} = ${(vpipCount / total * 100).toFixed(1)}% (ref: 1862 / 7028 = 26.5%)`);
    console.log(`PFR: ${pfrCount} / ${total} = ${(pfrCount / total * 100).toFixed(1)}% (ref: 1210 / 7028 = 17.2%)`);
    console.log(`3-Bet: ${threeBetCount} / ${threeBetOppCount} = ${threeBetOppCount > 0 ? (threeBetCount / threeBetOppCount * 100).toFixed(1) : 0}% (ref: 301 / 3153 = 9.5%)`);
    console.log(`Flop C-Bet: ${cbetFlopCount} / ${cbetFlopOppCount} = ${cbetFlopOppCount > 0 ? (cbetFlopCount / cbetFlopOppCount * 100).toFixed(1) : 0}% (ref: 294 / 407 = 72.2%)`);
    console.log(`Turn Barrel: ${barrelTurnCount} / ${barrelTurnOppCount} = ${barrelTurnOppCount > 0 ? (barrelTurnCount / barrelTurnOppCount * 100).toFixed(1) : 0}% (ref: 69 / 139 = 49.6%)`);
    console.log(`River Barrel: ${barrelRiverCount} / ${barrelRiverOppCount} = ${barrelRiverOppCount > 0 ? (barrelRiverCount / barrelRiverOppCount * 100).toFixed(1) : 0}% (ref: 20 / 31 = 64.5%)`);
    console.log(`WTSD: ${wtsdCount} / ${sawFlopCount} = ${sawFlopCount > 0 ? (wtsdCount / sawFlopCount * 100).toFixed(1) : 0}% (ref: 365 / 1138 = 32.1%)`);
    console.log(`W$SD: ${wsdCount} / ${showdownCount} = ${showdownCount > 0 ? (wsdCount / showdownCount * 100).toFixed(1) : 0}% (ref: 346 / 677 = 51.1%)`);
    console.log(`WWSF: ${wwsfCount} / ${sawFlopCount} = ${sawFlopCount > 0 ? (wwsfCount / sawFlopCount * 100).toFixed(1) : 0}% (ref: 505 / 1138 = 44.4%)`);
    console.log(`Saw Flop: ${sawFlopCount} (ref: 1138)`);
    console.log(`Showdown: ${showdownCount} (ref: 677)`);
    console.log(`All-in PF detected by parser: ${allInPfDetected}`);
    console.log(`All-in PF missed by parser: ${allInPfMissed}`);
    if (missedHands.length > 0) {
      console.log('Missed hands:');
      missedHands.forEach((h) => console.log(`  ${h}`));
    }
    console.log('=== END TABLE ===\n');

    console.log('=== ADVANCED STATS TABLE ===');
    const pct = (n: number, d: number) => d > 0 ? (n / d * 100).toFixed(1) + '%' : 'N/A';
    console.log(`Fold to 3-Bet: ${adv.foldTo3betCount} / ${adv.foldTo3betOppCount} = ${pct(adv.foldTo3betCount, adv.foldTo3betOppCount)}`);
    console.log(`4-Bet: ${adv.fourBetCount} / ${adv.fourBetOppCount} = ${pct(adv.fourBetCount, adv.fourBetOppCount)}`);
    console.log(`Fold to 4-Bet: ${adv.foldTo4betCount} / ${adv.foldTo4betOppCount} = ${pct(adv.foldTo4betCount, adv.foldTo4betOppCount)}`);
    console.log(`Squeeze: ${adv.squeezeCount} / ${adv.squeezeOppCount} = ${pct(adv.squeezeCount, adv.squeezeOppCount)}`);
    console.log(`Limp: ${adv.limpCount} / ${adv.limpOppCount} = ${pct(adv.limpCount, adv.limpOppCount)}`);
    console.log(`Limp/Fold: ${adv.limpFoldCount} / ${adv.limpFoldOppCount} = ${pct(adv.limpFoldCount, adv.limpFoldOppCount)}`);
    console.log(`Steal %: ${adv.stealCount} / ${adv.stealOppCount} = ${pct(adv.stealCount, adv.stealOppCount)}`);
    console.log(`Fold to Steal: ${adv.foldToStealCount} / ${adv.foldToStealOppCount} = ${pct(adv.foldToStealCount, adv.foldToStealOppCount)}`);
    console.log(`Fold to Flop C-Bet: ${adv.foldToFlopCbetCount} / ${adv.foldToFlopCbetOppCount} = ${pct(adv.foldToFlopCbetCount, adv.foldToFlopCbetOppCount)}`);
    console.log(`Check-Raise Flop: ${adv.flopCheckRaiseCount} / ${adv.flopCheckRaiseOppCount} = ${pct(adv.flopCheckRaiseCount, adv.flopCheckRaiseOppCount)}`);
    console.log(`Fold to Turn Barrel: ${adv.foldToTurnBarrelCount} / ${adv.foldToTurnBarrelOppCount} = ${pct(adv.foldToTurnBarrelCount, adv.foldToTurnBarrelOppCount)}`);
    console.log(`Fold to River Barrel: ${adv.foldToRiverBarrelCount} / ${adv.foldToRiverBarrelOppCount} = ${pct(adv.foldToRiverBarrelCount, adv.foldToRiverBarrelOppCount)}`);
    console.log('=== END ADVANCED ===\n');

    expect(total).toBe(7028);
  }, 120000);
});
