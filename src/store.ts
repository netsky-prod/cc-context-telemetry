import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface StoredBlob {
  hash: string;
  pointer: string;
  path: string;
}

export async function storeByHash(
  content: string,
  storeDir: string
): Promise<StoredBlob> {
  const hash = sha256(content);
  const path = join(storeDir, `${hash}.txt`);
  await mkdir(storeDir, { recursive: true });
  await writeFile(path, content, "utf8");
  return {
    hash,
    pointer: `ccct://sha256/${hash}`,
    path
  };
}

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
