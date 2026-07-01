import type { CompactorOptions } from "./types.ts";

export const DEFAULT_COMPACTOR_OPTIONS: CompactorOptions = {
  dryRun: true,
  storeDir: ".cc-context-telemetry/store",
  toolResultTokenThreshold: 400,
  filePayloadTokenThreshold: 400,
  keepLastN: 3,
  summaryMaxTokens: 80
};
