import { getPostHogClient } from "@/lib/posthog-server";
import type OpenAI from "openai";

type ModelType = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet-4-6" | "claude-opus-4-8" | "claude-haiku-4-5" | string;

// Prices per 1 000 tokens (input / output)
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o":            { input: 0.005,    output: 0.015  },
  "gpt-4o-mini":       { input: 0.00015,  output: 0.0006 },
  "claude-sonnet-4-6": { input: 0.003,    output: 0.015  },
  "claude-opus-4-8":   { input: 0.015,    output: 0.075  },
  "claude-haiku-4-5":  { input: 0.0008,   output: 0.004  },
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

  // Record usage — trigger on token_usage recomputes credit_balance_usd automatically
  if (costUsd > 0) {
    const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
    void fetch(`${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/rpc/insert_token_usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_cost_usd: Math.round(costUsd * 100000) / 100000,
        p_feature: feature,
        p_model: model,
        p_prompt_tokens: promptTokens,
        p_completion_tokens: completionTokens,
      }),
    });
  }
}

// Helper to sum usage across multiple completions.
export class TokenAccumulator {
  promptTokens = 0;
  completionTokens = 0;

  // OpenAI usage (prompt_tokens / completion_tokens)
  add(usage: OpenAI.CompletionUsage | null | undefined) {
    this.promptTokens += usage?.prompt_tokens ?? 0;
    this.completionTokens += usage?.completion_tokens ?? 0;
  }

  // Anthropic usage (input_tokens / output_tokens)
  addAnthropic(usage: { input_tokens: number; output_tokens: number } | null | undefined) {
    this.promptTokens += usage?.input_tokens ?? 0;
    this.completionTokens += usage?.output_tokens ?? 0;
  }

  flush(userId: string, feature: string, model: ModelType) {
    trackTokens(userId, feature, model, this.promptTokens, this.completionTokens);
  }
}
