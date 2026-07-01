import { describe, expect, test } from "bun:test";
import { parseJsonlTranscript, normalizeHookPayload } from "../src/parser.ts";

describe("transcript parser", () => {
  test("normalizes transcript JSONL with tool args, file payloads, and tool results", () => {
    const jsonl = [
      JSON.stringify({ role: "system", content: "Always be concise." }),
      JSON.stringify({
        role: "assistant",
        content: [
          { type: "text", text: "I will write the file." },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "Write",
            input: {
              file_path: "src/example.ts",
              content: "export const value = 1;\n"
            }
          }
        ]
      }),
      JSON.stringify({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_1",
            content: "created src/example.ts"
          }
        ]
      })
    ].join("\n");

    const events = parseJsonlTranscript(jsonl);

    expect(events.map((event) => event.category)).toEqual([
      "system",
      "assistant-reasoning",
      "tool-args",
      "file-payloads",
      "tool-result"
    ]);
    expect(events[3]?.toolName).toBe("Write");
    expect(events[3]?.metadata.filePath).toBe("src/example.ts");
    expect(events[4]?.content).toContain("created");
  });

  test("rejects malformed JSONL with line number context", () => {
    expect(() => parseJsonlTranscript("{bad json")).toThrow(
      "Invalid JSON on line 1"
    );
  });

  test("normalizes Claude Code hook payloads from stdin", () => {
    const pre = normalizeHookPayload("PreToolUse", {
      tool_name: "Edit",
      tool_input: {
        file_path: "src/a.ts",
        old_string: "one",
        new_string: "two"
      }
    });

    const post = normalizeHookPayload("PostToolUse", {
      tool_name: "Bash",
      tool_response: {
        stdout: "ok",
        stderr: "",
        interrupted: false
      }
    });

    expect(pre.map((event) => event.category)).toEqual([
      "tool-args",
      "file-payloads"
    ]);
    expect(post).toHaveLength(1);
    expect(post[0]?.category).toBe("tool-result");
  });
});
