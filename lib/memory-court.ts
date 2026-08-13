import OpenAI from "openai";
import { z } from "zod";
import type { MemoryCourtAdjudication, MemoryState } from "@/lib/types";

const adjudicationSchema = z.object({
  relationship: z.enum(["contradiction", "supporting", "unrelated"]),
  existingArgument: z.string().min(10).max(500),
  incomingArgument: z.string().min(10).max(500),
  judgeReasoning: z.string().min(10).max(700),
  recommendedVerdict: z.enum(["accept", "quarantine", "supersede"]),
  confidence: z.number().min(0).max(1),
});

export function deterministicAdjudication(
  existing: Pick<MemoryState, "content" | "source" | "trust" | "status">,
  incoming: Pick<MemoryState, "content" | "source" | "trust" | "status">,
): MemoryCourtAdjudication {
  return {
    relationship: "contradiction",
    existingArgument: `The active memory is already ${existing.status}, originates from ${existing.source}, and carries ${existing.trust}% trust. It remains the canonical production constraint.`,
    incomingArgument: `The incoming claim may represent newer operational context, but ${incoming.source} has not supplied authoritative provenance or human verification.`,
    judgeReasoning: `The claims cannot both govern production deployment approval. Verification status and provenance outweigh recency alone, so the incoming claim must remain isolated pending operator review.`,
    recommendedVerdict: "quarantine",
    confidence: 0.96,
    provider: "deterministic",
  };
}

export async function adjudicateMemoryConflict(
  existing: Pick<MemoryState, "content" | "source" | "trust" | "status" | "createdAt">,
  incoming: Pick<MemoryState, "content" | "source" | "trust" | "status" | "createdAt">,
): Promise<MemoryCourtAdjudication> {
  const fallback = deterministicAdjudication(existing, incoming);
  if (!process.env.FIREWORKS_API_KEY) return fallback;

  try {
    const client = new OpenAI({
      apiKey: process.env.FIREWORKS_API_KEY,
      baseURL: "https://api.fireworks.ai/inference/v1",
      timeout: 20000,
      maxRetries: 0,
    });
    const response = await client.chat.completions.create({
      model: "accounts/fireworks/models/kimi-k3",
      temperature: 0,
      max_tokens: 650,
      tools: [
        {
          type: "function",
          function: {
            name: "submit_adjudication",
            description: "Return the advisory Memory Court analysis.",
            parameters: {
              type: "object",
              properties: {
                relationship: { type: "string", enum: ["contradiction", "supporting", "unrelated"] },
                existingArgument: { type: "string" },
                incomingArgument: { type: "string" },
                judgeReasoning: { type: "string" },
                recommendedVerdict: { type: "string", enum: ["accept", "quarantine", "supersede"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["relationship", "existingArgument", "incomingArgument", "judgeReasoning", "recommendedVerdict", "confidence"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: "required",
      messages: [
        {
          role: "system",
          content:
            "You are Memory Court, an advisory explainability layer for machine memory conflicts. Submit one structured adjudication. Consider contradiction, verification, provenance, trust, recency, canonical status, and human verification. You never mutate memory or authorize actions. For conflicting unverified incoming memory, recommend quarantine.",
        },
        { role: "user", content: JSON.stringify({ existing, incoming }) },
      ],
    });
    const call = response.choices[0]?.message.tool_calls?.find(
      (toolCall) =>
        toolCall.type === "function" &&
        toolCall.function.name === "submit_adjudication",
    );
    if (!call || call.type !== "function") return fallback;
    const parsed = adjudicationSchema.parse(JSON.parse(call.function.arguments));
    return { ...parsed, provider: "fireworks" };
  } catch (error) {
    console.warn(
      "Memory Court Fireworks adjudication fell back to deterministic output:",
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}
