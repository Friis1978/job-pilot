import { getPostHogClient } from "@/lib/posthog-server";
import { createClient } from "@insforge/sdk";
import type OpenAI from "openai";

const insforgeAnon = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

type ModelType = "gpt-4o" | "gpt-4o-mini" | string;

const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
};

// Fire-and-forget — does not need to be awaited.
export function trackTokens(
  userId: string,
  feature: string,
  model: ModelType,
  promptTokens: number,
  completionTokens: number,
) {
  if (!userId || (!promptTokens && !completionTokens)) return;
  const pricing = PRICING[model] ?? PRICING["gpt-4o"];
  const costUsd =
    promptTokens * (pricing.input / 1000) +
    completionTokens * (pricing.output / 1000);

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "ai_tokens_used",
    properties: {
      feature,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost_usd: Math.round(costUsd * 100000) / 100000,
    },
  });
  void posthog.shutdown();

  // Decrement credit balance — fire and forget
  if (costUsd > 0) {
    void insforgeAnon.database.rpc("decrement_credit_balance", {
      p_user_id: userId,
      p_amount: Math.round(costUsd * 100000) / 100000,
    });
  }
}

// Helper to sum usage across multiple completions (for agents that call OpenAI several times).
export class TokenAccumulator {
  promptTokens = 0;
  completionTokens = 0;

  add(usage: OpenAI.CompletionUsage | null | undefined) {
    this.promptTokens += usage?.prompt_tokens ?? 0;
    this.completionTokens += usage?.completion_tokens ?? 0;
  }

  flush(userId: string, feature: string, model: ModelType) {
    trackTokens(userId, feature, model, this.promptTokens, this.completionTokens);
  }
}
