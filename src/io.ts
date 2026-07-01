import { readFile } from "node:fs/promises";
import type { NormalizedEvent } from "./types.ts";
import { parseJsonlTranscript } from "./parser.ts";

export async function readTranscript(path: string): Promise<NormalizedEvent[]> {
  const input = await readFile(path, "utf8");
  return parseJsonlTranscript(input);
}
