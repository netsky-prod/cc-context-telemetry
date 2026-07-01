#!/usr/bin/env bun
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { TargetedCompactor } from "./compactor.ts";
import { DEFAULT_COMPACTOR_OPTIONS } from "./config.ts";
import { readTranscript } from "./io.ts";
import { normalizeHookPayload } from "./parser.ts";
import { buildBottleneckReport } from "./report.ts";
import type { CompactorOptions } from "./types.ts";

interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  try {
    if (args.command === "analyze") {
      const path = requiredPositional(args, 0, "transcript path");
      const topN = readNumberFlag(args, "top", 10);
      const events = await readTranscript(path);
      printJson(buildBottleneckReport(events, { topN }));
      return 0;
    }

    if (args.command === "compact") {
      const path = requiredPositional(args, 0, "transcript path");
      const events = await readTranscript(path);
      const options = compactorOptionsFromArgs(args);
      const result = await new TargetedCompactor(options).compact(events);
      if (!options.dryRun && typeof args.flags.out === "string") {
        await writeFile(
          args.flags.out,
          `${result.events.map((event) => JSON.stringify(event)).join("\n")}\n`
        );
      }
      printJson(result);
      return 0;
    }

    if (args.command === "hook") {
      const kind = requiredPositional(args, 0, "hook kind");
      if (kind !== "pre" && kind !== "post") {
        throw new Error("hook kind must be pre or post");
      }
      const appendPath =
        typeof args.flags.append === "string"
          ? args.flags.append
          : ".cc-context-telemetry/session.jsonl";
      const stdin = await readFile("/dev/stdin", "utf8");
      const payload = stdin.trim().length === 0 ? {} : JSON.parse(stdin);
      const events = normalizeHookPayload(kind === "pre" ? "PreToolUse" : "PostToolUse", payload);
      await mkdir(dirname(appendPath), { recursive: true });
      await appendFile(
        appendPath,
        `${events.map((event) => JSON.stringify(event)).join("\n")}\n`
      );
      printJson({ appended: events.length, path: appendPath });
      return 0;
    }

    if (args.command === "help" || args.command === undefined) {
      process.stdout.write(helpText());
      return 0;
    }

    throw new Error(`Unknown command: ${args.command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === undefined) {
      continue;
    }
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = rest[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        index += 1;
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function compactorOptionsFromArgs(args: ParsedArgs): CompactorOptions {
  return {
    ...DEFAULT_COMPACTOR_OPTIONS,
    dryRun: args.flags["dry-run"] !== false && args.flags.apply !== true,
    storeDir:
      typeof args.flags.store === "string"
        ? args.flags.store
        : DEFAULT_COMPACTOR_OPTIONS.storeDir,
    toolResultTokenThreshold: readNumberFlag(
      args,
      "tool-result-threshold",
      DEFAULT_COMPACTOR_OPTIONS.toolResultTokenThreshold
    ),
    filePayloadTokenThreshold: readNumberFlag(
      args,
      "file-payload-threshold",
      DEFAULT_COMPACTOR_OPTIONS.filePayloadTokenThreshold
    ),
    keepLastN: readNumberFlag(args, "keep-last", DEFAULT_COMPACTOR_OPTIONS.keepLastN),
    summaryMaxTokens: readNumberFlag(
      args,
      "summary-tokens",
      DEFAULT_COMPACTOR_OPTIONS.summaryMaxTokens ?? 80
    )
  };
}

function readNumberFlag(
  args: ParsedArgs,
  name: string,
  fallback: number
): number {
  const value = args.flags[name];
  if (value === undefined || value === false) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${name} must be a number`);
  }
  return parsed;
}

function requiredPositional(
  args: ParsedArgs,
  index: number,
  label: string
): string {
  const value = args.positional[index];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function helpText(): string {
  return `cc-context-telemetry

Usage:
  cc-context-telemetry analyze <transcript.jsonl> [--top 10]
  cc-context-telemetry compact <transcript.jsonl> [--dry-run] [--apply --out compacted.jsonl]
  cc-context-telemetry hook pre|post [--append .cc-context-telemetry/session.jsonl]

Commands:
  analyze   Produce a BottleneckReport with category shares, top payloads, growth, and burn-rate.
  compact   Apply or dry-run targeted compaction for verbose tool results and file payloads.
  hook      Normalize Claude Code PreToolUse/PostToolUse JSON from stdin and append JSONL events.
`;
}

if (import.meta.main) {
  process.exit(await main(Bun.argv.slice(2)));
}
