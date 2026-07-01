# cc-context-telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public Bun and TypeScript CLI/library that measures Claude Code context token categories and selectively compacts measured bottlenecks.

**Architecture:** Normalize hook and transcript inputs into `NormalizedEvent` records, account tokens by category, produce a `BottleneckReport`, and run a dry-run-first targeted compactor. The compactor extracts Write/Edit payloads into a hash store and summarizes old verbose tool results while keeping recent raw results.

**Tech Stack:** Bun, TypeScript, `bun:test`, GitHub Actions.

---

### Task 1: Project Scaffold And Tests

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tests/*.test.ts`

- [x] Write failing tests for transcript parsing, hook normalization, token accounting, bottleneck reporting, compaction, and CLI JSON output.
- [x] Run `bun test` and confirm tests fail because implementation modules do not exist.

### Task 2: Core Implementation

**Files:**
- Create: `src/types.ts`
- Create: `src/parser.ts`
- Create: `src/accountant.ts`
- Create: `src/report.ts`
- Create: `src/compactor.ts`
- Create: `src/store.ts`
- Create: `src/cli.ts`

- [x] Implement normalized event types and strict validation helpers.
- [x] Implement JSONL and hook normalization.
- [x] Implement token accounting, category shares, growth curve, and burn-rate.
- [x] Implement bottleneck report with top payloads and recommendations.
- [x] Implement dry-run and applied compaction.
- [x] Implement CLI commands for `analyze`, `compact`, and `hook`.
- [x] Run `bun test` and `bun run typecheck`.

### Task 3: Public Project Materials

**Files:**
- Create: `README.md`
- Create: `ARCHITECTURE.md`
- Create: `examples/sample-transcript.jsonl`
- Create: `.github/workflows/ci.yml`
- Create: `LICENSE`

- [x] Document quickstart, hooks, architecture diagram, data story, categories, and compaction policy.
- [x] Add runnable examples.
- [x] Add CI and license.
- [x] Add generic-content scan.

### Task 4: Final Verification And Commit

**Files:**
- Modify: repository metadata

- [x] Run `bun run check`.
- [x] Scan repository for disallowed project-specific names or sensitive placeholders.
- [ ] Initialize Git repository.
- [ ] Commit with author `netsky-prod`.
- [ ] Report summary and test results on the agent bus.
