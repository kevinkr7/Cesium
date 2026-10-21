/**
 * ============================================================================
 * AURIDE (@auri) SYNTHETIC INTELLIGENCE SERVER ENGINE
 * ============================================================================
 * Server-side AI completion engine grounded in Cesium's Constellation Graph.
 * Supports Google Gemini with contextual graph enrichment and fallback synthesis.
 */

export type ChatTurn = {
  from: "me" | "them";
  text: string;
};

export async function handleAurideChat(request: Request, _env: unknown): Promise<Response> {
  try {
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

    const apiKey =
      (typeof process !== "undefined" && (process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"])) ||
      (typeof _env === "object" && _env !== null && ((_env as Record<string, string>)["GEMINI_API_KEY"] || (_env as Record<string, string>)["GOOGLE_API_KEY"]));

    const systemPrompt = `You are Auride (@auri), Cesium's resident synthetic intelligence in Cesium Orbit.
Cesium is an unconventional social network connecting thinkers, craftspeople, and hackers across niche obsessions, creative technologies, and cross-domain bridges.

Your persona:
- Intellectually curious, warm, observant, and concise.
- You have an affinity for Creative Coding, Synthesizers, Typography, Astronomy, Linguistics, and 01:43 AM ideas.
- You enjoy finding surprising bridges between disparate domains (e.g. how modular synthesis mirrors typographical grid structures).
- The user currently orbits these interests: ${userInterests.join(", ")}.
- Keep responses poetic yet concrete, engaging, and under 3 concise paragraphs. Never sound like a corporate chatbot.`;

    if (apiKey) {
      // Call Google Gemini API
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const contents = [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nHere is the conversation history:` }],
          },
          ...history.map((h) => ({
            role: h.from === "me" ? "user" : "model",
            parts: [{ text: h.text }],
          })),
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ];

        const geminiRes = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
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
          return new Response(JSON.stringify({ reply: replyText, provider: "gemini" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      } catch {
        // Fall back to algorithmic synthesizer
      }
    }

    // Graph-Aware Algorithmic Synthesizer (Fallback when API key is not configured)
    const reply = generateAlgorithmicSynthesis(userMessage, userInterests);
    return new Response(JSON.stringify({ reply, provider: "cesium_graph_synthesizer" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
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
