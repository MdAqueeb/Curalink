---
name: run-pipeline
description: Runs the full R3 pipeline end-to-end against a natural-language query without going through HTTP. Boots Mongo + Ollama via docker-compose if not running, then invokes the smoke-test CLI. Use when verifying retrieval/ranking/LLM behavior after a code change, or when reproducing a user-reported issue.
---

## When to use

- After a change to anything under `backend/src/services/`.
- To reproduce an issue a user reports without hitting the API surface (cuts out controller + zod noise).
- To validate that a freshly pulled Ollama model works.

## Prerequisites

- Docker installed (`docker compose version` works).
- Backend deps installed (`cd backend && npm ci` once).
- An Ollama model pulled (see `pull-ollama-models` skill).

## Steps

1. **Start dependencies (if not already running):**
   ```bash
   docker compose up -d mongodb ollama
   ```

2. **Verify Ollama is ready:**
   ```bash
   curl -s http://localhost:11434/api/tags | head -c 200
   ```
   If empty, run the `pull-ollama-models` skill first.

3. **Run the pipeline:**
   ```bash
   cd backend
   npm run pipe -- "Latest treatments for Parkinson's disease"
   ```
   The `pipe` script is wired to `tsx src/scripts/pingPipeline.ts`. Args after `--` become the user query.

4. **Read the output.** You'll see:
   - `Condition overview` — the LLM's grounded summary.
   - `Insights:` — count + first 5 with confidence + ref count.
   - `Clinical trials:` count.
   - `Sources:` count.
   - `Metadata` — `latencyMs`, `retrievedCount`, `rankedCount`, `cacheHit`, `warnings[]`.

## Interpreting common warnings

| Warning | Meaning | Fix |
|---|---|---|
| `ollama_unreachable` | Ollama process down or model not pulled. | Start Ollama; run `pull-ollama-models`. |
| `llm_invalid_json` | Model returned non-JSON despite `format: "json"`. | Try a different model or upgrade Ollama. |
| `uncited_insight:ins_NNN` | An insight had no valid `sourceRefs`. | Often fine — model couldn't ground a claim. Repeated → strengthen prompt. |
| `retrieval_error:openalex` etc. | One source failed; pipeline continued. | Inspect that retriever; use `retrieval-debugger` agent. |
| `reranker_disabled` | Caller asked for `mode=high_quality`. | Cross-encoder reranker is deferred to v2. |

## When NOT to use

- Don't use this to validate auth, rate limiting, or HTTP-level concerns. Use `curl` against `/api/v1/research` for that.
