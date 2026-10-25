import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WINDOW_SIZE = 5000;
const MIN_HANDS = 5000;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-4o";

// The canonical demo dataset belongs to Jordan (17ca0743...).
// Non-owner users view it as read-only demo data. The edge function
// resolves the demo owner UUID internally so the viewing user's ID
// is never used to query someone else's hand records.
const DEMO_SENTINEL = "__demo__";
const DEMO_DATASET_OWNER_ID = "17ca0743-ccdb-4d43-ab24-f84aa2821170";

interface FocusArea {
  title: string;
  category: string;
  description: string;
  statKey: string;
  statValue: number;
  benchmark: string;
  priority: 'high' | 'medium';
  whyItMatters?: string;
  actionPlan?: string;
  confidence?: string;
  relatedMetrics?: string[];
}

interface AiPriority {
  title: string;
  category: string;
  confidence: string;
  explanation: string;
  whyItMatters: string;
  relatedMetrics: string[];
  exampleHandIds: string[];
  actionPlan: string;
}

interface ContextualOutlier {
  metric: string;
  explanation: string;
  actionRequired: boolean;
}

interface ProgressComparison {
  previousSnapshot: Record<string, number>;
  currentSnapshot: Record<string, number>;
  changes: Array<{
    statKey: string;
    label: string;
    previous: number;
    current: number;
    change: number;
    meaningful: boolean;
  }>;
  previousFocusAssessments: Array<{
    title: string;
    status: 'improving' | 'stable' | 'needs_attention' | 'insufficient_sample';
    detail: string;
  }>;
}

interface ExampleHand {
  handId: string;
  handHash: string;
  position: string;
  potType: string;
  bbDeep: number;
  description: string;
}

interface StructuredAiOutput {
  diagnostic_summary: string;
  priorities: AiPriority[];
  contextual_outliers: ContextualOutlier[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { userId, mode, action } = body;
    const area: string = body.area ?? 'complete_game';
    const depth: string = body.depth ?? 'standard';
    const isDemo: boolean = body.is_demo === true;

    if (!userId || !mode) {
      return new Response(JSON.stringify({ error: "Missing userId or mode" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the authenticated user matches the requested userId
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userId !== authUser.id) {
      return new Response(JSON.stringify({ error: "User ID mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---- Resolve data ownership context ----
    // PERSONAL: the authenticated user owns the hand records → userId is used for queries
    //           and diagnostics are saved under their real UUID.
    // DEMO:    the viewing user does not own the dataset → use the demo dataset owner UUID
    //           for hand queries, but save diagnostics under the __demo__ sentinel so
    //           they are shared/read-only and never attributed to the viewing user.
    const dataOwnerId: string = isDemo ? DEMO_DATASET_OWNER_ID : userId;
    const diagnosticOwnerId: string = isDemo ? DEMO_SENTINEL : userId;

    // ---- Server-side entitlement check ----
    async function checkEntitlement(requireDeep: boolean): Promise<{ allowed: boolean; error?: string }> {
      const { data: membership } = await supabase
        .from("user_memberships")
        .select("tier_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      const userTier = membership?.tier_id ?? "free";
      const hasCoach = userTier === "pro" || userTier === "elite";
      const hasDeep = userTier === "elite";

      if (!hasCoach) {
        // Check staff/superuser override via sv_roles (not user-editable primary_role)
        const { data: staffRole } = await supabase
          .from("sv_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("status", "active")
          .in("role", ["staff", "superuser", "developer_admin"])
          .maybeSingle();
        if (staffRole) {
          return { allowed: true };
        }
        // Dataset owner bypass: if the user owns eligible hand records, grant
        // personal AI Coach access regardless of membership tier.
        const { count: ownerHands } = await supabase
          .from("poker_hand_records")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("game_mode", mode)
          .not("hand_hash", "like", "%-unknown-%")
          .not("hand_hash", "like", "summary-%");
        if ((ownerHands ?? 0) >= MIN_HANDS) {
          return { allowed: true };
        }
        return { allowed: false, error: "AI Coach requires Pro or Elite membership." };
      }

      if (requireDeep && !hasDeep) {
        // Staff get deep too — check sv_roles
        const { data: staffRole } = await supabase
          .from("sv_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("status", "active")
          .in("role", ["staff", "superuser", "developer_admin"])
          .maybeSingle();
        if (!staffRole) {
          return { allowed: false, error: "Deep Analysis requires Elite membership." };
        }
      }

      return { allowed: true };
    }

    // ---- Eligibility query ----
    async function countEligibleHands(afterDate?: string): Promise<number> {
      let query = supabase
        .from("poker_hand_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", dataOwnerId)
        .eq("game_mode", mode)
        .not("hand_hash", "like", "%-unknown-%")
        .not("hand_hash", "like", "summary-%");
      if (afterDate) {
        query = query.gt("created_at", afterDate);
      }
      const { count } = await query;
      return count ?? 0;
    }

    // ---- Load existing diagnostics ----
    const { data: existingDiagnostics } = await supabase
      .from("ai_coach_diagnostics")
      .select("*")
      .eq("user_id", diagnosticOwnerId)
      .eq("mode", mode)
      .order("created_at", { ascending: true });

    const hasBaseline = existingDiagnostics && existingDiagnostics.length > 0;
    const lastDiagnostic = hasBaseline ? existingDiagnostics[existingDiagnostics.length - 1] : null;

    // ==================== STATUS ====================
    if (action === "status") {
      const eligible = await countEligibleHands();
      let newHandsSinceLast = 0;
      let nextWindowHandsNeeded = MIN_HANDS;

      if (lastDiagnostic) {
        newHandsSinceLast = await countEligibleHands(lastDiagnostic.created_at);
        nextWindowHandsNeeded = Math.max(0, WINDOW_SIZE - newHandsSinceLast);
      }

      return jsonResponse({
        eligible: eligible >= MIN_HANDS,
        totalEligibleHands: eligible,
        minRequired: MIN_HANDS,
        hasBaseline,
        diagnosticCount: existingDiagnostics?.length ?? 0,
        newHandsSinceLast,
        nextWindowHandsNeeded,
        readyForProgressReview: hasBaseline && newHandsSinceLast >= WINDOW_SIZE,
        lastDiagnosticType: lastDiagnostic?.diagnostic_type ?? null,
        lastDiagnosticDate: lastDiagnostic?.created_at ?? null,
        isDemo,
      });
    }

    // ==================== CHECK HANDS ====================
    if (action === "check_hands") {
      // Total hands (all, including unclassified)
      const { count: totalCount } = await supabase
        .from("poker_hand_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", dataOwnerId)
        .eq("game_mode", mode);

      // Classified hands (has action_sequence, not unknown/summary)
      const { count: classifiedCount } = await supabase
        .from("poker_hand_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", dataOwnerId)
        .eq("game_mode", mode)
        .not("hand_hash", "like", "%-unknown-%")
        .not("hand_hash", "like", "summary-%");

      // AI-eligible hands (classified + has hero_name + has action_sequence)
      const { count: aiEligibleCount } = await supabase
        .from("poker_hand_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", dataOwnerId)
        .eq("game_mode", mode)
        .not("hand_hash", "like", "%-unknown-%")
        .not("hand_hash", "like", "summary-%")
        .not("hero_name", "is", null);

      const total = totalCount ?? 0;
      const classified = classifiedCount ?? 0;
      const aiEligible = aiEligibleCount ?? 0;
      const excludedCount = total - aiEligible;

      let excludedReason: string | null = null;
      if (excludedCount > 0) {
        const reasons: string[] = [];
        if (total - classified > 0) reasons.push(`${total - classified} unclassified or summary-only hands`);
        if (classified - aiEligible > 0) reasons.push(`${classified - aiEligible} hands missing hero player identification`);
        excludedReason = `${excludedCount.toLocaleString()} hands excluded: ${reasons.join(', ')}.`;
      }

      return jsonResponse({
        totalHands: total,
        classifiedHands: classified,
        aiEligibleHands: aiEligible,
        minRequired: MIN_HANDS,
        status: aiEligible >= MIN_HANDS ? 'ready' : 'insufficient',
        excludedReason,
      });
    }

    // ==================== RUN ====================
    if (action === "run") {
      // 1. Entitlement check (demo mode bypasses entitlement)
      if (!isDemo) {
        const requireDeep = depth === 'deep';
        const entitlement = await checkEntitlement(requireDeep);
        if (!entitlement.allowed) {
          return jsonResponse({ error: entitlement.error }, 403);
        }
      }

      // 2. Determine diagnostic type
      const isProgressReview = hasBaseline;

      // 3. Check hand count
      if (isProgressReview) {
        const handsAfter = await countEligibleHands(lastDiagnostic.created_at);
        if (handsAfter < WINDOW_SIZE) {
          return jsonResponse({
            error: `Need ${WINDOW_SIZE} new hands since last diagnostic. Currently have ${handsAfter}.`,
          }, 400);
        }
      } else {
        const totalEligible = await countEligibleHands();
        if (totalEligible < MIN_HANDS) {
          return jsonResponse({
            error: `Need at least ${MIN_HANDS} classified hands. Currently have ${totalEligible}.`,
          }, 400);
        }
      }

      // 4. Reroll prevention — if a diagnostic for this cohort already exists, return it
      if (lastDiagnostic && lastDiagnostic.diagnostic_type === (isProgressReview ? 'progress_review' : 'baseline')) {
        const existingCohort = lastDiagnostic.cohort_hand_ids as string[] | null;
        if (existingCohort && existingCohort.length === WINDOW_SIZE) {
          return jsonResponse({
            diagnosticId: lastDiagnostic.id,
            diagnosticType: lastDiagnostic.diagnostic_type,
            windowHandCount: lastDiagnostic.window_hand_count,
            classifiedHandCountAtCheckpoint: lastDiagnostic.classified_hand_count_at_checkpoint,
            statisticalSnapshot: lastDiagnostic.statistical_snapshot,
            lifetimeSnapshot: lastDiagnostic.lifetime_snapshot,
            focusAreas: lastDiagnostic.focus_areas,
            exampleHands: [],
            aiOutput: lastDiagnostic.ai_output,
            progressComparison: lastDiagnostic.progress_comparison,
            alreadyExists: true,
          });
        }
      }

      // 5. Count new hands since last checkpoint (for progress tracking)
      let newHandsSinceLast = 0;
      let excessNewHands = 0;
      if (isProgressReview && lastDiagnostic) {
        newHandsSinceLast = await countEligibleHands(lastDiagnostic.created_at);
        excessNewHands = Math.max(0, newHandsSinceLast - WINDOW_SIZE);
      }

      // 6. Compute LIFETIME statistical snapshot from ALL eligible hands
      // This uses the full available dataset to identify candidate tendencies
      const totalEligibleNow = await countEligibleHands();

      // For lifetime stats, fetch all hands via batched pagination (Supabase caps at 1000 rows/query)
      const LIFETIME_CAP = 50000;
      const lifetimeHands = await fetchBatched(
        supabase,
        "poker_hand_records",
        "id, hero_name, position, pot_type, blinds, action_sequence, saw_flop, saw_turn, saw_river, showdown, net_result, buy_in",
        { userId: dataOwnerId, mode, notHeroNull: true },
        LIFETIME_CAP,
        false
      );
      if (lifetimeHands === null) {
        return jsonResponse({ error: "Failed to retrieve lifetime hand data." }, 500);
      }

      const lifetimeStats = computeStatisticalSnapshot(lifetimeHands ?? [], area);

      // 7. Generate candidate findings from LIFETIME stats (not window)
      // The full available dataset identifies what deserves investigation
      const candidateFindings = identifyFocusAreas(lifetimeStats, area, depth);

      // 8. Freeze the 5,000-hand analysis window via batched pagination
      // Supabase PostgREST caps at 1000 rows per query, so we fetch in batches
      const windowHands = isProgressReview && lastDiagnostic
        ? await fetchBatched(
            supabase,
            "poker_hand_records",
            "id, hand_hash, hero_name, position, pot_type, hero_cards, starting_hand_class, played_at, created_at, blinds, action_sequence, saw_flop, saw_turn, saw_river, showdown, net_result, buy_in",
            { userId: dataOwnerId, mode, notHeroNull: true, afterDate: lastDiagnostic.created_at },
            WINDOW_SIZE,
            true // ascending = oldest first for progress review
          )
        : await fetchBatched(
            supabase,
            "poker_hand_records",
            "id, hand_hash, hero_name, position, pot_type, hero_cards, starting_hand_class, played_at, created_at, blinds, action_sequence, saw_flop, saw_turn, saw_river, showdown, net_result, buy_in",
            { userId: dataOwnerId, mode, notHeroNull: true },
            WINDOW_SIZE,
            false // descending = most recent first for baseline
          );

      if (!windowHands || windowHands.length < MIN_HANDS) {
        return jsonResponse({
          error: `Failed to retrieve analysis window. Got ${windowHands?.length ?? 0} hands.`,
        }, 500);
      }

      // Freeze cohort hand IDs
      const cohortHandIds = windowHands.map((h: any) => h.id);

      // 9. Compute WINDOW statistical snapshot (distinct from lifetime)
      const windowStats = computeStatisticalSnapshot(windowHands, area);

      // 10. Retrieve relevant candidate hands from the window (20-50 per focus area)
      const relevantHands = findRelevantHands(windowHands, candidateFindings, area);

      // 11. Build structured AI payload with BOTH lifetime and window stats
      const aiPayload = buildStructuredPayload(
        lifetimeStats, windowStats, candidateFindings, relevantHands,
        area, depth, mode, isProgressReview, lastDiagnostic,
        totalEligibleNow, newHandsSinceLast, excessNewHands
      );

      // 12. Call AI if available, otherwise use heuristic output
      let aiOutput: { summary: string; recommendations: string[]; priorities?: AiPriority[]; contextual_outliers?: ContextualOutlier[] };
      let aiProvider: string | null = null;
      let aiModel: string | null = null;
      let aiRawOutput: any = null;

      if (OPENAI_API_KEY) {
        try {
          const aiResult = await callOpenAI(aiPayload);
          aiOutput = aiResult.output;
          aiProvider = 'openai';
          aiModel = OPENAI_MODEL;
          aiRawOutput = aiResult.raw;
        } catch (aiErr) {
          aiOutput = buildHeuristicOutput(windowStats, candidateFindings, relevantHands, isProgressReview);
          aiProvider = 'heuristic_fallback';
        }
      } else {
        aiOutput = buildHeuristicOutput(windowStats, candidateFindings, relevantHands, isProgressReview);
        aiProvider = 'heuristic';
      }

      // 13. Validate structured AI output
      const validated = validateAiOutput(aiOutput);

      // 14. Select 1-3 example hands for player display
      const selectedExamples = selectExampleHands(relevantHands, validated.priorities);

      // 15. Compute progress comparison: previous window stats vs new window stats
      let progressComparison: ProgressComparison | undefined;
      if (isProgressReview && lastDiagnostic) {
        progressComparison = computeProgressComparison(
          lastDiagnostic.statistical_snapshot as Record<string, number>,
          windowStats,
          (lastDiagnostic.ai_output?.priorities ?? lastDiagnostic.focus_areas) as FocusArea[],
          windowStats
        );
      }

      // 16. Determine window boundaries
      const windowStart = windowHands[0];
      const windowEnd = windowHands[windowHands.length - 1];

      // 17. Save immutable diagnostic with BOTH snapshots
      const { data: saved, error: saveError } = await supabase
        .from("ai_coach_diagnostics")
        .insert({
          user_id: diagnosticOwnerId,
          mode,
          diagnostic_type: isProgressReview ? 'progress_review' : 'baseline',
          area,
          depth,
          cohort_hand_ids: cohortHandIds,
          window_start: windowStart?.played_at,
          window_end: windowEnd?.played_at,
          window_start_hand_id: windowStart?.id,
          window_end_hand_id: windowEnd?.id,
          window_hand_count: windowHands.length,
          classified_hand_count_at_checkpoint: totalEligibleNow,
          total_eligible_at_checkpoint: totalEligibleNow,
          lifetime_snapshot: lifetimeStats,
          excess_new_hands: excessNewHands,
          statistical_snapshot: windowStats,
          focus_areas: candidateFindings,
          relevant_candidate_hand_ids: relevantHands.map(h => h.handId),
          selected_example_hand_ids: selectedExamples.map(h => h.handId),
          ai_output: validated,
          ai_provider: aiProvider,
          ai_model: aiModel,
          ai_raw_output: aiRawOutput,
          progress_comparison: progressComparison ?? null,
          previous_diagnostic_id: lastDiagnostic?.id ?? null,
          new_hands_since_last: isProgressReview ? newHandsSinceLast : null,
        })
        .select("id")
        .single();

      if (saveError) {
        return jsonResponse({ error: "Failed to save diagnostic" }, 500);
      }

      return jsonResponse({
        diagnosticId: saved.id,
        diagnosticType: isProgressReview ? 'progress_review' : 'baseline',
        windowHandCount: windowHands.length,
        classifiedHandCountAtCheckpoint: totalEligibleNow,
        totalEligibleAtCheckpoint: totalEligibleNow,
        lifetimeSnapshot: lifetimeStats,
        statisticalSnapshot: windowStats,
        focusAreas: candidateFindings,
        exampleHands: selectedExamples,
        aiOutput: validated,
        progressComparison,
        aiProvider,
        excessNewHands,
      });
    }

    // ==================== HISTORY ====================
    if (action === "history") {
      const { data: history } = await supabase
        .from("ai_coach_diagnostics")
        .select("id, diagnostic_type, created_at, window_hand_count, classified_hand_count_at_checkpoint, total_eligible_at_checkpoint, lifetime_snapshot, excess_new_hands, focus_areas, ai_output, progress_comparison, new_hands_since_last, area, depth, ai_provider, ai_model")
        .eq("user_id", diagnosticOwnerId)
        .eq("mode", mode)
        .order("created_at", { ascending: true });

      return jsonResponse({ diagnostics: history ?? [] });
    }

    // ==================== GET ====================
    if (action === "get") {
      const { diagnosticId } = body;
      const { data: diagnostic } = await supabase
        .from("ai_coach_diagnostics")
        .select("*")
        .eq("id", diagnosticId)
        .single();

      return jsonResponse({ diagnostic });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `AI Coach request failed: ${msg}` }, 500);
  }
});

// ============================================================
// BATCHED PAGINATION — Supabase PostgREST caps at 1000 rows per query
// ============================================================
interface BatchParams {
  userId: string;
  mode: string;
  notHeroNull?: boolean;
  afterDate?: string;
}

async function fetchBatched(
  client: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  params: BatchParams,
  limit: number,
  ascending: boolean
): Promise<any[] | null> {
  const BATCH_SIZE = 1000;
  const results: any[] = [];
  let offset = 0;

  while (offset < limit) {
    const batchSize = Math.min(BATCH_SIZE, limit - offset);
    let query = client
      .from(table)
      .select(columns)
      .eq("user_id", params.userId)
      .eq("game_mode", params.mode)
      .not("hand_hash", "like", "%-unknown-%")
      .not("hand_hash", "like", "summary-%");

    if (params.notHeroNull) {
      query = query.not("hero_name", "is", null);
    }
    if (params.afterDate) {
      query = query.gt("created_at", params.afterDate);
    }

    query = query
      .order("created_at", { ascending })
      .range(offset, offset + batchSize - 1);

    const { data, error } = await query;
    if (error) return null;
    if (!data || data.length === 0) break;

    results.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return results.slice(0, limit);
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// STATISTICAL SNAPSHOT COMPUTATION
// ============================================================
function computeStatisticalSnapshot(hands: any[], area: string): Record<string, number> {
  const total = hands.length;
  let vpip = 0, pfr = 0, threeBet = 0, threeBetOpp = 0;
  let cbetFlop = 0, cbetFlopOpp = 0;
  let barrelTurn = 0, barrelTurnOpp = 0;
  let barrelRiver = 0, barrelRiverOpp = 0;
  let wtsd = 0, wsd = 0, wwsf = 0;
  let sawFlop = 0, sawTurn = 0, sawRiver = 0, showdown = 0;
  let bbWon = 0;
  let foldTo3bet = 0, foldTo3betOpp = 0;
  let steal = 0, stealOpp = 0;
  let foldToSteal = 0, foldToStealOpp = 0;
  let limp = 0, limpOpp = 0;
  let flopDonkBet = 0, flopDonkBetOpp = 0;
  let turnProbe = 0, turnProbeOpp = 0;
  let delayedCbet = 0, delayedCbetOpp = 0;

  // Position-based tracking for deep analysis
  const byPosition: Record<string, { vpip: number; pfr: number; count: number; threeBet: number; threeBetOpp: number }> = {};

  for (const h of hands) {
    if (h.saw_flop) sawFlop++;
    if (h.saw_turn) sawTurn++;
    if (h.saw_river) sawRiver++;
    if (h.showdown) {
      showdown++;
      if (h.saw_flop) wtsd++;
    }
    if (h.net_result != null) {
      bbWon += Number(h.net_result);
      if (h.showdown && Number(h.net_result) > 0) wsd++;
      if (h.saw_flop && Number(h.net_result) > 0) wwsf++;
    }

    const pos = h.position ?? 'unknown';
    if (!byPosition[pos]) byPosition[pos] = { vpip: 0, pfr: 0, count: 0, threeBet: 0, threeBetOpp: 0 };
    byPosition[pos].count++;

    const actions = h.action_sequence;
    if (actions && Array.isArray(actions)) {
      const pfActions = actions.filter((a: any) => a.street === 'preflop');
      const heroPf = pfActions.filter((a: any) => a.player === h.hero_name);

      if (heroPf.some((a: any) => ['call', 'raise', 'all-in'].includes(a.action) && a.action !== 'post' && a.action !== 'post_ante')) {
        vpip++;
        byPosition[pos].vpip++;
      }
      if (heroPf.some((a: any) => ['raise', 'all-in'].includes(a.action))) {
        pfr++;
        byPosition[pos].pfr++;
      }

      let raiseLevel = 0;
      let heroOpened = false, hero3bet = false;
      for (const a of pfActions) {
        if (a.action === 'post' || a.action === 'post_ante') continue;
        const isHero = a.player === h.hero_name;
        const isRaiser = ['raise', 'bet', 'all-in'].includes(a.action);
        if (raiseLevel === 0 && isRaiser) {
          raiseLevel = 1;
          if (isHero) heroOpened = true;
        } else if (raiseLevel === 1 && isRaiser) {
          raiseLevel = 2;
          if (isHero) hero3bet = true;
        } else if (raiseLevel >= 2 && isRaiser) {
          raiseLevel = 3;
        }
        if (heroOpened && raiseLevel === 2 && !isHero) {
          foldTo3betOpp++;
          if (isHero && a.action === 'fold') foldTo3bet++;
        }
      }
      if (raiseLevel >= 2) {
        threeBetOpp++;
        byPosition[pos].threeBetOpp++;
        if (hero3bet) {
          threeBet++;
          byPosition[pos].threeBet++;
        }
      }

      if (['CO', 'BTN', 'SB'].includes(h.position)) {
        const heroIsRaiser = heroPf.some((a: any) => ['raise', 'bet', 'all-in'].includes(a.action));
        if (heroIsRaiser) { stealOpp++; steal++; }
      }
      if (['SB', 'BB'].includes(h.position)) {
        const hasRaiser = pfActions.some((a: any) => ['raise', 'bet', 'all-in'].includes(a.action) && a.action !== 'post' && a.action !== 'post_ante');
        if (hasRaiser) {
          foldToStealOpp++;
          if (heroPf.some((a: any) => a.action === 'fold')) foldToSteal++;
        }
      }
      if (raiseLevel === 0 && heroPf.some((a: any) => a.action === 'call')) {
        limpOpp++; limp++;
      }
    }

    const flopActions = actions?.filter((a: any) => a.street === 'flop') ?? [];
    const heroFlopBets = flopActions.filter((a: any) => a.player === h.hero_name && ['bet', 'raise', 'all-in'].includes(a.action));
    const lastPfRaiser = pfLastRaiser(actions);
    if (lastPfRaiser === h.hero_name && h.saw_flop) {
      cbetFlopOpp++;
      if (heroFlopBets.length > 0) {
        cbetFlop++;
        if (h.saw_turn) {
          barrelTurnOpp++;
          const heroTurnBets = actions?.filter((a: any) => a.street === 'turn' && a.player === h.hero_name && ['bet', 'raise', 'all-in'].includes(a.action)) ?? [];
          if (heroTurnBets.length > 0) {
            barrelTurn++;
            if (h.saw_river) {
              barrelRiverOpp++;
              const heroRiverBets = actions?.filter((a: any) => a.street === 'river' && a.player === h.hero_name && ['bet', 'raise', 'all-in'].includes(a.action)) ?? [];
              if (heroRiverBets.length > 0) barrelRiver++;
            }
          } else if (h.saw_turn && !h.saw_river) {
            delayedCbetOpp++;
            if (heroTurnBets.length > 0) delayedCbet++;
          }
        }
      }
    }

    if (lastPfRaiser !== h.hero_name && h.saw_flop) {
      const oppFlopBets = flopActions.some((a: any) => a.player !== h.hero_name && ['bet', 'raise', 'all-in'].includes(a.action));
      if (oppFlopBets) {
        flopDonkBetOpp++;
        if (heroFlopBets.length > 0) flopDonkBet++;
      }
    }

    if (lastPfRaiser !== h.hero_name && h.saw_turn) {
      const turnActions = actions?.filter((a: any) => a.street === 'turn') ?? [];
      const oppTurnChecked = turnActions.some((a: any) => a.player !== h.hero_name && a.action === 'check');
      if (oppTurnChecked) {
        turnProbeOpp++;
        const heroTurnBets = turnActions.filter((a: any) => a.player === h.hero_name && ['bet', 'raise', 'all-in'].includes(a.action));
        if (heroTurnBets.length > 0) turnProbe++;
      }
    }
  }

  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
  const bb100 = total > 0 ? Math.round((bbWon / total) * 100 * 1000) / 1000 : 0;

  const snapshot: Record<string, number> = {
    hands: total,
    bbWon: Math.round(bbWon * 100) / 100,
    bb100,
    vpip: pct(vpip, total),
    pfr: pct(pfr, total),
    threeBet: pct(threeBet, threeBetOpp),
    threeBetOpp,
    cbetFlop: pct(cbetFlop, cbetFlopOpp),
    cbetFlopOpp,
    barrelTurn: pct(barrelTurn, barrelTurnOpp),
    barrelTurnOpp,
    barrelRiver: pct(barrelRiver, barrelRiverOpp),
    barrelRiverOpp,
    wtsd: pct(wtsd, sawFlop),
    wsd: pct(wsd, showdown),
    wwsf: pct(wwsf, sawFlop),
    sawFlop, sawTurn, sawRiver, showdown,
    foldTo3bet: pct(foldTo3bet, foldTo3betOpp),
    foldTo3betOpp,
    steal: pct(steal, stealOpp),
    stealOpp,
    foldToSteal: pct(foldToSteal, foldToStealOpp),
    foldToStealOpp,
    limp: pct(limp, limpOpp),
    limpOpp,
    flopDonkBet: pct(flopDonkBet, flopDonkBetOpp),
    flopDonkBetOpp,
    turnProbe: pct(turnProbe, turnProbeOpp),
    turnProbeOpp,
    delayedCbet: pct(delayedCbet, delayedCbetOpp),
    delayedCbetOpp,
  };

  // Add per-position stats for deep analysis
  if (area === 'preflop' || area === 'complete_game' || depth === 'deep') {
    for (const [pos, data] of Object.entries(byPosition)) {
      if (data.count >= 50) {
        snapshot[`vpip_${pos}`] = pct(data.vpip, data.count);
        snapshot[`pfr_${pos}`] = pct(data.pfr, data.count);
        snapshot[`threeBet_${pos}`] = pct(data.threeBet, data.threeBetOpp);
        snapshot[`hands_${pos}`] = data.count;
      }
    }
  }

  return snapshot;
}

function pfLastRaiser(actions: any[]): string | null {
  if (!actions || !Array.isArray(actions)) return null;
  const raisers = actions.filter((a: any) => a.street === 'preflop' && ['raise', 'bet', 'all-in'].includes(a.action));
  return raisers.length > 0 ? raisers[raisers.length - 1].player : null;
}

// ============================================================
// CANDIDATE FINDING GENERATION (deterministic)
// ============================================================
function identifyFocusAreas(stats: Record<string, number>, area: string, depth: string): FocusArea[] {
  const areas: FocusArea[] = [];
  const isPreflop = area === 'preflop';
  const isPostflop = area === 'postflop';
  const isDeep = depth === 'deep';

  // --- Preflop findings ---
  if (!isPostflop) {
    if (stats.threeBetOpp >= 50) {
      if (stats.threeBet < 5) {
        areas.push({
          title: '3-Bet Frequency',
          category: 'Preflop',
          description: `Your 3-bet frequency of ${stats.threeBet}% is below the typical 7-10% range. Consider widening your 3-bet bluffing range, especially against late-position opens.`,
          statKey: 'threeBet', statValue: stats.threeBet,
          benchmark: '7-10% overall', priority: 'high',
          relatedMetrics: ['foldTo3bet', 'pfr'],
        });
      } else if (stats.threeBet > 12) {
        areas.push({
          title: '3-Bet Overfrequency',
          category: 'Preflop',
          description: `Your 3-bet frequency of ${stats.threeBet}% is above the typical range. Ensure your 3-betting range is balanced and not overly bluff-heavy.`,
          statKey: 'threeBet', statValue: stats.threeBet,
          benchmark: '7-10% overall', priority: 'medium',
          relatedMetrics: ['foldTo3bet', 'pfr'],
        });
      }
    }

    if (stats.foldTo3betOpp >= 50 && stats.foldTo3bet > 65) {
      areas.push({
        title: 'Over-Folding to 3-Bets',
        category: 'Preflop',
        description: `You fold to ${stats.foldTo3bet}% of 3-bets, above the typical 50-55% range. Opponents may exploit you by 3-bet bluffing frequently.`,
        statKey: 'foldTo3bet', statValue: stats.foldTo3bet,
        benchmark: '50-55%', priority: 'medium',
        relatedMetrics: ['threeBet', 'vpip'],
      });
    }

    if (stats.stealOpp >= 50 && stats.steal < 25) {
      areas.push({
        title: 'Steal Attempt Frequency',
        category: 'Preflop',
        description: `Your steal rate of ${stats.steal}% from late position is below the typical 30-35% range. Consider widening your opening range from CO/BTN.`,
        statKey: 'steal', statValue: stats.steal,
        benchmark: '30-35% from late position', priority: 'medium',
        relatedMetrics: ['pfr', 'vpip'],
      });
    }

    if (isDeep) {
      // Position-specific preflop analysis
      for (const pos of ['CO', 'BTN', 'SB', 'BB', 'UTG', 'MP']) {
        const posVpip = stats[`vpip_${pos}`];
        const posPfr = stats[`pfr_${pos}`];
        const posHands = stats[`hands_${pos}`];
        if (posHands >= 100 && posVpip != null) {
          const gap = posVpip - posPfr;
          if (gap > 15) {
            areas.push({
              title: `High VPIP/PFR Gap in ${pos}`,
              category: 'Preflop',
              description: `In ${pos} position, your VPIP/PFR gap is ${gap.toFixed(1)}% (VPIP ${posVpip}%, PFR ${posPfr}%). A large gap suggests excessive limping or cold-calling.`,
              statKey: `vpip_${pos}`, statValue: posVpip,
              benchmark: 'VPIP/PFR gap < 8%', priority: 'medium',
              relatedMetrics: [`pfr_${pos}`, 'limp'],
            });
          }
        }
      }
    }
  }

  // --- Postflop findings ---
  if (!isPreflop) {
    if (stats.cbetFlopOpp >= 50) {
      if (stats.cbetFlop < 45) {
        areas.push({
          title: 'Flop C-Bet Frequency',
          category: 'Postflop',
          description: `Your flop c-bet frequency of ${stats.cbetFlop}% is below the typical 55-65% range for single-raised pots. Consider c-betting more frequently with your range advantage.`,
          statKey: 'cbetFlop', statValue: stats.cbetFlop,
          benchmark: '55-65% in SRP', priority: 'high',
          relatedMetrics: ['barrelTurn', 'wwsf'],
        });
      } else if (stats.cbetFlop > 80) {
        areas.push({
          title: 'Flop C-Bet Overfrequency',
          category: 'Postflop',
          description: `Your flop c-bet frequency of ${stats.cbetFlop}% is above optimal. You may be c-betting too many boards, making you exploitable.`,
          statKey: 'cbetFlop', statValue: stats.cbetFlop,
          benchmark: '55-65% in SRP', priority: 'medium',
          relatedMetrics: ['barrelTurn', 'barrelRiver'],
        });
      }
    }

    if (stats.barrelTurnOpp >= 30 && stats.barrelTurn < 35) {
      areas.push({
        title: 'Turn Barrel Frequency',
        category: 'Postflop',
        description: `Your turn barrel frequency of ${stats.barrelTurn}% is below the typical 45-55% range. Consider double-barreling more on favorable turn cards.`,
        statKey: 'barrelTurn', statValue: stats.barrelTurn,
        benchmark: '45-55%', priority: 'medium',
        relatedMetrics: ['cbetFlop', 'barrelRiver'],
      });
    }

    if (stats.sawFlop >= 200) {
      if (stats.wtsd > 35) {
        areas.push({
          title: 'Went to Showdown Frequency',
          category: 'Postflop',
          description: `Your WTSD of ${stats.wtsd}% is above the typical 25-30% range. You may be calling too frequently on later streets.`,
          statKey: 'wtsd', statValue: stats.wtsd,
          benchmark: '25-30%', priority: 'high',
          relatedMetrics: ['wsd', 'wwsf'],
        });
      } else if (stats.wtsd < 20 && stats.sawFlop >= 300) {
        areas.push({
          title: 'Folding Too Frequently',
          category: 'Postflop',
          description: `Your WTSD of ${stats.wtsd}% is below the typical range. You may be over-folding on turn and river.`,
          statKey: 'wtsd', statValue: stats.wtsd,
          benchmark: '25-30%', priority: 'medium',
          relatedMetrics: ['wsd', 'wwsf'],
        });
      }
    }

    if (stats.sawFlop >= 200 && stats.wwsf < 45) {
      areas.push({
        title: 'Won When Saw Flop',
        category: 'Postflop',
        description: `Your WWSF of ${stats.wwsf}% is below the typical ~50% range. You may be playing too passively postflop.`,
        statKey: 'wwsf', statValue: stats.wwsf,
        benchmark: '~50%', priority: 'medium',
        relatedMetrics: ['cbetFlop', 'wtsd'],
      });
    }

    if (isDeep) {
      // Multi-street interaction analysis
      if (stats.cbetFlopOpp >= 50 && stats.barrelTurnOpp >= 30) {
        const aggressionContinuity = stats.barrelTurn;
        if (stats.cbetFlop > 60 && aggressionContinuity < 40) {
          areas.push({
            title: 'Flop Aggression / Turn Passivity Mismatch',
            category: 'Postflop',
            description: `You c-bet ${stats.cbetFlop}% of flops but only barrel ${aggressionContinuity}% of turns. This mismatch may indicate you're c-betting too wide and giving up too often on turns. However, this may also be a deliberate strategy if your river play compensates.`,
            statKey: 'barrelTurn', statValue: aggressionContinuity,
            benchmark: '45-55% turn barrel after flop c-bet', priority: 'medium',
            relatedMetrics: ['cbetFlop', 'barrelRiver', 'wwsf'],
          });
        }
      }
    }
  }

  // Sort by priority and take top 2
  areas.sort((a, b) => a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0);
  return areas.slice(0, 2);
}

// ============================================================
// RELEVANT HAND RETRIEVAL (20-50 per focus area)
// ============================================================
function findRelevantHands(hands: any[], focusAreas: FocusArea[], area: string): ExampleHand[] {
  const examples: ExampleHand[] = [];
  const seen = new Set<string>();
  const maxPerArea = area === 'complete_game' ? 25 : 40;

  for (const fa of focusAreas) {
    let candidates: any[] = [];

    if (fa.statKey === 'cbetFlop') {
      candidates = hands.filter(h => {
        if (!h.saw_flop || !h.action_sequence) return false;
        const lastRaiser = pfLastRaiser(h.action_sequence);
        if (lastRaiser !== h.hero_name) return false;
        const heroFlopActions = h.action_sequence.filter((a: any) => a.street === 'flop' && a.player === h.hero_name);
        return heroFlopActions.length > 0;
      });
    } else if (fa.statKey === 'threeBet') {
      candidates = hands.filter(h => {
        if (!h.action_sequence) return false;
        const pfActions = h.action_sequence.filter((a: any) => a.street === 'preflop');
        const heroPf = pfActions.filter((a: any) => a.player === h.hero_name);
        return heroPf.some((a: any) => ['fold', 'call', 'raise'].includes(a.action));
      });
    } else if (fa.statKey === 'wtsd') {
      candidates = hands.filter(h => h.showdown && h.saw_flop && h.net_result != null);
    } else if (fa.statKey === 'barrelTurn') {
      candidates = hands.filter(h => {
        if (!h.saw_turn || !h.action_sequence) return false;
        const lastRaiser = pfLastRaiser(h.action_sequence);
        if (lastRaiser !== h.hero_name) return false;
        const heroFlopBets = h.action_sequence.filter((a: any) => a.street === 'flop' && a.player === h.hero_name && ['bet', 'raise'].includes(a.action));
        const heroTurnActions = h.action_sequence.filter((a: any) => a.street === 'turn' && a.player === h.hero_name);
        return heroFlopBets.length > 0;
      });
    } else if (fa.statKey === 'foldTo3bet') {
      candidates = hands.filter(h => {
        if (!h.action_sequence) return false;
        const pfActions = h.action_sequence.filter((a: any) => a.street === 'preflop');
        const heroPf = pfActions.filter((a: any) => a.player === h.hero_name);
        return heroPf.some((a: any) => a.action === 'raise');
      });
    } else if (fa.statKey === 'steal') {
      candidates = hands.filter(h =>
        ['CO', 'BTN', 'SB'].includes(h.position) && h.action_sequence
      );
    } else if (fa.statKey === 'wwsf') {
      candidates = hands.filter(h => h.saw_flop && h.net_result != null);
    } else if (fa.statKey.startsWith('vpip_')) {
      const pos = fa.statKey.replace('vpip_', '');
      candidates = hands.filter(h => h.position === pos && h.action_sequence);
    } else {
      // Generic: hands where the stat's street is relevant
      candidates = hands.filter(h => h.saw_flop);
    }

    for (const c of candidates) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const bb = parseBigBlind(c.blinds);
      const bbDeep = bb != null && bb > 0 && c.buy_in != null ? Math.round(Number(c.buy_in) / bb) : 0;
      examples.push({
        handId: c.id,
        handHash: c.hand_hash,
        position: c.position ?? '—',
        potType: c.pot_type ?? '—',
        bbDeep,
        description: `${c.position ?? '—'} · ${c.pot_type ?? '—'}${bbDeep > 0 ? ` · ${bbDeep}BB` : ''}`,
      });
      if (examples.length >= maxPerArea * focusAreas.length) break;
    }
  }

  return examples;
}

function parseBigBlind(blinds: string | null): number | null {
  if (!blinds) return null;
  const match = blinds.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (match) return parseFloat(match[2]);
  const bbMatch = blinds.match(/bb\s*(\d+(?:\.\d+)?)/i);
  if (bbMatch) return parseFloat(bbMatch[1]);
  return null;
}

// ============================================================
// STRUCTURED AI PAYLOAD BUILDER
// ============================================================
function buildStructuredPayload(
  lifetimeStats: Record<string, number>,
  windowStats: Record<string, number>,
  candidates: FocusArea[],
  relevantHands: ExampleHand[],
  area: string,
  depth: string,
  mode: string,
  isProgressReview: boolean,
  prevDiagnostic: any | null,
  totalEligible: number,
  newHandsSinceLast: number,
  excessNewHands: number
): Record<string, unknown> {
  return {
    user_context: {
      game_mode: mode,
      selected_area: area,
      selected_depth: depth,
    },
    lifetime_analytics: {
      total_eligible_hands: totalEligible,
      hand_count: lifetimeStats.hands,
      stat_snapshot: lifetimeStats,
      note: 'Full available dataset used to identify candidate tendencies. Not the AI investigation window.',
    },
    investigation_window: {
      hand_count: windowStats.hands,
      bb_won: windowStats.bbWon,
      bb_100: windowStats.bb100,
      stat_snapshot: windowStats,
      is_new_hand_sample: isProgressReview,
      new_hands_since_last: newHandsSinceLast,
      excess_new_hands_not_analyzed: excessNewHands,
      note: isProgressReview
        ? 'This window contains only genuinely new hands since the previous diagnostic checkpoint.'
        : 'Most recent 5,000 eligible hands for deeper investigation.',
    },
    candidate_findings: candidates.map(c => ({
      metric: c.statKey,
      title: c.title,
      category: c.category,
      player_value: c.statValue,
      benchmark: c.benchmark,
      opportunities: lifetimeStats[`${c.statKey}Opp`] ?? null,
      window_value: windowStats[c.statKey] ?? null,
      window_opportunities: windowStats[`${c.statKey}Opp`] ?? null,
      related_metrics: c.relatedMetrics ?? [],
      priority: c.priority,
      description: c.description,
    })),
    relevant_hands: relevantHands.slice(0, 50).map(h => ({
      hand_id: h.handId,
      position: h.position,
      pot_type: h.potType,
      bb_deep: h.bbDeep,
      description: h.description,
    })),
    previous_diagnostic: isProgressReview && prevDiagnostic ? {
      summary: prevDiagnostic.ai_output?.summary ?? null,
      priorities: (prevDiagnostic.ai_output?.priorities ?? prevDiagnostic.focus_areas ?? []).map((p: any) => ({
        title: p.title,
        statKey: p.statKey ?? p.stat_key,
        statValue: p.statValue ?? p.stat_value,
      })),
      window_stat_snapshot: prevDiagnostic.statistical_snapshot,
      lifetime_stat_snapshot: prevDiagnostic.lifetime_snapshot,
    } : null,
    instructions: {
      max_priorities: 2,
      outlier_does_not_equal_leak: true,
      consider_strategic_context: true,
      sample_confidence_matters: depth === 'deep',
      prioritize_by: 'IMPACT x FREQUENCY x SAMPLE CONFIDENCE x ACTIONABILITY',
      lifetime_vs_window: 'Candidate findings were identified from lifetime stats. The investigation window is the 5,000-hand sample for detailed analysis. Compare window stats against lifetime stats to determine if the tendency persists in the recent sample.',
    },
  };
}

// ============================================================
// OPENAI CALL
// ============================================================
async function callOpenAI(payload: Record<string, unknown>): Promise<{ output: any; raw: any }> {
  const systemPrompt = `You are SpotVault AI Coach, an expert poker performance analyst. You receive structured evidence from a deterministic analytics engine — frequencies, opportunity counts, positions, pot types, street actions, candidate findings, and relevant hand examples.

Your job is NOT to rewrite heuristic conclusions in nicer English. You must perform higher-order interpretation:
- Evaluate candidate statistical outliers for magnitude, frequency, opportunity count, and sample confidence
- Consider how statistics interact (e.g. flop aggression + turn passivity + river strategy)
- Determine whether an apparent outlier actually deserves attention or is strategically contextual
- An unusual statistic may be ACTIONABLE or STRATEGIC/CONTEXTUAL with NO CURRENT ACTION REQUIRED
- Rank findings by IMPACT x FREQUENCY x SAMPLE CONFIDENCE x ACTIONABILITY
- Maximum 2 active recommendations. If only 1 is sufficiently supported, return 1. Do not manufacture a second.
- Surface 1-3 particularly useful example hand IDs per priority

You MUST respond with a JSON object matching this schema exactly:
{
  "diagnostic_summary": "string — 2-3 sentence overview",
  "priorities": [
    {
      "title": "string",
      "category": "Preflop" | "Postflop" | "Complete Game",
      "confidence": "High" | "Medium" | "Low",
      "explanation": "string — what the data shows",
      "why_it_matters": "string — strategic significance",
      "related_metrics": ["string"],
      "example_hand_ids": ["uuid"],
      "action_plan": "string — specific actionable steps"
    }
  ],
  "contextual_outliers": [
    {
      "metric": "string",
      "explanation": "string — why this is contextual, not a leak",
      "action_required": false
    }
  ]
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  const parsed = JSON.parse(content);
  return { output: parsed, raw: data };
}

// ============================================================
// VALIDATE AI OUTPUT
// ============================================================
function validateAiOutput(raw: any): { summary: string; recommendations: string[]; priorities?: AiPriority[]; contextual_outliers?: ContextualOutlier[] } {
  const summary = typeof raw.diagnostic_summary === 'string' ? raw.diagnostic_summary : 'Analysis complete.';

  const priorities: AiPriority[] = [];
  if (Array.isArray(raw.priorities)) {
    for (const p of raw.priorities.slice(0, 2)) {
      if (typeof p.title === 'string' && typeof p.explanation === 'string') {
        priorities.push({
          title: p.title,
          category: typeof p.category === 'string' ? p.category : 'General',
          confidence: typeof p.confidence === 'string' ? p.confidence : 'Medium',
          explanation: p.explanation,
          whyItMatters: typeof p.why_it_matters === 'string' ? p.why_it_matters : '',
          relatedMetrics: Array.isArray(p.related_metrics) ? p.related_metrics.map(String) : [],
          exampleHandIds: Array.isArray(p.example_hand_ids) ? p.example_hand_ids.map(String).slice(0, 3) : [],
          actionPlan: typeof p.action_plan === 'string' ? p.action_plan : '',
        });
      }
    }
  }

  const contextualOutliers: ContextualOutlier[] = [];
  if (Array.isArray(raw.contextual_outliers)) {
    for (const o of raw.contextual_outliers) {
      if (typeof o.metric === 'string' && typeof o.explanation === 'string') {
        contextualOutliers.push({
          metric: o.metric,
          explanation: o.explanation,
          actionRequired: o.action_required === true,
        });
      }
    }
  }

  const recommendations = priorities.map(p =>
    p.actionPlan ? `${p.title}: ${p.actionPlan}` : `${p.title}: ${p.explanation}`
  );

  if (recommendations.length === 0) {
    recommendations.push('Your stats are within typical ranges. No critical leaks detected. Continue accumulating hands.');
  }

  return { summary, recommendations, priorities, contextual_outliers: contextualOutliers };
}

// ============================================================
// HEURISTIC OUTPUT (fallback when no AI)
// ============================================================
function buildHeuristicOutput(
  stats: Record<string, number>,
  focusAreas: FocusArea[],
  examples: ExampleHand[],
  isProgressReview: boolean
): { summary: string; recommendations: string[]; priorities?: AiPriority[]; contextual_outliers?: ContextualOutlier[] } {
  const priorities: AiPriority[] = focusAreas.map(fa => ({
    title: fa.title,
    category: fa.category,
    confidence: fa.statKey.includes('Opp') && stats[`${fa.statKey}Opp`] >= 100 ? 'High' : 'Medium',
    explanation: fa.description,
    whyItMatters: fa.description,
    relatedMetrics: fa.relatedMetrics ?? [],
    exampleHandIds: examples.slice(0, 3).map(e => e.handId),
    actionPlan: fa.description,
  }));

  const contextualOutliers: ContextualOutlier[] = [];

  // Check for turn barrel + river strategy interaction
  if (stats.barrelTurnOpp >= 30 && stats.barrelTurn < 40 && stats.barrelRiverOpp >= 20 && stats.barrelRiver > 55) {
    contextualOutliers.push({
      metric: 'Turn Barrel / River Aggression',
      explanation: 'Lower turn barrel frequency combined with higher river aggression may indicate a deliberate strategy of checking turns to construct stronger river ranges. This pattern does not automatically require correction.',
      actionRequired: false,
    });
  }

  const recommendations = priorities.map(p => `${p.title}: ${p.actionPlan}`);
  if (recommendations.length === 0) {
    recommendations.push(
      isProgressReview
        ? 'Your stats are within typical ranges across all major categories. No critical leaks detected in this window.'
        : 'Your stats are within typical ranges. No critical leaks detected. Continue accumulating hands.'
    );
  }

  const summary = isProgressReview
    ? `Progress review of ${stats.hands} hands. ${focusAreas.length > 0 ? `Identified ${focusAreas.length} focus area${focusAreas.length > 1 ? 's' : ''}: ${focusAreas.map(a => a.title).join(', ')}.` : 'No critical areas identified.'}`
    : `Baseline diagnostic of ${stats.hands} hands. ${focusAreas.length > 0 ? `Identified ${focusAreas.length} focus area${focusAreas.length > 1 ? 's' : ''}: ${focusAreas.map(a => a.title).join(', ')}.` : 'No critical areas identified.'}`;

  return { summary, recommendations, priorities, contextual_outliers: contextualOutliers };
}

// ============================================================
// SELECT EXAMPLE HANDS (1-3 for player display)
// ============================================================
function selectExampleHands(allHands: ExampleHand[], priorities: AiPriority[]): ExampleHand[] {
  const selected: ExampleHand[] = [];
  const seen = new Set<string>();

  // First: hands referenced in AI priorities
  for (const p of priorities) {
    for (const handId of p.exampleHandIds) {
      const match = allHands.find(h => h.handId === handId);
      if (match && !seen.has(handId)) {
        seen.add(handId);
        selected.push(match);
        if (selected.length >= 3) break;
      }
    }
    if (selected.length >= 3) break;
  }

  // Fallback: first few relevant hands
  if (selected.length < 1) {
    for (const h of allHands.slice(0, 3)) {
      if (!seen.has(h.handId)) {
        seen.add(h.handId);
        selected.push(h);
        if (selected.length >= 3) break;
      }
    }
  }

  return selected.slice(0, 3);
}

// ============================================================
// PROGRESS COMPARISON
// ============================================================
function computeProgressComparison(
  prevStats: Record<string, number>,
  currStats: Record<string, number>,
  prevFocusAreas: FocusArea[],
  _currStats: Record<string, number>
): ProgressComparison {
  const statLabels: Record<string, string> = {
    vpip: 'VPIP', pfr: 'PFR', threeBet: '3-Bet',
    cbetFlop: 'Flop C-Bet', barrelTurn: 'Turn Barrel', barrelRiver: 'River Barrel',
    wtsd: 'WTSD', wsd: 'W$SD', wwsf: 'WWSF',
    foldTo3bet: 'Fold to 3-Bet', steal: 'Steal', foldToSteal: 'Fold to Steal',
    limp: 'Limp', bb100: 'BB/100',
  };

  const changes: ProgressComparison['changes'] = [];
  const meaningfulThreshold = 3;

  for (const [key, label] of Object.entries(statLabels)) {
    const prev = prevStats[key];
    const curr = currStats[key];
    if (prev == null || curr == null) continue;
    const change = Math.round((curr - prev) * 10) / 10;
    changes.push({
      statKey: key, label,
      previous: prev, current: curr, change,
      meaningful: Math.abs(change) >= meaningfulThreshold,
    });
  }

  changes.sort((a, b) => {
    if (a.meaningful !== b.meaningful) return a.meaningful ? -1 : 1;
    return Math.abs(b.change) - Math.abs(a.change);
  });

  const previousFocusAssessments: ProgressComparison['previousFocusAssessments'] = [];
  for (const area of prevFocusAreas) {
    const prevVal = prevStats[area.statKey];
    const currVal = currStats[area.statKey];
    if (prevVal == null || currVal == null) {
      previousFocusAssessments.push({
        title: area.title, status: 'insufficient_sample',
        detail: 'Insufficient data to evaluate progress on this metric.',
      });
      continue;
    }
    const change = currVal - prevVal;
    const wasTooLow = area.statValue < parseBenchmarkLow(area.benchmark);
    const wasTooHigh = area.statValue > parseBenchmarkHigh(area.benchmark);

    if (wasTooLow && change > meaningfulThreshold) {
      previousFocusAssessments.push({
        title: area.title, status: 'improving',
        detail: `Previous: ${prevVal}% → Current: ${currVal}% (+${change.toFixed(1)}). Moving toward optimal range.`,
      });
    } else if (wasTooHigh && change < -meaningfulThreshold) {
      previousFocusAssessments.push({
        title: area.title, status: 'improving',
        detail: `Previous: ${prevVal}% → Current: ${currVal}% (${change.toFixed(1)}). Moving toward optimal range.`,
      });
    } else if (Math.abs(change) < meaningfulThreshold) {
      previousFocusAssessments.push({
        title: area.title, status: 'stable',
        detail: `Previous: ${prevVal}% → Current: ${currVal}% (${change > 0 ? '+' : ''}${change.toFixed(1)}). No meaningful change.`,
      });
    } else {
      previousFocusAssessments.push({
        title: area.title, status: 'needs_attention',
        detail: `Previous: ${prevVal}% → Current: ${currVal}% (${change > 0 ? '+' : ''}${change.toFixed(1)}). Stat moved further from optimal.`,
      });
    }
  }

  return { previousSnapshot: prevStats, currentSnapshot: currStats, changes, previousFocusAssessments };
}

function parseBenchmarkLow(benchmark: string): number {
  const match = benchmark.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function parseBenchmarkHigh(benchmark: string): number {
  const matches = benchmark.match(/(\d+(?:\.\d+)?)/g);
  if (matches && matches.length >= 2) return parseFloat(matches[1]);
  if (matches && matches.length === 1) return parseFloat(matches[1]) + 100;
  return 100;
}
