import { describe, expect, test } from "bun:test";
import { buildBottleneckReport } from "../src/report.ts";
import { sampleEvents } from "./fixtures.ts";

describe("BottleneckReport", () => {
  test("identifies top payloads and primary bottleneck category", () => {
    const report = buildBottleneckReport(sampleEvents(), { topN: 2 });

    expect(report.primaryBottleneck.category).toBe("tool-result");
    expect(report.topPayloads).toHaveLength(2);
    expect(report.topPayloads[0]?.id).toBe("r1");
    expect(report.topPayloads[1]?.id).toBe("w1");
    expect(report.recommendations.join("\n")).toContain("tool-result");
  });
});
