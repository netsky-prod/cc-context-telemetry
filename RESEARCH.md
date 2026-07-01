# Research Basis — `cc-context-telemetry`

`cc-context-telemetry` is a **measurement-first** context-engineering tool for agentic harnesses (Claude Code): it classifies where context tokens actually go (reasoning / tool-args / tool-result / file-payloads), reports the real bottleneck, and compacts **that** bottleneck specifically — rather than blanket-summarizing everything. It is generic harness tooling; it uses no proprietary data.

## The idea and the findings behind it

**1. Selective retention + compact summarization beats full history (motivates targeted compaction).**
- *Less Context, Better Agents: Efficient Context Engineering for Long-Horizon Tool-Using LLM Agents*, [arXiv:2606.10209](https://arxiv.org/abs/2606.10209). On a 50-task long-horizon tool benchmark, "prune to recent tool interactions + compact summarization" reached **91.6%** task completion vs **71.0%** for full history, using **~63% fewer tokens** (validated across GPT-5 and Claude Sonnet 4.5). Takeaway: verbose tool outputs are the dominant, compressible cost — which is exactly what a telemetry pass should localize before compacting.

**2. Context as an optimization problem, with adaptive length (motivates measurement-first).**
- *Meta Context Engineering via Agentic Skill Evolution*, [arXiv:2601.21557](https://arxiv.org/abs/2601.21557). Treats context assembly as something to optimize rather than hand-craft, flexibly adapting context length per task. Motivates instrumenting and measuring context composition instead of applying a fixed compaction rule everywhere.

**3. Pointer + diff instead of in-context payloads (motivates the compaction strategy for Write/Edit).**
- *Memex(RL): Scaling Long-Horizon LLM Agents via Indexed Experience Memory*, [arXiv:2603.04257](https://arxiv.org/abs/2603.04257) (Wang et al.; ref. impl. github.com/Accenture/MemexRL). Keeps compact summaries + **stable indices** in the working context while storing full-fidelity interactions in an external store, dereferenced on demand. Reported **3.5× task success at −43% context usage**. This is the model for our large-payload handling: keep a **hash-pointer + diff/summary** in context, store the full Write/Edit payload out-of-context, rehydrate only if needed.

## How the tool maps to these

| Component | Backed by | What it does |
|---|---|---|
| **TokenAccountant** | measurement-first (2601.21557) | tokenize + classify every segment (system / user / reasoning / tool-args / tool-result / file-payloads / MCP), track share and growth (burn-rate) |
| **BottleneckReport** | measurement-first | per-category shares, top-N largest single payloads, context growth curve |
| **TargetedCompactor** | 2606.10209 (prune+summarize) + 2603.04257 (index/pointer) | compact the *localized* bottleneck: summarize old/large tool-results; replace Write/Edit payloads with hash-pointer + diff; keep-last-N raw |
| **dry-run** | — | estimate savings without applying, for A/B |

## Honest scope

- **What we MEASURE / SHOW (our own results, on open traces):** the token breakdown by category ("where tokens actually go in agentic coding") on public agent-coding traces (e.g., SWE-bench / TerminalBench / Aider / OpenHands runs), and a savings-vs-task-success comparison of *targeted* compaction against blanket summarization. Any numbers we publish will be labeled as our own measurements on the stated traces.
- **What we CITE (not reproduced here):** the **91.6% / −63%** figures from arXiv:2606.10209 and the **3.5× / −43%** figures from arXiv:2603.04257 are cited from those papers; they are motivation, not our results.
- **What is engineering, not a claim:** the classification taxonomy and pointer+diff compaction are implementation choices inspired by the above; the tool is not benchmarked against those papers as baselines.
- No proprietary data, repositories, or business logic are used or published.

## References
- *Less Context, Better Agents…*, [arXiv:2606.10209](https://arxiv.org/abs/2606.10209).
- *Meta Context Engineering via Agentic Skill Evolution*, [arXiv:2601.21557](https://arxiv.org/abs/2601.21557).
- *Memex(RL): Scaling Long-Horizon LLM Agents via Indexed Experience Memory*, Wang et al., [arXiv:2603.04257](https://arxiv.org/abs/2603.04257).
