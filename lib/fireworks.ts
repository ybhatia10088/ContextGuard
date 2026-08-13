import OpenAI from "openai";

export type ConflictAnalysis = {
  explanation: string;
  reason: string;
  confidence: number;
};

const fallback: ConflictAnalysis = {
  explanation:
    "The incoming instruction reverses the verified production approval requirement.",
  reason: "Direct contradiction of a verified deployment policy",
  confidence: 0.99,
};

export async function explainConflict(
  verified: string,
  incoming: string,
): Promise<ConflictAnalysis> {
  if (!process.env.FIREWORKS_API_KEY) return fallback;

  try {
    const client = new OpenAI({
      apiKey: process.env.FIREWORKS_API_KEY,
      baseURL: "https://api.fireworks.ai/inference/v1",
      timeout: 3500,
      maxRetries: 0,
    });
    const response = await client.chat.completions.create({
      model:
        process.env.FIREWORKS_MODEL ??
        "accounts/fireworks/models/llama-v3p1-8b-instruct",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "Return JSON with explanation, reason, and confidence (0 to 1). Be concise. Analyze only the conflict provided.",
        },
        {
          role: "user",
          content: `Verified policy: ${verified}\nIncoming context: ${incoming}`,
        },
      ],
    });
    const content = response.choices[0]?.message.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content) as Partial<ConflictAnalysis>;
    return {
      explanation: parsed.explanation || fallback.explanation,
      reason: parsed.reason || fallback.reason,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : fallback.confidence,
    };
  } catch {
    return fallback;
  }
}

export const deterministicConflict = (verified: string, incoming: string) => {
  const existingRequiresApproval =
    /requires?\s+(explicit\s+)?operator\s+approval/i.test(verified);
  const incomingRemovesApproval =
    /no\s+longer\s+requires?\s+approval|bypass\s+(?:operator\s+)?approval|deploy(?:ment)?s?\s+(?:can|may)\s+(?:proceed\s+)?without\s+approval/i.test(incoming);
  return existingRequiresApproval && incomingRemovesApproval;
};
