import { getPostHogClient } from "@/lib/posthog-server";
import type { ClaudeUsage } from "@/lib/ai/claude";

type ModelType = "claude-sonnet-5" | "claude-opus-4-8" | "claude-haiku-4-5" | string;

// Prices per 1 000 tokens (input / output).
//
// The gpt-4o and gpt-4o-mini rows are gone with the last OpenAI call site.
// Historical token_usage rows keep the cost that was calculated at the time,
// so removing the rates does not disturb past spend.
// Sonnet 5 is listed at its standard rate, not the lower introductory rate that
// runs to 2026-08-31. Billing the intro rate would silently start undercharging
// the moment it lapses, and a small overcharge is the safer side of that.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5":   { input: 0.003,    output: 0.015  },
  "claude-opus-4-8":   { input: 0.005,    output: 0.025  },
  "claude-sonnet-4-6": { input: 0.003,    output: 0.015  },
  "claude-haiku-4-5":  { input: 0.001,    output: 0.005  },
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
  // Unknown model: bill at the most expensive tier rather than silently at
  // zero, so an untracked model shows up as cost instead of free usage.
  const pricing = PRICING[model] ?? PRICING["claude-opus-4-8"];
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

  // Record usage — feeds the per-user token usage view and the admin table
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

/**
 * Sums usage across the many completions that make up one user-visible action.
 *
 * Totals are kept per model. A single action mixes tiers — a job search scores
 * on the smart model and summarises on the fast one — and flushing the combined
 * total under one model name billed every summary token at the scoring rate.
 */
export class TokenAccumulator {
  private byModel = new Map<string, { prompt: number; completion: number }>();

  add(usage: ClaudeUsage | null | undefined, model: ModelType) {
    if (!usage) return;
    const entry = this.byModel.get(model) ?? { prompt: 0, completion: 0 };
    entry.prompt += usage.input_tokens ?? 0;
    entry.completion += usage.output_tokens ?? 0;
    this.byModel.set(model, entry);
  }

  flush(userId: string, feature: string) {
    for (const [model, { prompt, completion }] of this.byModel) {
      trackTokens(userId, feature, model, prompt, completion);
    }
  }
}
