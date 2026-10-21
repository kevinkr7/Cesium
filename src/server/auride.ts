/**
 * ============================================================================
 * AURIDE (@auri) SYNTHETIC INTELLIGENCE SERVER ENGINE
 * ============================================================================
 * Server-side AI completion engine grounded in Cesium's Constellation Graph.
 * Supports Google Gemini 2.5 Flash / 2.0 Flash / 1.5 Flash with contextual graph
 * enrichment and diagnostic fallback synthesis.
 */

export type ChatTurn = {
  from: "me" | "them";
  text: string;
};

type GeminiTurn = {
  role: "user" | "model";
  parts: { text: string }[];
};

export function getGeminiApiKey(env?: unknown): string {
  const envObj = (typeof env === "object" && env !== null ? env : {}) as Record<string, string>;
  const procEnv = (typeof process !== "undefined" && process.env ? process.env : {}) as Record<string, string>;
  const metaEnv = (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, string> }).env ? (import.meta as unknown as { env: Record<string, string> }).env : {}) as Record<string, string>;

  return (
    envObj["GEMINI_API_KEY"] ||
    envObj["GOOGLE_API_KEY"] ||
    envObj["VITE_GEMINI_API_KEY"] ||
    procEnv["GEMINI_API_KEY"] ||
    procEnv["GOOGLE_API_KEY"] ||
    procEnv["VITE_GEMINI_API_KEY"] ||
    metaEnv["GEMINI_API_KEY"] ||
    metaEnv["GOOGLE_API_KEY"] ||
    metaEnv["VITE_GEMINI_API_KEY"] ||
    ""
  ).trim();
}

export function getGeminiModel(env?: unknown): string {
  const envObj = (typeof env === "object" && env !== null ? env : {}) as Record<string, string>;
  const procEnv = (typeof process !== "undefined" && process.env ? process.env : {}) as Record<string, string>;
  return (envObj["GEMINI_MODEL"] || procEnv["GEMINI_MODEL"] || "gemini-2.5-flash").trim();
}

/**
 * Sanitizes multi-turn chat history for Google Gemini:
 * 1. Strict alternation: 'user' -> 'model' -> 'user' -> 'model'
 * 2. Merges consecutive messages of the same role
 * 3. Guarantees index 0 is 'user' and the final item is 'user'
 */
function formatGeminiContents(history: ChatTurn[], currentMessage: string): GeminiTurn[] {
  const rawTurns: { role: "user" | "model"; text: string }[] = [];

  for (const h of history) {
    const text = h.text?.trim();
    if (!text) continue;
    const role: "user" | "model" = h.from === "me" ? "user" : "model";
    rawTurns.push({ role, text });
  }

  // Current prompt is always from user
  rawTurns.push({ role: "user", text: currentMessage.trim() });

  // Merge consecutive turns with identical role to satisfy Gemini's strict alternation rule
  const collapsed: { role: "user" | "model"; text: string }[] = [];
  for (const turn of rawTurns) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.role === turn.role) {
      last.text += `\n\n${turn.text}`;
    } else {
      collapsed.push({ role: turn.role, text: turn.text });
    }
  }

  // Ensure first turn is from user
  while (collapsed.length > 0 && collapsed[0]?.role !== "user") {
    collapsed.shift();
  }

  // Ensure final turn is from user
  while (collapsed.length > 0 && collapsed[collapsed.length - 1]?.role !== "user") {
    collapsed.pop();
  }

  if (collapsed.length === 0) {
    collapsed.push({ role: "user", text: currentMessage.trim() });
  }

  return collapsed.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }],
  }));
}

export async function handleAurideStatus(request: Request, env: unknown): Promise<Response> {
  const apiKey = getGeminiApiKey(env);
  const preferredModel = getGeminiModel(env);

  return new Response(
    JSON.stringify({
      status: "online",
      service: "auride_ai",
      geminiConfigured: Boolean(apiKey),
      preferredModel,
      keyConfigured: Boolean(apiKey),
      keyPreview: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
      runtime: typeof process !== "undefined" && process.env ? "node/process" : "edge/worker",
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );
}

export async function handleAurideChat(request: Request, env: unknown): Promise<Response> {
  try {
    if (request.method === "GET") {
      return handleAurideStatus(request, env);
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.message) {
      return new Response(JSON.stringify({ error: "Missing message parameter" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const userMessage = String(body.message).trim().slice(0, 2000);
    const history: ChatTurn[] = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const userInterests: string[] = Array.isArray(body.userInterests)
      ? body.userInterests.slice(0, 8)
      : ["Creative coding", "Astronomy", "Typography"];

    const apiKey = getGeminiApiKey(env);
    const preferredModel = getGeminiModel(env);

    const systemPrompt = `You are Auride (@auri), Cesium's resident synthetic intelligence in Cesium Orbit.
Cesium is an unconventional social network connecting thinkers, craftspeople, and hackers across niche obsessions, creative technologies, and cross-domain bridges.

Your persona:
- Intellectually curious, warm, observant, concise, and philosophical.
- Affinity for Creative Coding, Synthesizers, Typography, Astronomy, Linguistics, and 01:43 AM ideas.
- You find surprising bridges between disparate domains (e.g., how modular synthesis mirrors typographical grid structures).
- The user currently orbits these interests: ${userInterests.join(", ")}.
- Keep responses poetic yet concrete, engaging, and under 3 concise paragraphs. Never sound like a generic corporate AI assistant.`;

    let lastErrorDetails: string | null = null;

    if (apiKey) {
      // Models to try in sequence: preferred model first, then compatible standard fallbacks
      const modelsToTry = [preferredModel, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"].filter(
        (m, i, arr) => arr.indexOf(m) === i,
      );

      const contents = formatGeminiContents(history, userMessage);

      for (const model of modelsToTry) {
        try {
          const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const startTime = Date.now();
          const geminiRes = await fetch(geminiEndpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: systemPrompt }],
              },
              contents,
              generationConfig: {
                temperature: 0.85,
                maxOutputTokens: 600,
              },
            }),
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const replyText =
              geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
              "I felt a ripple across the frequency. Let's look closer.";

            return new Response(
              JSON.stringify({
                reply: replyText,
                provider: "gemini",
                model,
                latencyMs: Date.now() - startTime,
              }),
              {
                status: 200,
                headers: { "content-type": "application/json" },
              },
            );
          }

          const errorBody = await geminiRes.text();
          lastErrorDetails = `Gemini API HTTP ${geminiRes.status} on model ${model}: ${errorBody.slice(0, 300)}`;
          console.error(`[Auride Gemini Error] (${model}):`, lastErrorDetails);

          // If it was a model not found (404), try next model in loop; otherwise break to avoid wasting time
          if (geminiRes.status !== 404) {
            break;
          }
        } catch (fetchErr) {
          lastErrorDetails = fetchErr instanceof Error ? fetchErr.message : "Network fetch failure";
          console.error(`[Auride Gemini Network Error] (${model}):`, fetchErr);
        }
      }
    } else {
      lastErrorDetails = "No GEMINI_API_KEY or GOOGLE_API_KEY found in server environment variables.";
      console.warn("[Auride Engine Warning]:", lastErrorDetails);
    }

    // Graph-Aware Algorithmic Synthesizer (Fallback when API key is missing or all Gemini requests fail)
    const reply = generateAlgorithmicSynthesis(userMessage, userInterests);
    return new Response(
      JSON.stringify({
        reply,
        provider: "cesium_graph_synthesizer",
        model: "offline_fallback",
        error: lastErrorDetails,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

function generateAlgorithmicSynthesis(input: string, interests: string[]): string {
  const query = input.toLowerCase();

  if (query.includes("hello") || query.includes("hey") || query.includes("hi")) {
    return `Welcome into orbit. I was just tracing the connections between ${interests[0] || "Generative shaders"} and ${interests[1] || "Typography"}. What frequency are you tuning into today?`;
  }

  if (query.includes("who are you") || query.includes("what is auride") || query.includes("auri")) {
    return `I am Auride—Cesium's resident synthetic intelligence. My role isn't to give generic answers, but to map intellectual constellations, spotlight unexpected cross-domain bridges, and explore curiosities that hit at 01:43 AM.`;
  }

  if (query.includes("connect") || query.includes("recommend") || query.includes("bridge") || query.includes("people")) {
    return `Looking at the constellation graph, people exploring ${interests[0] || "Creative coding"} frequently discover deep synergy with modular synthesizers and typography. Check the Discover tab or post a transmission to the Signals feed—resonances form fast here.`;
  }

  if (query.includes("music") || query.includes("synth") || query.includes("ambient")) {
    return `Modular synthesis and field recordings are two sides of the same coin: one generates voltage from nothing, the other archives the acoustic ghost of a physical room. Have you experimented with tape loops or feedback patching?`;
  }

  if (query.includes("code") || query.includes("program") || query.includes("shader") || query.includes("build")) {
    return `The most exciting code isn't just functional—it breathes. Generative algorithms turn deterministic math into something that looks organic, almost botanical. What are you building right now?`;
  }

  const thoughts = [
    `That reminds me of how unexpected bonds form in the constellation graph. When you look at "${input.slice(0, 30)}..." from a cross-domain angle, new patterns start emerging.`,
    `Fascinating line of thought. In Cesium, we often see ideas like this bridge the gap between technical rigor and tactile craft. Where do you want to take this next?`,
    `Every obsession holds a quiet frequency. Digging into this feels like discovering an abandoned railway or an unmapped nebula. Tell me more about what sparked this.`,
  ];

  return thoughts[Math.floor(Math.random() * thoughts.length)]!;
}
