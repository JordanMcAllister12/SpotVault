import { corsHeaders } from "../_shared/cors.ts";
import { DEEPSOLVER_HAND_ORDER_CONFIGURED, toDeepSolverRange, CANONICAL_COMBOS } from "./handOrder.ts";
import { createDiagnostics, type Diagnostics } from "./diagnostics.ts";
import type { TreeTopology } from "./strategyReconstruction.ts";

// ===== Configuration =====

function getConfig() {
  const baseUrl = Deno.env.get("DEEPSOLVER_API_BASE_URL");
  const token = Deno.env.get("DEEPSOLVER_API_TOKEN");
  return { baseUrl: baseUrl?.replace(/\/+$/, "") ?? null, token: token ?? null };
}

function authHeaders(token: string): HeadersInit {
  return { "Authorization": `Token ${token}`, "Content-Type": "application/json" };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ===== Request Types =====

interface SpotVaultCard { rank: string; suit: string }
interface SpotVaultAction { street: string; position: string; action: string; amount_bb?: number; amount_pot_pct?: number }
interface SpotVaultTableConfig { seat_count: number; sb_bb: number; bb_bb: number; ante_type: string; ante_bb: number }

interface SpotVaultSolveRequest {
  config: {
    game_type: string;
    format: string;
    hero_position: string;
    villain_position: string;
    effective_stack_bb: number;
    pot_size_bb: number;
    table_config: SpotVaultTableConfig;
    board: SpotVaultCard[];
    action_history: SpotVaultAction[];
    hero_range: { cells: Record<string, number> };
    villain_range: { cells: Record<string, number> };
    tree_settings: {
      bet_sizes: string[];
      raise_sizes: string[];
      max_raises: number;
      donk_bet_allowed: boolean;
      all_in_sizing: string;
    };
    accuracy: string;
  };
  config_hash: string;
  user_id: string;
  job_id?: string;
}

// ===== Request Conversion =====

function boardToString(board: SpotVaultCard[]): string {
  if (board.length === 0) return "";
  return board.map((c) => `${c.rank}${c.suit}`).join("");
}

function accuracyToIters(accuracy: string): number {
  switch (accuracy) {
    case "fast": return 300;
    case "standard": return 1000;
    case "high": return 5000;
    default: return 1000;
  }
}

function parseBetSizes(sizes: string[]): number[] {
  return sizes
    .map((s) => {
      const trimmed = s.trim();
      if (trimmed.endsWith('%')) {
        const pct = parseFloat(trimmed);
        return isNaN(pct) ? null : pct / 100;
      }
      const plain = parseFloat(trimmed);
      if (!isNaN(plain) && !trimmed.endsWith('x') && trimmed !== 'All-in') {
        return plain > 1 ? plain / 100 : plain;
      }
      return null;
    })
    .filter((v): v is number => v !== null && v > 0 && v <= 5);
}

function countNonZero(vec: number[]): number {
  let count = 0;
  for (const v of vec) if (v > 0) count++;
  return count;
}

function convertRequestToDeepSolver(req: SpotVaultSolveRequest) {
  const c = req.config;

  const heroRange = toDeepSolverRange(c.hero_range.cells);
  const villainRange = toDeepSolverRange(c.villain_range.cells);

  const betFractions = parseBetSizes(c.tree_settings.bet_sizes);
  const raiseFractions = parseBetSizes(c.tree_settings.raise_sizes);

  const ipSizes = raiseFractions.length > 0 ? raiseFractions : [0.5];
  const oopSizes = betFractions.length > 0 ? betFractions : [0.5];

  const potFractions = [[ipSizes], [oopSizes]];

  const stack = Math.round(c.effective_stack_bb * 100);

  let potSizeBb = c.pot_size_bb;
  if (potSizeBb <= 0) {
    potSizeBb = c.table_config.sb_bb + c.table_config.bb_bb;
    if (c.table_config.ante_type === 'bb_ante') {
      potSizeBb += c.table_config.ante_bb;
    } else if (c.table_config.ante_type === 'per_player') {
      potSizeBb += c.table_config.ante_bb * c.table_config.seat_count;
    }
  }
  const potSize = Math.round(potSizeBb * 100);

  return {
    iters: accuracyToIters(c.accuracy),
    board: boardToString(c.board),
    ranges: [heroRange, villainRange],
    options: {
      results_format: "HOLDEM_binary",
      save_raw_results: true,
      save_folds: true,
      compute_eq: true,
      requested_attrs: [],
      requested_nodes: [],
    },
    tree_request: {
      pot_fractions: [potFractions[0], potFractions[1]],
      all_in_threshold: 2.0,
      add_all_in_if_stack_lt_pot_times: 0,
      max_all_in_depth: 2,
      pot_size: potSize,
      players_stacks_sizes: [stack, stack],
    },
  };
}

// ===== 169 Aggregation =====

const RANKS = "AKQJT98765432";

const HAND_CELLS_169: string[] = (() => {
  const cells: string[] = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      if (i === j) cells.push(`${RANKS[i]}${RANKS[i]}`);
      else if (i < j) cells.push(`${RANKS[i]}${RANKS[j]}s`);
      else cells.push(`${RANKS[j]}${RANKS[i]}o`);
    }
  }
  return cells;
})();

function comboToCellId(combo: string): string {
  const r1 = combo[0], s1 = combo[1], r2 = combo[2], s2 = combo[3];
  const r1Idx = RANKS.indexOf(r1);
  const r2Idx = RANKS.indexOf(r2);
  if (r1Idx === r2Idx) return `${r1}${r2}`;
  const suited = s1 === s2;
  return r1Idx < r2Idx
    ? (suited ? `${r1}${r2}s` : `${r1}${r2}o`)
    : (suited ? `${r2}${r1}s` : `${r2}${r1}o`);
}

const COMBO_TO_169: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  for (let i = 0; i < CANONICAL_COMBOS.length; i++) {
    map[i] = comboToCellId(CANONICAL_COMBOS[i]);
  }
  return map;
})();

const COMBO_INDICES_169: Record<string, number[]> = (() => {
  const map: Record<string, number[]> = {};
  for (const hand of HAND_CELLS_169) map[hand] = [];
  for (let i = 0; i < CANONICAL_COMBOS.length; i++) {
    const hand = COMBO_TO_169[i];
    if (hand) map[hand].push(i);
  }
  return map;
})();

function aggregate1326To169(comboValues: number[]): Record<string, number> {
  const handSums: Record<string, number> = {};
  for (let i = 0; i < 1326; i++) {
    const hand = COMBO_TO_169[i];
    if (hand) handSums[hand] = (handSums[hand] ?? 0) + comboValues[i];
  }
  const result: Record<string, number> = {};
  for (const hand of HAND_CELLS_169) {
    const comboCount = hand.length === 2 ? 6 : hand[2] === "s" ? 4 : 12;
    result[hand] = (handSums[hand] ?? 0) / comboCount;
  }
  return result;
}

function actionLabel(action: string): string {
  switch (action) {
    case "fold": return "Fold";
    case "check": return "Check";
    case "call": return "Call";
    case "bet": return "Bet";
    case "raise": return "Raise";
    case "all-in": return "All-in";
    default: return action.charAt(0).toUpperCase() + action.slice(1);
  }
}

// ===== Topology Extraction =====
// v4: raw results have root-level actions/player_id, no per-node tree.
// Build children from config.paths, actions from raw results root, players from alternation.

function actionCodeToString(action: unknown): string {
  if (typeof action === "string") return action;
  if (Array.isArray(action)) {
    const code = action[0];
    const amount = action[1];
    if (code === "C") return amount > 0 ? "call" : "check";
    if (code === "B") return amount >= 9999 ? "all-in" : "bet";
    if (code === "F") return "fold";
    return String(code);
  }
  return String(action);
}

function extractTopology(rawData: Record<string, unknown> | null, configData: Record<string, unknown>): TreeTopology | null {
  const topology: TreeTopology = { children: {}, actions: {}, player_id: {} };
  let hasMetadata = false;

  const paths = configData.paths;
  if (!Array.isArray(paths) || paths.length === 0) return null;

  // Build children map from path depth analysis
  for (const path of paths) {
    if (typeof path !== "string") continue;
    const parts = path.split(":");
    if (parts.length <= 1) continue;
    const parentPath = parts.slice(0, -1).join(":");
    if (!topology.children[parentPath]) topology.children[parentPath] = [];
    topology.children[parentPath].push(path);
    hasMetadata = true;
  }

  // Extract root-level actions and player_id from raw results
  if (rawData) {
    const rootActions = rawData.actions;
    if (Array.isArray(rootActions)) {
      topology.actions["r:0"] = rootActions.map((a) => actionCodeToString(a));
      hasMetadata = true;
    }
    const rootPid = rawData.player_id;
    if (rootPid === 0 || rootPid === 1) {
      topology.player_id["r:0"] = rootPid;
      hasMetadata = true;
    }
  }

  // Build player_id for all nodes by alternation from root
  const rootPid = topology.player_id["r:0"] ?? 0;
  for (const path of paths) {
    if (typeof path !== "string") continue;
    if (path === "r:0") continue;
    const depth = path.split(":").length;
    topology.player_id[path] = (depth % 2 === 0 ? rootPid : (1 - rootPid)) as 0 | 1;
  }

  // Build action labels for non-root nodes from path suffixes
  for (const path of paths) {
    if (typeof path !== "string") continue;
    if (path === "r:0") continue;
    if (topology.actions[path]) continue;
    const parts = path.split(":");
    const suffix = parts[parts.length - 1];
    if (suffix === "c") topology.actions[path] = ["check", "bet"];
    else if (suffix === "f") topology.actions[path] = ["fold", "call", "raise"];
    else if (suffix.startsWith("b")) {
      const amount = parseInt(suffix.slice(1));
      topology.actions[path] = ["fold", "call", "raise"];
    }
  }

  return hasMetadata ? topology : null;
}

// ===== Debug Report =====

interface DebugReport {
  request: {
    board: string;
    results_format: string;
    save_folds: boolean;
    compute_eq: boolean;
    save_raw_results: boolean;
    hero_range_length: number;
    villain_range_length: number;
    hero_nonzero_count: number;
    villain_nonzero_count: number;
  };
  response: {
    task_status: string | null;
    returned_results_format: string | null;
    config_paths_count: number | null;
    decoded_node_count: number | null;
    nodes_total_bytes: number | null;
    nodes_bytes_consumed: number | null;
    player0_active_map_count: number | null;
    player1_active_map_count: number | null;
  };
  rootNode: {
    player_id: 0 | 1 | null;
    actions: string[];
    child_paths: string[];
  };
  sampleCombos: Array<{
    combo: string;
    parentRange: number;
    childRanges: number[];
    strategies: number[];
    childRangeSum: number;
    strategySum: number;
  }>;
  validationFailures: number;
}

function buildDebugReport(
  dsPayload: ReturnType<typeof convertRequestToDeepSolver>,
  configData: Record<string, unknown> | null,
  decoded: { nodes: { path: string; ranges: [number[], number[]] }[]; activeMaps: [number[], number[]] } | null,
  reconstructed: { nodes: { path: string; player: 0 | 1; actions: { action: string; strategy: number[] }[] }[] } | null,
  taskStatus: string | null,
  nodesByteLength: number | null,
  offsetAfterDecode: number | null,
  validationFailures: number,
  topology: TreeTopology | null = null,
): DebugReport {
  const heroRange = dsPayload.ranges[0];
  const villainRange = dsPayload.ranges[1];

  const report: DebugReport = {
    request: {
      board: dsPayload.board,
      results_format: dsPayload.options.results_format,
      save_folds: dsPayload.options.save_folds,
      compute_eq: dsPayload.options.compute_eq,
      save_raw_results: dsPayload.options.save_raw_results,
      hero_range_length: heroRange.length,
      villain_range_length: villainRange.length,
      hero_nonzero_count: countNonZero(heroRange),
      villain_nonzero_count: countNonZero(villainRange),
    },
    response: {
      task_status: taskStatus,
      returned_results_format: (configData?.results_format as string) ?? null,
      config_paths_count: Array.isArray(configData?.paths) ? (configData!.paths as unknown[]).length : null,
      decoded_node_count: decoded?.nodes.length ?? null,
      nodes_total_bytes: nodesByteLength,
      nodes_bytes_consumed: offsetAfterDecode,
      player0_active_map_count: decoded?.activeMaps[0].length ?? null,
      player1_active_map_count: decoded?.activeMaps[1].length ?? null,
    },
    rootNode: {
      player_id: reconstructed?.nodes[0]?.player ?? null,
      actions: reconstructed?.nodes[0]?.actions.map((a) => a.action) ?? [],
      child_paths: [],
    },
    sampleCombos: [],
    validationFailures,
  };

  if (reconstructed && reconstructed.nodes.length > 0) {
    const rootNode = reconstructed.nodes[0];
    const parentRange = decoded?.nodes[0]?.ranges[rootNode.player] ?? [];
    const childPaths = topology?.children?.[rootNode.path] ?? [];
    const childNodes = childPaths.map((cp) => decoded?.nodes.find((n) => n.path === cp)).filter((n): n is NonNullable<typeof n> => n !== undefined);
    report.rootNode.child_paths = childPaths;

    const sampleIndices: number[] = [];
    for (let i = 0; i < 1326 && sampleIndices.length < 5; i++) {
      if (parentRange[i] > 0) sampleIndices.push(i);
    }

    for (const idx of sampleIndices) {
      const childRanges = childNodes.map((n) => decoded?.nodes.find((d) => d.path === n.path)?.ranges[rootNode.player][idx] ?? 0) ?? [];
      const strategies = rootNode.actions.map((a) => a.strategy[idx]);
      report.sampleCombos.push({
        combo: CANONICAL_COMBOS[idx] ?? `idx_${idx}`,
        parentRange: parentRange[idx],
        childRanges,
        strategies,
        childRangeSum: childRanges.reduce((s, v) => s + v, 0),
        strategySum: strategies.reduce((s, v) => s + v, 0),
      });
    }
  }

  return report;
}

// ===== Main Handler =====

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const diag = createDiagnostics();

  try {
    const body = await req.json() as SpotVaultSolveRequest;

    // Verify authenticated user matches the requested user_id
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError(401, "Unauthorized", diag);
    }

    const supabaseUrl0 = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl0 || !anonKey) {
      return jsonError(500, "Server configuration error", diag);
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const userClient = createClient(supabaseUrl0, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonError(401, "Unauthorized", diag);
    }
    if (body.user_id && body.user_id !== user.id) {
      return jsonError(403, "User ID mismatch", diag);
    }

    if (!body.config || !body.config_hash || !body.user_id) {
      return jsonError(400, "Missing required fields: config, config_hash, user_id", diag);
    }
    if (body.config.effective_stack_bb <= 0) {
      return jsonError(400, "Effective stack must be greater than 0", diag);
    }

    // Entitlement check — solver access requires Pro/Elite membership or staff role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError(500, "Server configuration error", diag);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: membership } = await adminClient
      .from("user_memberships")
      .select("tier_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    const userTier = membership?.tier_id ?? "free";
    const hasSolver = userTier === "pro" || userTier === "elite";
    if (!hasSolver) {
      const { data: staffRole } = await adminClient
        .from("sv_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("role", ["staff", "superuser", "developer_admin"])
        .maybeSingle();
      if (!staffRole) {
        return jsonError(403, "Solver access requires Pro or Elite membership", diag,
          "Solver access requires a Pro or Elite membership.");
      }
    }

    const cacheResponse = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/solver_jobs?select=id,result_data&config_hash=eq.${encodeURIComponent(body.config_hash)}&status=eq.complete&order=created_at.desc&limit=1`,
      { headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` } },
      10000,
    );

    if (cacheResponse.ok) {
      const cacheData = await cacheResponse.json() as Array<{ id: string; result_data: unknown }>;
      if (cacheData.length > 0 && cacheData[0].result_data) {
        diag.finalSource = "CACHE";
        return new Response(
          JSON.stringify({ cached: true, result: cacheData[0].result_data, diagnostics: diag }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const dsConfig = getConfig();
    diag.apiBaseUrlConfigured = dsConfig.baseUrl !== null;
    diag.tokenConfigured = dsConfig.token !== null;
    diag.canonicalHandOrderConfigured = DEEPSOLVER_HAND_ORDER_CONFIGURED;

    if (!dsConfig.baseUrl || !dsConfig.token) {
      diag.scheduleRequest = "BLOCKED";
      return jsonError(503, "Solver unavailable — DeepSolver API not configured", diag, "Solver request failed. Please retry or contact support.");
    }

    if (!DEEPSOLVER_HAND_ORDER_CONFIGURED) {
      diag.scheduleRequest = "BLOCKED";
      return jsonError(503, "Hand mapping not configured", diag, "Solver request failed. Please retry or contact support.");
    }

    const dsPayload = convertRequestToDeepSolver(body);

    // Pre-request diagnostic logging
    const heroRange = dsPayload.ranges[0];
    const villainRange = dsPayload.ranges[1];
    diag.errors.push(`[debug] results_format=${dsPayload.options.results_format} save_folds=${dsPayload.options.save_folds} compute_eq=${dsPayload.options.compute_eq} save_raw_results=${dsPayload.options.save_raw_results}`);
    diag.errors.push(`[debug] board=${dsPayload.board} hero_len=${heroRange.length} villain_len=${villainRange.length} hero_nz=${countNonZero(heroRange)} villain_nz=${countNonZero(villainRange)}`);

    if (body.job_id && supabaseUrl && serviceRoleKey) {
      await fetchWithTimeout(
        `${supabaseUrl}/rest/v1/solver_jobs?id=eq.${encodeURIComponent(body.job_id)}`,
        {
          method: "PATCH",
          headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ outbound_payload: dsPayload }),
        },
        5000,
      ).catch(() => { /* non-fatal */ });
    }

    const scheduleRes = await fetchWithTimeout(
      `${dsConfig.baseUrl}/task/binary/cfr/schedule`,
      { method: "POST", headers: authHeaders(dsConfig.token), body: JSON.stringify(dsPayload) },
      30000,
    );

    if (!scheduleRes.ok) {
      diag.scheduleRequest = "FAILED";
      const errText = await scheduleRes.text().catch(() => "Unknown error");
      diag.errors.push(`Schedule ${scheduleRes.status}: ${errText}`);
      if (body.job_id && supabaseUrl && serviceRoleKey) {
        await fetchWithTimeout(
          `${supabaseUrl}/rest/v1/solver_jobs?id=eq.${encodeURIComponent(body.job_id)}`,
          {
            method: "PATCH",
            headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ provider_http_status: scheduleRes.status, provider_error_body: errText }),
          },
          5000,
        ).catch(() => { /* non-fatal */ });
      }
      return jsonError(502, `DeepSolver schedule failed (${scheduleRes.status})`, diag, "Solver request failed. Please retry or contact support.");
    }

    const scheduleBody = await scheduleRes.json() as Record<string, unknown>;
    const taskId = (scheduleBody.task_id ?? scheduleBody.id ?? scheduleBody.taskId) as string | undefined;

    diag.scheduleRequest = "SUCCESS";
    diag.taskId = taskId ?? null;

    if (!taskId) {
      diag.errors.push(`Schedule response: ${JSON.stringify(scheduleBody).slice(0, 1000)}`);
      return jsonError(502, "DeepSolver did not return a task ID", diag, "Solver request failed. Please retry or contact support.");
    }

    // Poll task status
    const maxPolls = 80;
    const pollIntervalMs = 3000;
    let taskFinished = false;
    let taskFailed = false;

    for (let i = 0; i < maxPolls; i++) {
      const statusRes = await fetchWithTimeout(
        `${dsConfig.baseUrl}/task/binary/cfr/status/${taskId}`,
        { headers: authHeaders(dsConfig.token) },
        10000,
      );

      if (statusRes.status === 404) {
        diag.taskStatus = "pending";
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        continue;
      }

      if (!statusRes.ok) {
        const errText = await statusRes.text().catch(() => "Unknown error");
        diag.errors.push(`Status ${statusRes.status}: ${errText}`);
        return jsonError(502, `DeepSolver status check failed (${statusRes.status})`, diag, "Solver request failed. Please retry or contact support.");
      }

      const statusData = await statusRes.json() as Record<string, unknown>;
      diag.taskStatus = (statusData.status as Diagnostics["taskStatus"]) ?? "unknown";
      diag.resultAvailable = statusData.result_available === true;

      if (statusData.status === "failed" || statusData.status === "error") {
        taskFailed = true;
        diag.taskStatus = "failed";
        const taskErrBody = JSON.stringify(statusData).slice(0, 4000);
        diag.errors.push(`Task failed response: ${taskErrBody}`);
        if (body.job_id && supabaseUrl && serviceRoleKey) {
          await fetchWithTimeout(
            `${supabaseUrl}/rest/v1/solver_jobs?id=eq.${encodeURIComponent(body.job_id)}`,
            {
              method: "PATCH",
              headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ provider_http_status: 200, provider_error_body: taskErrBody }),
            },
            5000,
          ).catch(() => { /* non-fatal */ });
        }
        break;
      }

      if (statusData.result_available === true) {
        taskFinished = true;
        diag.taskStatus = "finished";
        break;
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    if (taskFailed) {
      return jsonError(502, "DeepSolver task failed", diag, "Solver request failed. Please retry or contact support.");
    }

    if (!taskFinished) {
      return jsonError(504, `DeepSolver task did not complete within ${maxPolls * pollIntervalMs / 1000}s`, diag, "Solver request timed out. Please retry or contact support.");
    }

    // Fetch result URLs
    const resultUrlRes = await fetchWithTimeout(
      `${dsConfig.baseUrl}/task/binary/cfr/result/url/${taskId}`,
      { headers: authHeaders(dsConfig.token) },
      30000,
    );

    if (!resultUrlRes.ok) {
      const errText = await resultUrlRes.text().catch(() => "Unknown error");
      diag.errors.push(`Result URL fetch ${resultUrlRes.status}: ${errText}`);
      return jsonError(502, `DeepSolver result URL fetch failed (${resultUrlRes.status})`, diag, "Solver request failed. Please retry or contact support.");
    }

    const urlBody = await resultUrlRes.json() as Record<string, unknown>;
    diag.errors.push(`Result URL keys: ${JSON.stringify(Object.keys(urlBody))}`);

    const s3Urls = urlBody.s3_urls ?? urlBody.urls;
    let nodesUrl: string | null = null;
    let configUrl: string | null = null;
    let rawUrl: string | null = null;

    if (Array.isArray(s3Urls)) {
      for (const url of s3Urls) {
        if (typeof url !== "string") continue;
        if (url.includes(".nodes") || url.includes("nodes")) nodesUrl = url;
        else if (url.includes("raw") || url.includes("raw_results")) rawUrl = url;
        else if (url.includes("config") || url.includes(".json")) configUrl = url;
      }
    } else if (s3Urls && typeof s3Urls === "object") {
      const urlObj = s3Urls as Record<string, string>;
      nodesUrl = urlObj.nodes ?? urlObj.nodes_url ?? null;
      configUrl = urlObj.config ?? urlObj.config_url ?? null;
      rawUrl = urlObj.raw ?? urlObj.raw_results ?? null;
    }

    if (!nodesUrl || !configUrl) {
      diag.errors.push(`Could not find nodes/config URLs in result: ${JSON.stringify(urlBody).slice(0, 1000)}`);
      return jsonError(502, "DeepSolver result missing file URLs", diag, "Solver request failed. Please retry or contact support.");
    }

    // Fetch config.json
    const configRes = await fetchWithTimeout(configUrl, {}, 30000);
    if (!configRes.ok) {
      diag.errors.push(`Config fetch failed: ${configRes.status}`);
      return jsonError(502, "DeepSolver config fetch failed", diag, "Solver request failed. Please retry or contact support.");
    }
    const configData = await configRes.json() as Record<string, unknown>;
    diag.errors.push(`Config keys: ${JSON.stringify(Object.keys(configData))}`);
    diag.errors.push(`Config results_format: ${configData.results_format ?? "not present"}`);
    diag.configPathsCount = Array.isArray(configData.paths) ? configData.paths.length : 0;

    // Fetch raw results if available (for topology metadata)
    let rawData: Record<string, unknown> | null = null;
    if (rawUrl) {
      try {
        const rawRes = await fetchWithTimeout(rawUrl, {}, 30000);
        if (rawRes.ok) {
          rawData = await rawRes.json() as Record<string, unknown>;
          diag.errors.push(`Raw results keys: ${JSON.stringify(Object.keys(rawData)).slice(0, 500)}`);
          // Inspect raw data structure for topology
          const rawDataField = rawData.data;
          if (Array.isArray(rawDataField)) {
            diag.errors.push(`Raw data is array, len=${rawDataField.length}, first item keys: ${JSON.stringify(Object.keys(rawDataField[0] ?? {})).slice(0, 500)}`);
            if (rawDataField[0]) diag.errors.push(`Raw data[0]: ${JSON.stringify(rawDataField[0]).slice(0, 800)}`);
          } else if (rawDataField && typeof rawDataField === "object") {
            diag.errors.push(`Raw data is object, keys: ${JSON.stringify(Object.keys(rawDataField)).slice(0, 500)}`);
          }
          if (rawData.actions) diag.errors.push(`Raw actions: ${JSON.stringify(rawData.actions).slice(0, 500)}`);
          if (rawData.player_id !== undefined) diag.errors.push(`Raw player_id: ${JSON.stringify(rawData.player_id).slice(0, 200)}`);
          // v2: dump deeper structure
          if (Array.isArray(rawDataField) && rawDataField.length > 1) {
            diag.errors.push(`Raw data[1]: ${JSON.stringify(rawDataField[1]).slice(0, 800)}`);
          }
        }
      } catch { /* non-fatal */ }
    }

    // Fetch .nodes binary
    const nodesRes = await fetchWithTimeout(nodesUrl, {}, 60000);
    if (!nodesRes.ok) {
      diag.errors.push(`Nodes fetch failed: ${nodesRes.status}`);
      return jsonError(502, "DeepSolver nodes fetch failed", diag, "Solver request failed. Please retry or contact support.");
    }

    const nodesBytes = new Uint8Array(await nodesRes.arrayBuffer());
    diag.binaryFilesReceived = true;
    diag.errors.push(`Nodes bytes: ${nodesBytes.byteLength}`);

    // Decode binary
    const { decodeHoldemBinary } = await import("./holdemBinary.ts");
    let decoded: ReturnType<typeof decodeHoldemBinary> | null = null;
    let decodeOffset = 0;
    try {
      decoded = decodeHoldemBinary(nodesBytes, configData);
      decodeOffset = nodesBytes.byteLength; // if we got here, offset === byteLength
      diag.decodedNodeCount = decoded.nodes.length;
      diag.fullBinaryConsumed = true;
      diag.errors.push(`Decoded ${decoded.nodes.length} nodes, activeMaps: [${decoded.activeMaps[0].length}, ${decoded.activeMaps[1].length}]`);
    } catch (decodeErr) {
      diag.errors.push(`Decode error: ${decodeErr instanceof Error ? decodeErr.message : String(decodeErr)}`);
      const debugReport = buildDebugReport(dsPayload, configData, null, null, diag.taskStatus, nodesBytes.byteLength, decodeOffset, 0);
      return jsonError(502, `Binary decode failed: ${decodeErr instanceof Error ? decodeErr.message : String(decodeErr)}`, diag, "Solver request failed. Please retry or contact support.", debugReport);
    }

    // Build topology from raw results + config paths
    const topology = extractTopology(rawData, configData);

    // Reconstruct strategy
    const { reconstructStrategy } = await import("./strategyReconstruction.ts");
    const saveFolds = dsPayload.options.save_folds === true;
    let reconstructed: ReturnType<typeof reconstructStrategy> | null = null;
    let validationFailures = 0;
    try {
      reconstructed = reconstructStrategy(decoded, topology, saveFolds, CANONICAL_COMBOS);
      diag.strategyReconstruction = "SUCCESS";
      diag.errors.push(`Reconstructed ${reconstructed.nodes.length} nodes`);

      // Player-assignment trace for key paths (Problem B diagnostic)
      const TRACE_PATHS = ["r:0", "r:0:c", "r:0:b75", "r:0:b150", "r:0:c:c", "r:0:c:b75", "r:0:b75:c", "r:0:b75:b150"];
      for (const tp of TRACE_PATHS) {
        const topoPlayer = topology?.player_id?.[tp] ?? "unset";
        const reconNode = reconstructed.nodes.find((n) => n.path === tp);
        const reconPlayer = reconNode ? reconNode.player : "not-in-tree";
        const actionCount = reconNode ? reconNode.actions.length : "N/A";
        const childCount = topology?.children?.[tp]?.length ?? 0;
        diag.errors.push(`[playerTrace] path=${tp} topo_player=${topoPlayer} recon_player=${reconPlayer} actions=${actionCount} children=${childCount}`);
      }

      // Validation: only active decision nodes (those with at least one action).
      // Nodes with zero actions are terminal/street-complete and carry no strategy to validate.
      if (saveFolds) {
        let terminalNodeCount = 0;
        let activeNodeCount = 0;
        for (const node of reconstructed.nodes) {
          if (node.actions.length === 0) {
            // terminal/street-complete: classify and skip strategy validation
            terminalNodeCount++;
            continue;
          }
          activeNodeCount++;
          for (let j = 0; j < 1326; j++) {
            const parentRange = decoded.nodes.find((n) => n.path === node.path)?.ranges[node.player][j] ?? 0;
            if (parentRange > 0) {
              const sum = node.actions.reduce((s, a) => s + a.strategy[j], 0);
              if (Math.abs(sum - 1) > 2 / 65535) {
                validationFailures++;
              }
            }
          }
        }
        diag.strategyValidation = validationFailures === 0 ? "PASS" : "FAIL";
        diag.errors.push(`Validation: active_nodes=${activeNodeCount} terminal_nodes=${terminalNodeCount} failures=${validationFailures}`);

        // Capture first remaining failure for diagnosis (active nodes only)
        if (validationFailures > 0) {
          const firstFailing = reconstructed.nodes.find((node) => {
            if (node.actions.length === 0) return false;
            const parentRange = decoded.nodes.find((n) => n.path === node.path)?.ranges[node.player] ?? [];
            for (let j = 0; j < 1326; j++) {
              if (parentRange[j] > 0) {
                const sum = node.actions.reduce((s, a) => s + a.strategy[j], 0);
                if (Math.abs(sum - 1) > 2 / 65535) return true;
              }
            }
            return false;
          });
          if (firstFailing) {
            const decodedNode = decoded.nodes.find((n) => n.path === firstFailing.path);
            const parentPath2 = firstFailing.path.split(":").slice(0, -1).join(":");
            const parentDecodedNode = decoded.nodes.find((n) => n.path === parentPath2);
            const childPaths2 = topology?.children?.[firstFailing.path] ?? [];
            const childDecodedNodes = childPaths2.map((cp: string) => decoded.nodes.find((n) => n.path === cp));
            const firstBadComboIdx = (() => {
              const pr = decodedNode?.ranges[firstFailing.player] ?? [];
              for (let j = 0; j < 1326; j++) {
                if (pr[j] > 0) {
                  const sum = firstFailing.actions.reduce((s, a) => s + a.strategy[j], 0);
                  if (Math.abs(sum - 1) > 2 / 65535) return j;
                }
              }
              return -1;
            })();
            diag.errors.push(`[firstFailure] path=${firstFailing.path} player=${firstFailing.player} parentPath=${parentPath2}`);
            diag.errors.push(`[firstFailure] combo_idx=${firstBadComboIdx} combo=${CANONICAL_COMBOS[firstBadComboIdx] ?? "?"}`);
            diag.errors.push(`[firstFailure] topo_player_at_path=${topology?.player_id?.[firstFailing.path] ?? "unset"}`);
            diag.errors.push(`[firstFailure] current_node_range[player][combo]=${decodedNode?.ranges[firstFailing.player][firstBadComboIdx]}`);
            diag.errors.push(`[firstFailure] parent_node_range[player][combo]=${parentDecodedNode?.ranges[firstFailing.player][firstBadComboIdx]}`);
            diag.errors.push(`[firstFailure] child_ranges=${JSON.stringify(childDecodedNodes.map((c) => c?.ranges[firstFailing.player][firstBadComboIdx] ?? "missing"))}`);
            diag.errors.push(`[firstFailure] strategies=${JSON.stringify(firstFailing.actions.map((a) => ({ action: a.action, strategy: a.strategy[firstBadComboIdx] })))}`);
            diag.errors.push(`[firstFailure] strategy_sum=${firstFailing.actions.reduce((s, a) => s + a.strategy[firstBadComboIdx], 0)}`);
            // Also report child-range sum vs parent range for the failing combo
            const childRangeSum = childDecodedNodes.reduce((s, c) => s + (c?.ranges[firstFailing.player][firstBadComboIdx] ?? 0), 0);
            diag.errors.push(`[firstFailure] child_range_sum=${childRangeSum} parent_range=${parentDecodedNode?.ranges[firstFailing.player][firstBadComboIdx] ?? "?"}`);
          }
        }
      }
    } catch (reconErr) {
      diag.strategyReconstruction = "FAILED";
      diag.errors.push(`Reconstruction error: ${reconErr instanceof Error ? reconErr.message : String(reconErr)}`);
      const debugReport = buildDebugReport(dsPayload, configData, decoded, null, diag.taskStatus, nodesBytes.byteLength, decodeOffset, 0);
      return jsonError(502, `Strategy reconstruction failed: ${reconErr instanceof Error ? reconErr.message : String(reconErr)}`, diag, "Solver request failed. Please retry or contact support.", debugReport);
    }

    // Build debug report
    const debugReport = buildDebugReport(
      dsPayload, configData, decoded, reconstructed,
      diag.taskStatus, nodesBytes.byteLength, decodeOffset, validationFailures, topology,
    );
    diag.errors.push(`[debugReport] ${JSON.stringify(debugReport).slice(0, 3000)}`);

    // Build SpotVault result
    const spotvaultResult = buildSpotVaultResultFromReconstructed(body.config, reconstructed, decoded);
    diag.aggregation169 = "SUCCESS";

    // Store result
    await persistResult(supabaseUrl, serviceRoleKey, body.job_id, spotvaultResult);
    diag.finalSource = "DEEPSOLVER";

    return new Response(
      JSON.stringify({ cached: false, task_id: taskId, result: spotvaultResult, diagnostics: diag, debug_report: debugReport }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    diag.errors.push(err instanceof Error ? err.message : String(err));
    diag.errors.push(err instanceof Error ? err.stack ?? "" : "");
    return jsonError(500, err instanceof Error ? err.message : "Unknown error", diag, "Solver request failed. Please retry or contact support.");
  }
});

async function persistResult(supabaseUrl: string, serviceRoleKey: string, jobId: string | undefined, result: unknown): Promise<void> {
  if (!jobId) return;
  await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/solver_jobs?id=eq.${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "complete",
        result_data: result,
        completed_at: new Date().toISOString(),
      }),
    },
    10000,
  );
}

function buildSpotVaultResultFromReconstructed(
  config: SpotVaultSolveRequest["config"],
  reconstructed: { nodes: { path: string; player: 0 | 1; actions: { action: string; strategy: number[] }[]; ranges: [number[], number[]]; ev: [number[] | null, number[] | null]; eq: [number[] | null, number[] | null] }[] },
  decoded: { rootChildEv: number[][]; rootChildEq: number[][] },
): unknown {
  const rootNode = reconstructed.nodes[0];
  if (!rootNode) {
    throw new Error("Reconstructed tree has no root node");
  }

  const actionNames = rootNode.actions.map(a => a.action);
  const availableActions = actionNames.map(name => ({
    action: name,
    label: actionLabel(name),
    frequency: 0,
  }));

  const handStrategies = HAND_CELLS_169.map((hand) => {
    const frequencies = rootNode.actions.map(act => {
      const comboIndices = COMBO_INDICES_169[hand] ?? [];
      let sum = 0;
      for (const idx of comboIndices) sum += act.strategy[idx] ?? 0;
      const avg = comboIndices.length > 0 ? sum / comboIndices.length : 0;
      return {
        action: act.action,
        label: actionLabel(act.action),
        frequency: Math.max(0, Math.min(1, avg)),
      };
    });

    const evByAction = rootNode.actions.map((act, idx) => {
      const comboIndices = COMBO_INDICES_169[hand] ?? [];
      let evSum = 0;
      let count = 0;
      if (decoded.rootChildEv[idx]) {
        for (const ci of comboIndices) {
          const ev = decoded.rootChildEv[idx][ci];
          if (ev !== undefined && Number.isFinite(ev)) { evSum += ev; count++; }
        }
      }
      return { action: act.action, ev: count > 0 ? evSum / count : null };
    });

    let equity: number | null = null;
    if (decoded.rootChildEq[0]) {
      const comboIndices = COMBO_INDICES_169[hand] ?? [];
      let eqSum = 0;
      let count = 0;
      for (const ci of comboIndices) {
        const eq = decoded.rootChildEq[0][ci];
        if (eq !== undefined && Number.isFinite(eq)) { eqSum += eq; count++; }
      }
      equity = count > 0 ? eqSum / count : null;
    }

    return { hand, frequencies, ev_by_action: evByAction, equity };
  });

  const comboCounts: Record<string, number> = {};
  for (const hand of HAND_CELLS_169) {
    comboCounts[hand] = hand.length === 2 ? 6 : hand[2] === "s" ? 4 : 12;
  }
  const totalCombos = HAND_CELLS_169.reduce((s, h) => s + comboCounts[h], 0);
  const aggregateStrategy = actionNames.map((action, actIdx) => {
    let weightedSum = 0;
    for (const hand of HAND_CELLS_169) {
      const comboIndices = COMBO_INDICES_169[hand] ?? [];
      let sum = 0;
      for (const idx of comboIndices) sum += rootNode.actions[actIdx].strategy[idx] ?? 0;
      const avg = comboIndices.length > 0 ? sum / comboIndices.length : 0;
      weightedSum += avg * comboCounts[hand];
    }
    return {
      action,
      label: actionLabel(action),
      frequency: totalCombos > 0 ? weightedSum / totalCombos : 0,
    };
  });

  const resultRootNode = {
    id: "root",
    street: config.board.length === 0 ? "preflop" : config.board.length === 3 ? "flop" : config.board.length === 4 ? "turn" : "river",
    board: config.board,
    pot_bb: config.pot_size_bb,
    player_to_act: config.hero_position,
    available_actions: availableActions,
    strategy_by_hand: handStrategies,
    aggregate_strategy: aggregateStrategy,
    children: [],
    parent_id: null,
    action_to_here: config.action_history,
  };

  return {
    root_node: resultRootNode,
    provider: "deepsolver",
    is_mock: false,
    source: "deepsolver",
    provenance: {
      source: "deepsolver",
      provider: "deepsolver",
      isMock: false,
      isReference: false,
      solverVersion: "deepsolver-v1",
      configurationKey: config.game_type + "_" + config.format + "_" + config.table_config.seat_count + "max_" + config.table_config.ante_type + "_" + config.effective_stack_bb + "bb",
    },
  };
}

function jsonError(status: number, message: string, diag: Diagnostics, userMessage?: string, debugReport?: unknown): Response {
  const body: Record<string, unknown> = {
    error: userMessage ?? message,
    technical_error: message,
    diagnostics: diag,
  };
  if (debugReport !== undefined) body.debug_report = debugReport;
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
