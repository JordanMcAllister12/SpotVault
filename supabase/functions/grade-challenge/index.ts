import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GradingResult {
  score: number;
  correct_elements: string[];
  missing_elements: string[];
  incorrect_elements: string[];
  explanation: string;
  grading_confidence: string;
}

interface RequestBody {
  challengeId: string;
  studentAnswer: string;
  attemptNumber?: number;
}

function buildGradingPrompt(
  question: string,
  formatInstructions: string,
  answerKey: string,
  gradingMode: string,
  rubric: Record<string, unknown>,
  studentAnswer: string
): string {
  const rubricText = rubric && Object.keys(rubric).length > 0
    ? JSON.stringify(rubric, null, 2)
    : "No explicit rubric provided. Use general poker knowledge standards.";

  const modeInstructions: Record<string, string> = {
    exact_combinations:
      "This is an EXACT COMBINATIONS question. Compare the student's hand list against the answer key. " +
      "Identify correctly identified hands, missing hands, and incorrectly included hands. " +
      "Use standard poker notation (e.g., AKs = suited, AKo = offsuit). Do NOT treat AKs and AKo as identical. " +
      "Normalize capitalization and separators before comparing. " +
      "Award substantial partial credit for identifying most required hands without incorrect additions. " +
      "Do NOT treat an overinclusive broad range as fully correct.",
    conceptual:
      "This is a CONCEPTUAL question. Evaluate whether the student's answer conveys the same strategic " +
      "understanding as the answer key, even if worded differently. " +
      "Distinguish between a strategically valid example and a complete answer to the actual question. " +
      "Do NOT mark wrong for different wording — evaluate meaning and strategic accuracy.",
    strategic_reasoning:
      "This is a STRATEGIC REASONING question. Evaluate the student's analysis against the rubric criteria. " +
      "Identify correct reasoning, missing considerations, and any strategic errors. " +
      "Allow different valid explanations to receive appropriate credit. " +
      "Do NOT require the student to reproduce the exact wording of the answer key.",
  };

  return `You are a poker education grader. Grade the student's answer against the coach's answer key.

QUESTION: ${question}

EXPECTED FORMAT: ${formatInstructions || "No specific format required."}

COACH'S ANSWER KEY: ${answerKey}

GRADING MODE: ${gradingMode}
${modeInstructions[gradingMode] || modeInstructions.conceptual}

GRADING RUBRIC:
${rubricText}

STUDENT'S ANSWER:
${studentAnswer}

IMPORTANT RULES:
- Do NOT invent solver outputs, equities, frequencies, or ranges not in the answer key.
- If the answer key is incomplete or ambiguous, note that in your explanation rather than guessing.
- Score on a 0-100 scale: 100 = fully correct, 75-99 = substantially correct with minor omissions, 50-74 = partially correct, 25-49 = limited understanding, 0-24 = fundamentally incorrect.
- The coach's answer key and rubric are AUTHORITATIVE. Do not replace the coach's intended strategy with your own assumptions.

Respond with ONLY a JSON object in this exact format:
{
  "score": <integer 0-100>,
  "correct_elements": [<string>],
  "missing_elements": [<string>],
  "incorrect_elements": [<string>],
  "explanation": "<concise educational explanation>",
  "grading_confidence": "high" | "medium" | "low"
}`;
}

function parseGradingResult(content: string): GradingResult | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.score !== "number" || parsed.score < 0 || parsed.score > 100) return null;
    return {
      score: Math.round(parsed.score),
      correct_elements: Array.isArray(parsed.correct_elements) ? parsed.correct_elements.map(String) : [],
      missing_elements: Array.isArray(parsed.missing_elements) ? parsed.missing_elements.map(String) : [],
      incorrect_elements: Array.isArray(parsed.incorrect_elements) ? parsed.incorrect_elements.map(String) : [],
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      grading_confidence: typeof parsed.grading_confidence === "string" ? parsed.grading_confidence : "medium",
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Auth check: verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { challengeId, studentAnswer, attemptNumber } = body;

    if (!challengeId || typeof challengeId !== "string" || challengeId.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid challenge ID." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!studentAnswer || typeof studentAnswer !== "string" || !studentAnswer.trim() || studentAnswer.length > 10000) {
      return new Response(JSON.stringify({ error: "Missing or invalid student answer." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the full challenge (including answer_key) server-side using service role
    const { data: challenge, error: challengeError } = await supabase
      .rpc("get_challenge_for_grading", { p_challenge_id: challengeId })
      .maybeSingle();

    if (challengeError || !challenge) {
      return new Response(JSON.stringify({ error: "Challenge not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildGradingPrompt(
      challenge.question,
      challenge.answer_format_instructions,
      challenge.answer_key,
      challenge.grading_mode,
      challenge.grading_rubric || {},
      studentAnswer
    );

    const aiKey = Deno.env.get("OPENAI_API_KEY");
    let gradingResult: GradingResult | null = null;
    let modelName = "placeholder";

    if (aiKey) {
      modelName = "gpt-4o-mini";
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a poker education grader. Evaluate student answers against the coach's answer key. Always respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });

      if (!resp.ok) {
        return new Response(JSON.stringify({ error: "Grading service unavailable. Please try again." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      gradingResult = parseGradingResult(content);
    } else {
      gradingResult = {
        score: 0,
        correct_elements: [],
        missing_elements: ["AI grading is not yet configured. Contact the site administrator."],
        incorrect_elements: [],
        explanation: "AI grading requires an API key to be configured on the server. Your answer has been recorded and will be graded once grading is available.",
        grading_confidence: "low",
      };
      modelName = "unconfigured";
    }

    if (!gradingResult) {
      return new Response(JSON.stringify({ error: "Grading failed — the AI returned an invalid response. Please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save the submission server-side with the authenticated user's ID
    const { error: insertError } = await supabase.from("ai_answer_submissions").insert({
      challenge_id: challengeId,
      student_id: user.id,
      student_answer: studentAnswer,
      score: gradingResult.score,
      feedback: gradingResult,
      grading_model: modelName,
      attempt_number: attemptNumber || 1,
    });

    if (insertError) {
      console.error("Failed to save submission:", insertError.message);
    }

    return new Response(JSON.stringify({ grading: gradingResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Grading failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
