import { corsHeaders } from "../_shared/cors.ts";

interface DeepSolverConfig {
  baseUrl: string;
  token: string;
}

function getConfig(): DeepSolverConfig | null {
  const baseUrl = Deno.env.get("DEEPSOLVER_API_BASE_URL");
  const token = Deno.env.get("DEEPSOLVER_API_TOKEN");
  if (!baseUrl || !token) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
  };
}

function authHeaders(): HeadersInit {
  return {
    "Authorization": `Token ${Deno.env.get("DEEPSOLVER_API_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

interface TestResult {
  step: string;
  success: boolean;
  status?: number;
  endpoint?: string;
  data?: unknown;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (supabaseUrl && anonKey) {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const results: TestResult[] = [];
  const config = getConfig();

  if (!config) {
    return new Response(
      JSON.stringify({
        error: "DEEPSOLVER_API_BASE_URL or DEEPSOLVER_API_TOKEN not configured",
        results,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // STEP 1: Verify API connectivity
  try {
    const res = await fetchWithTimeout(`${config.baseUrl}/`, { headers: authHeaders() }, 10000);
    results.push({
      step: "connectivity",
      success: res.ok || res.status === 404,
      status: res.status,
      endpoint: `${config.baseUrl}/`,
      data: res.status === 404
        ? "Root endpoint returned 404 (expected — API is reachable)"
        : await res.text().catch(() => null),
    });
  } catch (err) {
    results.push({
      step: "connectivity",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // STEP 2: Schedule a test solve
  // Schema discovered through iterative API validation:
  //   - iters: must be >= 100
  //   - ranges: list per player, each item is a list of numbers (1326-length binary/weight vector)
  //   - pot_fractions: [player][betting_round][sizes] nested arrays
  //   - board: string like "AsKh9d"
  //   - options: { results_format, save_raw_results, requested_attrs, requested_nodes }
  //   - tree_request: { pot_fractions, all_in_threshold, add_all_in_if_stack_lt_pot_times, pot_size, players_stacks_sizes }
  const FULL_RANGE: number[] = new Array(1326).fill(1);

  const schedulePayload = {
    iters: 100,
    board: "AsKh9d",
    ranges: [FULL_RANGE, FULL_RANGE],
    options: {
      results_format: "HOLDEM",
      save_raw_results: false,
      requested_attrs: [],
      requested_nodes: [],
    },
    tree_request: {
      pot_fractions: [
        [[0.5, 1.0]],
        [[0.5, 1.0]],
      ],
      all_in_threshold: 2.0,
      add_all_in_if_stack_lt_pot_times: 0,
      pot_size: 100,
      players_stacks_sizes: [100, 100],
    },
  };

  let taskId: string | null = null;

  try {
    const res = await fetchWithTimeout(
      `${config.baseUrl}/task/binary/cfr/schedule`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(schedulePayload),
      },
      15000,
    );

    const bodyText = await res.text();
    let bodyData: unknown = null;
    try { bodyData = JSON.parse(bodyText); } catch { bodyData = bodyText; }

    results.push({
      step: "schedule",
      success: res.ok,
      status: res.status,
      endpoint: "/task/binary/cfr/schedule",
      data: bodyData,
    });

    if (res.ok && bodyData && typeof bodyData === "object" && bodyData !== null) {
      const parsed = bodyData as Record<string, unknown>;
      taskId = (parsed.task_id ?? parsed.id ?? parsed.taskId) as string | null;
      if (taskId) {
        results.push({
          step: "task_id_received",
          success: true,
          data: { task_id: taskId },
        });
      }
    }
  } catch (err) {
    results.push({
      step: "schedule",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // STEP 3: If we got a task_id, poll status until finished
  if (taskId) {
    const maxPolls = 10;
    const pollIntervalMs = 3000;
    let resultAvailable = false;

    for (let i = 0; i < maxPolls; i++) {
      try {
        const statusRes = await fetchWithTimeout(
          `${config.baseUrl}/task/binary/cfr/status/${taskId}`,
          { headers: authHeaders() },
          10000,
        );

        const statusBody = await statusRes.text();
        let statusData: unknown = null;
        try { statusData = JSON.parse(statusBody); } catch { statusData = statusBody; }

        const isFinished =
          statusRes.ok &&
          typeof statusData === "object" && statusData !== null &&
          (statusData as Record<string, unknown>).result_available === true;

        results.push({
          step: `status_poll_${i + 1}`,
          success: statusRes.ok,
          status: statusRes.status,
          endpoint: `/task/binary/cfr/status/${taskId}`,
          data: statusData,
        });

        if (isFinished) {
          resultAvailable = true;

          // STEP 4: Fetch result URLs
          try {
            const resultRes = await fetchWithTimeout(
              `${config.baseUrl}/task/binary/cfr/result/url/${taskId}`,
              { headers: authHeaders() },
              10000,
            );

            const resultBody = await resultRes.text();
            let resultData: unknown = null;
            try { resultData = JSON.parse(resultBody); } catch { resultData = resultBody; }

            results.push({
              step: "result_fetch",
              success: resultRes.ok,
              status: resultRes.status,
              endpoint: `/task/binary/cfr/result/url/${taskId}`,
              data: resultData,
            });
          } catch (err) {
            results.push({
              step: "result_fetch",
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          break;
        }

        if (statusRes.status === 404) {
          results.push({
            step: `status_note_${i + 1}`,
            success: true,
            data: "404 — result not ready yet, continuing to poll",
          });
        }
      } catch (err) {
        results.push({
          step: `status_poll_${i + 1}`,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      if (i < maxPolls - 1) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    if (!resultAvailable) {
      results.push({
        step: "result_timeout",
        success: false,
        error: `Task did not complete within ${maxPolls * pollIntervalMs / 1000}s of polling`,
      });
    }
  }

  const summary = {
    connectivity: results.find((r) => r.step === "connectivity")?.success ?? false,
    schedule_succeeded: results.find((r) => r.step === "schedule")?.success ?? false,
    task_id: taskId,
    result_available: results.some((r) => r.step === "result_fetch" && r.success),
    schema_errors: results
      .filter((r) => r.step === "schedule" && !r.success)
      .map((r) => r.data),
    results,
  };

  return new Response(
    JSON.stringify(summary, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
