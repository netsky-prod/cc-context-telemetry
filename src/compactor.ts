import { TokenAccountant } from "./accountant.ts";
import { preview } from "./tokenizer.ts";
import { sha256, storeByHash } from "./store.ts";
import type {
  AccountedEvent,
  ChangedEvent,
  CompactionResult,
  CompactorOptions,
  NormalizedEvent
} from "./types.ts";

export class TargetedCompactor {
  private readonly accountant = new TokenAccountant();
  private readonly options: CompactorOptions;

  constructor(options: CompactorOptions) {
    validateOptions(options);
    this.options = {
      ...options,
      summaryMaxTokens: options.summaryMaxTokens ?? 80
    };
  }

  async compact(events: NormalizedEvent[]): Promise<CompactionResult> {
    const accounted = this.accountant.analyze(events).events;
    const resultEvents = this.options.dryRun ? events : structuredClone(events);
    const toolResultKeepIds = idsToKeepRaw(accounted, this.options.keepLastN);
    const changedEvents: ChangedEvent[] = [];
    const storeWrites: string[] = [];

    for (const event of accounted) {
      if (event.category === "file-payloads") {
        const change = await this.compactFilePayload(event, resultEvents);
        if (change !== undefined) {
          changedEvents.push(change.changed);
          if (change.path !== undefined) {
            storeWrites.push(change.path);
          }
        }
      }

      if (
        (event.category === "tool-result" || event.category === "mcp-output") &&
        !toolResultKeepIds.has(event.id)
      ) {
        const change = this.compactToolResult(event, resultEvents);
        if (change !== undefined) {
          changedEvents.push(change);
        }
      }
    }

    const estimatedTokensBefore = accounted.reduce((sum, event) => sum + event.tokens, 0);
    const estimatedTokensSaved = changedEvents.reduce(
      (sum, event) => sum + event.estimatedTokensSaved,
      0
    );

    return {
      dryRun: this.options.dryRun,
      estimatedTokensBefore,
      estimatedTokensAfter: estimatedTokensBefore - estimatedTokensSaved,
      estimatedTokensSaved,
      changedEvents,
      storeWrites,
      events: resultEvents
    };
  }

  private async compactFilePayload(
    event: AccountedEvent,
    resultEvents: NormalizedEvent[]
  ): Promise<{ changed: ChangedEvent; path?: string } | undefined> {
    if (event.tokens < this.options.filePayloadTokenThreshold) {
      return undefined;
    }

    const hash = sha256(event.content);
    const pointer = `ccct://sha256/${hash}`;
    const summary = filePayloadSummary(event, pointer);
    const compactedTokens = this.accountant.count(summary);
    if (compactedTokens >= event.tokens) {
      return undefined;
    }
    const changed: ChangedEvent = {
      id: event.id,
      category: event.category,
      originalTokens: event.tokens,
      compactedTokens,
      estimatedTokensSaved: Math.max(0, event.tokens - compactedTokens),
      pointer,
      reason: "file payload exceeded threshold"
    };

    if (this.options.dryRun) {
      return { changed };
    }

    const stored = await storeByHash(event.content, this.options.storeDir);
    replaceContent(resultEvents, event.id, summary.replace(pointer, stored.pointer));
    return { changed: { ...changed, pointer: stored.pointer }, path: stored.path };
  }

  private compactToolResult(
    event: AccountedEvent,
    resultEvents: NormalizedEvent[]
  ): ChangedEvent | undefined {
    if (event.tokens < this.options.toolResultTokenThreshold) {
      return undefined;
    }

    const summary = toolResultSummary(event, this.options.summaryMaxTokens ?? 80);
    const compactedTokens = this.accountant.count(summary);
    if (compactedTokens >= event.tokens) {
      return undefined;
    }
    const changed: ChangedEvent = {
      id: event.id,
      category: event.category,
      originalTokens: event.tokens,
      compactedTokens,
      estimatedTokensSaved: Math.max(0, event.tokens - compactedTokens),
      reason: "older verbose tool result exceeded threshold"
    };

    if (!this.options.dryRun) {
      replaceContent(resultEvents, event.id, summary);
    }

    return changed;
  }
}

function validateOptions(options: CompactorOptions): void {
  if (options.keepLastN < 0) {
    throw new Error("keepLastN must be zero or greater");
  }
  if (options.toolResultTokenThreshold < 1) {
    throw new Error("toolResultTokenThreshold must be at least 1");
  }
  if (options.filePayloadTokenThreshold < 1) {
    throw new Error("filePayloadTokenThreshold must be at least 1");
  }
  if (options.storeDir.trim().length === 0) {
    throw new Error("storeDir is required");
  }
}

function idsToKeepRaw(events: AccountedEvent[], keepLastN: number): Set<string> {
  return new Set(
    events
      .filter((event) => event.category === "tool-result" || event.category === "mcp-output")
      .sort((a, b) => b.turn - a.turn)
      .slice(0, keepLastN)
      .map((event) => event.id)
  );
}

function filePayloadSummary(event: AccountedEvent, pointer: string): string {
  const filePath =
    typeof event.metadata.filePath === "string" ? event.metadata.filePath : "unknown";
  return [
    "[compacted file-payload]",
    `pointer: ${pointer}`,
    `file: ${filePath}`,
    `original_tokens: ${event.tokens}`,
    `summary: ${preview(event.content, 220)}`
  ].join("\n");
}

function toolResultSummary(event: AccountedEvent, summaryMaxTokens: number): string {
  const lines = event.content.split(/\r?\n/);
  const head = lines.slice(0, 12).join("\n");
  const tail = lines.length > 18 ? lines.slice(-6).join("\n") : "";
  const body = tail.length > 0 ? `${head}\n...\n${tail}` : head;
  const maxChars = Math.max(80, summaryMaxTokens * 4);
  return [
    "[compacted tool-result]",
    `tool: ${event.toolName ?? "unknown"}`,
    `original_tokens: ${event.tokens}`,
    `summary: ${preview(body, maxChars)}`
  ].join("\n");
}

function replaceContent(events: NormalizedEvent[], id: string, content: string): void {
  const event = events.find((candidate) => candidate.id === id);
  if (event === undefined) {
    return;
  }
  event.content = content;
  delete event.tokens;
  event.metadata = {
    ...event.metadata,
    compacted: true
  };
}
