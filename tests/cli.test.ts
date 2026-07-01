import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = join(import.meta.dir, "..", "src", "cli.ts");

describe("CLI", () => {
  test("analyze emits a bottleneck report as JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ccct-cli-"));
    const transcript = join(dir, "transcript.jsonl");
    writeFileSync(
      transcript,
      [
        JSON.stringify({ role: "user", content: "hello" }),
        JSON.stringify({
          role: "user",
          content: [{ type: "tool_result", content: "x ".repeat(200) }]
        })
      ].join("\n")
    );

    const proc = Bun.spawn({
      cmd: ["bun", cli, "analyze", transcript, "--top", "1"],
      stdout: "pipe",
      stderr: "pipe"
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);

    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.totalTokens).toBeGreaterThan(100);
    expect(parsed.topPayloads).toHaveLength(1);
  });
});
