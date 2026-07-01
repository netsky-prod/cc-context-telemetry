import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TargetedCompactor } from "../src/compactor.ts";
import { sampleEvents } from "./fixtures.ts";

describe("TargetedCompactor", () => {
  test("dry-run estimates savings without mutating content or writing store files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ccct-"));
    const original = sampleEvents();

    const result = await new TargetedCompactor({
      dryRun: true,
      storeDir: join(dir, "store"),
      toolResultTokenThreshold: 50,
      filePayloadTokenThreshold: 50,
      keepLastN: 1
    }).compact(original);

    expect(result.dryRun).toBe(true);
    expect(result.changedEvents).toHaveLength(2);
    expect(result.estimatedTokensSaved).toBeGreaterThan(300);
    expect(result.events[2]?.content).toBe(original[2]?.content);
    expect(result.storeWrites).toHaveLength(0);
  });

  test("compacts old verbose tool results and file payloads with hash pointers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ccct-"));

    const result = await new TargetedCompactor({
      dryRun: false,
      storeDir: join(dir, "store"),
      toolResultTokenThreshold: 50,
      filePayloadTokenThreshold: 50,
      keepLastN: 1
    }).compact(sampleEvents());

    const filePayload = result.events.find((event) => event.id === "w1");
    const toolResult = result.events.find((event) => event.id === "r1");

    expect(filePayload?.content).toContain("ccct://sha256/");
    expect(filePayload?.content).toContain("summary:");
    expect(toolResult?.content).toContain("[compacted tool-result]");
    expect(result.storeWrites).toHaveLength(1);
    expect(readFileSync(result.storeWrites[0]!, "utf8")).toContain("generated");
  });
});
