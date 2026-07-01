import { TokenAccountant } from "./accountant.ts";
import { preview } from "./tokenizer.ts";
import type {
  BottleneckReport,
  CategoryTotal,
  NormalizedEvent,
  ReportOptions,
  SegmentCategory,
  TopPayload
} from "./types.ts";

const COMPACTABLE: SegmentCategory[] = [
  "tool-result",
  "file-payloads",
  "mcp-output",
  "tool-args"
];

export function buildBottleneckReport(
  events: NormalizedEvent[],
  options: ReportOptions = {}
): BottleneckReport {
  const topN = options.topN ?? 10;
  const account = new TokenAccountant().analyze(events);
  const topPayloads: TopPayload[] = [...account.events]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, topN)
    .map((event) => {
      const payload: TopPayload = {
        id: event.id,
        turn: event.turn,
        category: event.category,
        tokens: event.tokens,
        share: account.totalTokens === 0 ? 0 : event.tokens / account.totalTokens,
        preview: preview(event.content),
        metadata: event.metadata
      };
      if (event.toolName !== undefined) {
        payload.toolName = event.toolName;
      }
      return payload;
    });

  const primaryBottleneck = selectPrimaryBottleneck(account.categoryTotals);

  return {
    ...account,
    topPayloads,
    primaryBottleneck,
    recommendations: recommendations(primaryBottleneck.category)
  };
}

function selectPrimaryBottleneck(
  totals: Partial<Record<SegmentCategory, CategoryTotal>>
): CategoryTotal {
  const candidates = Object.values(totals)
    .filter((total): total is CategoryTotal => total !== undefined)
    .sort((a, b) => b.tokens - a.tokens);

  return (
    candidates.find((candidate) => COMPACTABLE.includes(candidate.category)) ??
    candidates[0] ?? {
      category: "user",
      tokens: 0,
      share: 0,
      events: 0
    }
  );
}

function recommendations(category: SegmentCategory): string[] {
  if (category === "file-payloads") {
    return [
      "Compact file-payloads first: replace older Write/Edit content with sha256 pointers plus a short diff summary.",
      "Keep recent raw file payloads only when they are still active in the task."
    ];
  }
  if (category === "tool-result" || category === "mcp-output") {
    return [
      `Compact ${category} first: keep the last raw results and summarize older verbose outputs above the token threshold.`,
      "Prefer command-specific filters before blanket conversation summarization."
    ];
  }
  if (category === "tool-args") {
    return [
      "Inspect large tool arguments for embedded file content or generated data.",
      "Move repeated payloads into a content-addressed store and keep stable pointers in context."
    ];
  }
  return [
    "No compactable bottleneck dominates the trace. Use the report as a baseline before changing policy."
  ];
}
