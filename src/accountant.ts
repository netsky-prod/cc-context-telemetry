import { ApproximateTokenEstimator, type TokenEstimator } from "./tokenizer.ts";
import type {
  AccountedEvent,
  CategoryTotal,
  ContextGrowthPoint,
  NormalizedEvent,
  SegmentCategory,
  TokenAccount
} from "./types.ts";

const CATEGORIES: SegmentCategory[] = [
  "system",
  "user",
  "assistant-reasoning",
  "tool-args",
  "tool-result",
  "file-payloads",
  "mcp-output"
];

export class TokenAccountant {
  private readonly estimator: TokenEstimator;

  constructor(estimator: TokenEstimator = new ApproximateTokenEstimator()) {
    this.estimator = estimator;
  }

  analyze(events: NormalizedEvent[]): TokenAccount {
    const accounted = events.map((event) => this.withTokens(event));
    const totalTokens = accounted.reduce((sum, event) => sum + event.tokens, 0);
    const categoryTotals: Partial<Record<SegmentCategory, CategoryTotal>> = {};

    for (const category of CATEGORIES) {
      const categoryEvents = accounted.filter((event) => event.category === category);
      const tokens = categoryEvents.reduce((sum, event) => sum + event.tokens, 0);
      if (tokens > 0 || categoryEvents.length > 0) {
        categoryTotals[category] = {
          category,
          tokens,
          share: totalTokens === 0 ? 0 : tokens / totalTokens,
          events: categoryEvents.length
        };
      }
    }

    return {
      totalTokens,
      categoryTotals,
      contextGrowth: buildGrowthCurve(accounted),
      burnRate: {
        tokensPerTurn: accounted.length === 0 ? 0 : totalTokens / uniqueTurns(accounted),
        tokensPerEvent: accounted.length === 0 ? 0 : totalTokens / accounted.length
      },
      events: accounted
    };
  }

  count(text: string): number {
    return this.estimator.count(text);
  }

  private withTokens(event: NormalizedEvent): AccountedEvent {
    return {
      ...event,
      tokens: event.tokens ?? this.estimator.count(event.content)
    };
  }
}

function buildGrowthCurve(events: AccountedEvent[]): ContextGrowthPoint[] {
  let cumulativeTokens = 0;
  return [...events]
    .sort((a, b) => a.turn - b.turn)
    .map((event) => {
      cumulativeTokens += event.tokens;
      return {
        turn: event.turn,
        cumulativeTokens
      };
    });
}

function uniqueTurns(events: AccountedEvent[]): number {
  return new Set(events.map((event) => event.turn)).size;
}
