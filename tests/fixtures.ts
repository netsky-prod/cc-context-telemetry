import type { NormalizedEvent } from "../src/types.ts";

export function sampleEvents(): NormalizedEvent[] {
  return [
    {
      id: "u1",
      turn: 1,
      timestamp: "2026-01-01T00:00:00.000Z",
      source: "transcript",
      role: "user",
      category: "user",
      content: "Please update the parser and keep the patch small.",
      tokens: 11,
      metadata: {}
    },
    {
      id: "a1",
      turn: 2,
      timestamp: "2026-01-01T00:00:01.000Z",
      source: "transcript",
      role: "assistant",
      category: "assistant-reasoning",
      content: "I will inspect the parser and add focused tests.",
      tokens: 12,
      metadata: {}
    },
    {
      id: "w1",
      turn: 3,
      timestamp: "2026-01-01T00:00:02.000Z",
      source: "transcript",
      role: "tool",
      toolName: "Write",
      category: "file-payloads",
      content: "export const generated = `" + "x".repeat(900) + "`;",
      tokens: 230,
      metadata: {
        filePath: "src/generated.ts",
        fieldPath: "input.content"
      }
    },
    {
      id: "r1",
      turn: 4,
      timestamp: "2026-01-01T00:00:03.000Z",
      source: "transcript",
      role: "tool",
      toolName: "Bash",
      category: "tool-result",
      content: "line\n".repeat(250),
      tokens: 250,
      metadata: {
        exitCode: 0
      }
    },
    {
      id: "r2",
      turn: 5,
      timestamp: "2026-01-01T00:00:04.000Z",
      source: "transcript",
      role: "tool",
      toolName: "Bash",
      category: "tool-result",
      content: "short result",
      tokens: 3,
      metadata: {}
    }
  ];
}
