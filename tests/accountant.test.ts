import { describe, expect, test } from "bun:test";
import { TokenAccountant } from "../src/accountant.ts";
import { sampleEvents } from "./fixtures.ts";

describe("TokenAccountant", () => {
  test("computes totals, category shares, growth curve, and burn rate", () => {
    const report = new TokenAccountant().analyze(sampleEvents());

    expect(report.totalTokens).toBe(506);
    expect(report.categoryTotals["tool-result"]?.tokens).toBe(253);
    expect(report.categoryTotals["file-payloads"]?.tokens).toBe(230);
    expect(report.categoryTotals["tool-result"]?.share).toBeCloseTo(0.5, 2);
    expect(report.contextGrowth).toEqual([
      { turn: 1, cumulativeTokens: 11 },
      { turn: 2, cumulativeTokens: 23 },
      { turn: 3, cumulativeTokens: 253 },
      { turn: 4, cumulativeTokens: 503 },
      { turn: 5, cumulativeTokens: 506 }
    ]);
    expect(report.burnRate.tokensPerTurn).toBeCloseTo(101.2, 1);
  });

  test("uses estimator when events do not include token counts", () => {
    const report = new TokenAccountant().analyze([
      {
        id: "1",
        turn: 1,
        timestamp: "2026-01-01T00:00:00.000Z",
        source: "transcript",
        role: "user",
        category: "user",
        content: "one two three four",
        metadata: {}
      }
    ]);

    expect(report.totalTokens).toBeGreaterThanOrEqual(4);
    expect(report.events[0]?.tokens).toBe(report.totalTokens);
  });
});
