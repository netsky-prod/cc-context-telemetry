#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const bannedLiterals = [
  "U2hhbm5vbg==",
  "aWNlbw==",
  "a2V5Y2xvYWs=",
  "bWltbw=="
].map((value) => Buffer.from(value, "base64").toString("utf8"));

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const hostPattern = /\b(?:internal|prod|staging|corp|vpn|db|api)[-.][a-z0-9.-]+\b/gi;
const secretPattern = /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/gi;

const ignoredDirs = new Set([".git", "node_modules", ".cc-context-telemetry"]);
const ignoredFiles = new Set(["bun.lock"]);
const findings = [];

for (const path of walk(process.cwd())) {
  const content = readFileSync(path, "utf8");
  for (const literal of bannedLiterals) {
    if (content.toLowerCase().includes(literal.toLowerCase())) {
      findings.push(`${path}: banned literal "${literal}"`);
    }
  }
  for (const pattern of [emailPattern, ipPattern, hostPattern, secretPattern]) {
    for (const match of content.matchAll(pattern)) {
      findings.push(`${path}: suspicious generic-content match "${match[0]}"`);
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry) || ignoredFiles.has(entry)) {
      continue;
    }
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      yield* walk(path);
    } else if (isTextFile(path)) {
      yield path;
    }
  }
}

function isTextFile(path) {
  return /\.(ts|tsx|js|mjs|json|jsonl|md|yml|yaml|txt|gitignore)$/.test(path);
}
