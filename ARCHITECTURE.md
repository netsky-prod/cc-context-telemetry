# Architecture

`cc-context-telemetry` is a local CLI and TypeScript library. It has no daemon and no network dependency at runtime.

## Design Goals

- Fast hook cold-start with Bun.
- Deterministic JSON input and output for automation.
- Conservative token estimation with support for provided token counts.
- Category-first reporting so compaction follows measured bottlenecks.
- Safe dry-run compaction for A/B comparisons.

## Data Model

Every input path becomes a list of `NormalizedEvent` records:

```ts
interface NormalizedEvent {
  id: string;
  turn: number;
  timestamp: string;
  source: "transcript" | "hook" | "synthetic";
  role: "system" | "user" | "assistant" | "tool";
  category:
    | "system"
    | "user"
    | "assistant-reasoning"
    | "tool-args"
    | "tool-result"
    | "file-payloads"
    | "mcp-output";
  content: string;
  tokens?: number;
  toolName?: string;
  metadata: Record<string, unknown>;
}
```

The parser splits Write/Edit/MultiEdit payloads out of tool arguments so file content is measured separately from ordinary tool parameters.

## Processing Flow

1. `parser.ts` reads transcript JSONL or hook JSON and emits `NormalizedEvent[]`.
2. `TokenAccountant` assigns token counts, aggregates category totals, and builds the context growth curve.
3. `buildBottleneckReport` ranks individual payloads and selects the largest compactable category.
4. `TargetedCompactor` estimates or applies compaction according to thresholds and keep-last policy.
5. Applied file-payload compaction stores full content in a local hash store and leaves a pointer plus summary in context.

## Validation Strategy

Input validation is intentionally strict at module boundaries:

- JSONL parse failures include line numbers.
- Hook kind must be `PreToolUse` or `PostToolUse`.
- Role values must be one of the supported transcript roles.
- Compactor thresholds and store paths are validated before work starts.

The parser is permissive about transcript shape because real agent traces vary. Unknown content blocks are preserved as JSON text instead of being discarded.

## Safety Properties

- `compact --dry-run` never mutates returned event content and never writes store files.
- Applied compaction writes extracted payloads under a content-addressed `sha256` filename.
- Recent raw tool results are retained with `--keep-last`.
- Compaction decisions are reported as `ChangedEvent` records with original tokens, compacted tokens, estimated savings, and reason.

## Extension Points

- Replace `ApproximateTokenEstimator` with a model-specific tokenizer while keeping the `TokenEstimator` interface.
- Add parsers for additional transcript formats that emit `NormalizedEvent[]`.
- Add policy modules that use `BottleneckReport.primaryBottleneck` to choose thresholds automatically.
- Add benchmark runners that compare dry-run or applied compaction against task success metrics.
