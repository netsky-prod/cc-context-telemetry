export type EventSource = "transcript" | "hook" | "synthetic";

export type SegmentCategory =
  | "system"
  | "user"
  | "assistant-reasoning"
  | "tool-args"
  | "tool-result"
  | "file-payloads"
  | "mcp-output";

export type Role = "system" | "user" | "assistant" | "tool";

export interface NormalizedEvent {
  id: string;
  turn: number;
  timestamp: string;
  source: EventSource;
  role: Role;
  category: SegmentCategory;
  content: string;
  tokens?: number;
  toolName?: string;
  metadata: Record<string, unknown>;
}

export interface CategoryTotal {
  category: SegmentCategory;
  tokens: number;
  share: number;
  events: number;
}

export interface ContextGrowthPoint {
  turn: number;
  cumulativeTokens: number;
}

export interface BurnRate {
  tokensPerTurn: number;
  tokensPerEvent: number;
}

export interface AccountedEvent extends NormalizedEvent {
  tokens: number;
}

export interface TokenAccount {
  totalTokens: number;
  categoryTotals: Partial<Record<SegmentCategory, CategoryTotal>>;
  contextGrowth: ContextGrowthPoint[];
  burnRate: BurnRate;
  events: AccountedEvent[];
}

export interface TopPayload {
  id: string;
  turn: number;
  category: SegmentCategory;
  tokens: number;
  share: number;
  toolName?: string;
  preview: string;
  metadata: Record<string, unknown>;
}

export interface BottleneckReport extends TokenAccount {
  topPayloads: TopPayload[];
  primaryBottleneck: CategoryTotal;
  recommendations: string[];
}

export interface ReportOptions {
  topN?: number;
}

export interface CompactorOptions {
  dryRun: boolean;
  storeDir: string;
  toolResultTokenThreshold: number;
  filePayloadTokenThreshold: number;
  keepLastN: number;
  summaryMaxTokens?: number;
}

export interface ChangedEvent {
  id: string;
  category: SegmentCategory;
  originalTokens: number;
  compactedTokens: number;
  estimatedTokensSaved: number;
  pointer?: string;
  reason: string;
}

export interface CompactionResult {
  dryRun: boolean;
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  estimatedTokensSaved: number;
  changedEvents: ChangedEvent[];
  storeWrites: string[];
  events: NormalizedEvent[];
}
