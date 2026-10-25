import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PER_SPOT_LIMIT = 2;
const WEEKLY_LIMIT = 20;

interface SpotContext {
  title: string;
  subtitle: string | null;
  introduction: string | null;
  hand_details: string | null;
  content_html: string;
  tags: Record<string, string>;
  source: string;
}

interface RequestBody {
  fieldType: string;
  context: SpotContext;
  currentText: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function buildPrompt(fieldType: string, ctx: SpotContext, currentText: string): string {
  const contextParts: string[] = [];
  if (ctx.source) contextParts.push(`Source: ${ctx.source}`);
  if (ctx.title) contextParts.push(`Title: ${ctx.title}`);
  if (ctx.subtitle) contextParts.push(`Subtitle: ${ctx.subtitle}`);
  if (ctx.introduction) contextParts.push(`Introduction: ${ctx.introduction}`);
  if (ctx.hand_details) contextParts.push(`Hand Details: ${ctx.hand_details}`);
  const contentText = stripHtml(ctx.content_html);
  if (contentText) contextParts.push(`Existing Content: ${contentText.slice(0, 500)}`);
  const tagValues = Object.values(ctx.tags).filter(Boolean);
  if (tagValues.length > 0) contextParts.push(`Tags: ${tagValues.join(", ")}`);

  const contextBlock = contextParts.join("\n");

  const fieldPrompts: Record<string, string> = {
    title: `You are a poker content editor. Based on the spot context below, suggest a concise, engaging title (max 60 characters) that accurately describes the poker situation. ${currentText ? `The current title is "${currentText}". Improve it.` : ""}\n\nContext:\n${contextBlock}\n\nRespond with ONLY the suggested title, no explanation.`,
    subtitle: `You are a poker content editor. Based on the spot context below, suggest a brief subtitle (max 100 characters) that adds context. ${currentText ? `The current subtitle is "${currentText}". Improve it.` : ""}\n\nContext:\n${contextBlock}\n\nRespond with ONLY the suggested subtitle, no explanation.`,
    introduction: `You are a poker content writer. Based on the spot context below, write a clear, engaging introduction/overview (2-4 sentences) that sets up the poker situation for the reader. ${currentText ? `Improve the existing introduction: "${currentText}".` : ""}\n\nContext:\n${contextBlock}\n\nRespond with ONLY the introduction text, no explanation.`,
    hand_details: `You are a poker content editor. Based on the spot context below, help structure the hand scenario clearly. Include relevant details: game type, stakes, positions, stack depths, action, ranges, pot size, tournament stage, ICM considerations. ${currentText ? `Improve the existing scenario: "${currentText}".` : ""}\n\nContext:\n${contextBlock}\n\nRespond with ONLY the structured hand details, no explanation.`,
    content: `You are a poker content writer and coach. Based on the spot context below, write clear, educational content that analyzes the poker situation. Improve structure, clarity and educational value. ${currentText ? `Improve the existing content: "${stripHtml(currentText).slice(0, 800)}".` : ""}\n\nContext:\n${contextBlock}\n\nRespond with ONLY the content as plain text (use \\n for line breaks), no explanation.`,
    tags: `You are a poker content categorizer. Based on the spot context below, suggest 3-6 relevant searchable tags that would help players find this content. Consider: game type, stakes level, position, concept, skill level, tournament stage. ${currentText ? `Current tags: ${currentText}.` : ""}\n\nContext:\n${contextBlock}\n\nRespond with ONLY comma-separated tags, no explanation.`,
  };

  return fieldPrompts[fieldType] ?? fieldPrompts.title;
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
    // Verify authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { fieldType, context, currentText } = body;

    if (!fieldType || !context) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the prompt
    const prompt = buildPrompt(fieldType, context, currentText || "");

    // For now, generate a structured placeholder suggestion.
    // When an AI API key is configured, this will call the actual AI provider.
    const aiKey = Deno.env.get("OPENAI_API_KEY");

    let suggestion: string;

    if (aiKey) {
      // Call OpenAI API
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${aiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful poker content assistant. Keep responses concise and focused on poker education." },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!resp.ok) {
        return new Response(JSON.stringify({ error: "AI Assist couldn't generate a response. Try again." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      suggestion = data.choices?.[0]?.message?.content?.trim() ?? "";
    } else {
      // No API key — generate a contextual placeholder based on the spot context
      suggestion = generateContextualSuggestion(fieldType, context, currentText || "");
    }

    if (!suggestion) {
      return new Response(JSON.stringify({ error: "AI Assist couldn't generate a response. Try again." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "AI Assist couldn't generate a response. Try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateContextualSuggestion(fieldType: string, ctx: SpotContext, currentText: string): string {
  const title = ctx.title || "Untitled Spot";
  const hand = ctx.hand_details || "";
  const intro = ctx.introduction || "";
  const source = ctx.source || "";

  if (fieldType === "title") {
    if (hand) {
      const firstLine = hand.split("\n")[0];
      return `${firstLine.slice(0, 50)} — Key Spot Analysis`;
    }
    return `${title}: A Deep Dive`;
  }
  if (fieldType === "subtitle") {
    if (source === "Tournament") return "Final table ICM pressure with a critical decision";
    if (source === "Cash Game") return "Stack depth considerations in a marginal spot";
    return "Breaking down a key poker decision";
  }
  if (fieldType === "introduction") {
    const handSummary = hand ? ` In this spot, we face ${hand.slice(0, 100)}.` : "";
    return `In this spot, we examine a ${source.toLowerCase() || "poker"} situation that requires careful analysis.${handSummary} The goal is to understand the key factors that should drive our decision and build a framework for similar spots in the future.`;
  }
  if (fieldType === "hand_details") {
    if (currentText) return currentText;
    return `Game: NLHE\nStakes: TBD\nPosition: TBD\nStack Depth: TBD\nAction: TBD\nPot Size: TBD\nNotes: Add the specific action sequence, player tendencies, and any ICM considerations relevant to this spot.`;
  }
  if (fieldType === "content") {
    return `This spot presents an interesting decision point. Let's break down the key factors:\n\n1. Position and Stack Depth\nThe effective stack and our position relative to the aggressor should shape our range decisions.\n\n2. Range Considerations\nUnderstanding both our range and our opponent's range is critical. What hands do we continue with vs fold?\n\n3. Key Takeaway\nThe most important lesson here is recognizing when marginal spots require discipline. Not every situation calls for aggression — sometimes the best play is the one that preserves our stack for better opportunities.`;
  }
  if (fieldType === "tags") {
    const tags: string[] = [];
    if (source) tags.push(source.toLowerCase());
    if (hand.includes("ICM") || hand.includes("final table")) tags.push("ICM", "Final Table");
    if (hand.includes("3bet") || hand.includes("4bet")) tags.push("3-Bet Pot");
    if (hand.includes("cash") || source === "Cash Game") tags.push("Cash Game");
    tags.push("Preflop", "Strategy");
    return tags.slice(0, 6).join(", ");
  }
  return "";
}
