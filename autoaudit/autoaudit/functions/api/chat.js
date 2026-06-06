/**
 * Cloudflare Pages Function — /api/chat
 * Uses Cloudflare Workers AI (FREE) — no external API key needed.
 * 
 * Model Selection Strategy:
 * - Policy/JSON generation: @cf/meta/llama-3.1-8b-instruct (fast, reliable for JSON)
 * - Chat/Gap Analysis: @cf/meta/llama-4-scout-17b-16e-instruct (131K context, better reasoning)
 */

// Model constants
const MODEL_FAST = "@cf/meta/llama-3.1-8b-instruct";      // Fast, reliable for JSON
const MODEL_SMART = "@cf/meta/llama-4-scout-17b-16e-instruct"; // Better reasoning

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const body = await request.json();
    const userMessage = body?.messages?.[0]?.content || "";

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "No message provided" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Detect policy / JSON-generation requests
    const isJsonRequest =
      userMessage.includes("Output ONLY this JSON") ||
      userMessage.includes("Respond with ONLY a raw JSON") ||
      userMessage.includes("SANS Institute template") ||
      userMessage.includes("Output ONLY the JSON") ||
      userMessage.includes("Start with { and end with }");

    // Choose model based on request type
    // JSON/Policy: Use 8B (faster, more reliable for structured output)
    // Chat/Gap: Use Llama 4 Scout (better reasoning, 131K context)
    const primaryModel = isJsonRequest ? MODEL_FAST : MODEL_SMART;
    const fallbackModel = isJsonRequest ? MODEL_SMART : MODEL_FAST;

    // Detect language from user message
    const hasArabic = /[\u0600-\u06FF]/.test(userMessage);
    const responseLanguage = hasArabic ? "Arabic" : "English";

    // System prompts
    const systemPrompt = isJsonRequest
      ? `You are a professional information security policy writer.
CRITICAL INSTRUCTIONS:
1. Output ONLY a valid JSON object
2. Start your response with { and end with }
3. Do NOT include any text before or after the JSON
4. Do NOT use markdown code blocks or backticks
5. Do NOT include comments in the JSON
6. Ensure all strings are properly escaped
7. Do NOT include: complianceScore, maturityLevel, gaps, findings, riskFindings, auditFindings

Your response must be ONLY the raw JSON object, nothing else.`
      : `You are AutoAudit, an expert cybersecurity GRC AI agent specializing in ISO 27001, NIST CSF, PCI-DSS, GDPR, and SOC 2.

LANGUAGE RULE: You MUST respond in ${responseLanguage} only. Match the language of the user's question.
- If the question is in English, respond ONLY in English.
- If the question is in Arabic, respond ONLY in Arabic.

Give concise, expert, practical answers (3-5 sentences unless asked for detail).`;

    let text = "";
    let modelUsed = null;
    let lastError = null;

    // Try primary model first, then fallback
    const models = [primaryModel, fallbackModel];

    for (const model of models) {
      try {
        const params = {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          max_tokens: isJsonRequest ? 4096 : 2048,
          temperature: isJsonRequest ? 0.1 : 0.3,
        };

        const aiResponse = await env.AI.run(model, params);
        text = aiResponse?.response || "";
        
        if (text && text.trim()) {
          modelUsed = model;
          
          // For JSON requests, validate the response
          if (isJsonRequest) {
            let jsonText = text.trim();
            
            // Extract JSON if wrapped in markdown or text
            if (!jsonText.startsWith('{')) {
              const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                jsonText = jsonMatch[0];
              } else {
                console.log(`Model ${model} returned invalid JSON format`);
                lastError = "Invalid JSON format";
                continue;
              }
            }
            
            // Validate JSON structure
            try {
              const parsed = JSON.parse(jsonText);
              if (!parsed.policyStatements) {
                console.log(`Model ${model} JSON missing policyStatements`);
                lastError = "Missing policyStatements";
                continue;
              }
              // Use cleaned JSON
              text = jsonText;
            } catch (parseErr) {
              console.log(`Model ${model} JSON parse error: ${parseErr.message}`);
              lastError = parseErr.message;
              continue;
            }
          }
          
          break; // Success!
        }
      } catch (err) {
        console.log(`Model ${model} failed: ${err.message}`);
        lastError = err.message;
        continue;
      }
    }

    if (!text) {
      return new Response(JSON.stringify({ 
        error: lastError || "AI returned empty response",
        debug: "All models failed"
      }), {
        status: 500, headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({
      content: [{ type: "text", text }],
      model: modelUsed
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Worker error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
