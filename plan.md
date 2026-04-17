# plan.md — AI-Powered Medical Research Assistant

End-to-end implementation plan derived from `CLAUDE.md`. The authoritative spec is `CLAUDE.md`; this file is the engineering plan that maps that spec onto the existing TypeScript scaffold and tracks delivery for v1.

> Scope of v1: **backend only**, with Swagger docs and Docker-based deployment. Frontend is out of scope. The pipeline implements the full R3 flow (query expansion → parallel retrieval → hybrid ranking → Ollama LLM reasoning → structured citation-validated JSON → MongoDB session memory).

---

## 1. Architecture mapping (CLAUDE.md → code)

| CLAUDE.md module (§) | TypeScript path | Inputs → Outputs |
|---|---|---|
| Query unification (§3.1) | `backend/src/services/queryProcessor.ts` | `RawInput` → `IntentObject` |
| MeSH normalization (§3.2.1) | `backend/src/services/meshNormalizer.ts` | term → canonical + synonyms |
| OpenAlex (§4.2) | `backend/src/services/retrievers/openAlexRetriever.ts` | query → `Publication[]` |
| PubMed (§4.3) | `backend/src/services/retrievers/pubmedRetriever.ts` | query → `Publication[]` |
| ClinicalTrials.gov (§4.4) | `backend/src/services/retrievers/clinicalTrialsRetriever.ts` | (disease,concept) → `Trial[]` |
| Parallel orchestration (§4.5) | `backend/src/services/retrievalOrchestrator.ts` | `IntentObject` → `RetrievalBundle` |
| Embedding (§5.2.2) | `backend/src/services/embedder.ts` | string → `number[]` (cached) |
| Hybrid ranking (§5) | `backend/src/services/rankingEngine.ts` | bundle + intent → `RankedDoc[]` |
| TTL cache (§7.3, §10.2) | `backend/src/services/cacheService.ts` | hash ↔ payload |
| Prompt + LLM (§6) | `backend/src/services/llmService.ts` | (intent, top-K, trials) → `LLMResponse` |
| Conversation memory (§7) | `backend/src/services/contextManager.ts` | (intent, sessionId) ↔ Mongo |
| Personalization (§8) | `backend/src/services/personalizationEngine.ts` | userId → directives |
| Pipeline glue | `backend/src/services/pipeline.ts` | composes all of the above |

**Deferred to v2** with `// DEFERRED(v2)` markers in code: cross-encoder Python reranker (§5.4), SSE streaming (§11.3), Atlas Vector Search (§2.3), BullMQ queueing.

---

## 2. Build order (file by file)

### Phase 1 — Types + models
1. `backend/src/types/domain.ts` — domain types (`IntentObject`, `Publication`, `Trial`, `RankedDoc`, `LLMResponse`, `RankingSignals`, `RetrievalBundle`).
2. `backend/src/models/Conversation.ts` — sessions + turns (CLAUDE.md §7.1).
3. `backend/src/models/ResearchCache.ts` — TTL-indexed cache.
4. `backend/src/models/UserProfile.ts` — personalization profile.
5. `backend/src/models/EmbeddingCache.ts` — sha256-keyed vector cache.

### Phase 2 — Config + utilities
6. `backend/src/config/env.ts` — extend with Ollama/NCBI/cache/ranking vars.
7. `backend/src/config/rankingWeights.ts` — `{ bm25 .25, semantic .40, recency .20, credibility .15 }`.
8. `backend/src/config/constants.ts` — credibility map, query-type enrichment, retrieval ceilings.
9. `backend/src/utils/hash.ts` — `sha256`, `computeQueryHash`.
10. `backend/src/utils/logger.ts` — `info/warn/error`, `timeit`.
11. `backend/.env.example` — append all new keys.

### Phase 3 — Services (dependency order)
12. `backend/src/services/meshNormalizer.ts`
13. `backend/src/services/queryProcessor.ts`
14. `backend/src/services/retrievers/openAlexRetriever.ts`
15. `backend/src/services/retrievers/pubmedRetriever.ts`
16. `backend/src/services/retrievers/clinicalTrialsRetriever.ts`
17. `backend/src/services/cacheService.ts`
18. `backend/src/services/retrievalOrchestrator.ts`
19. `backend/src/services/embedder.ts`
20. `backend/src/services/rankingEngine.ts`
21. `backend/src/services/llmService.ts` (+ `prompts/medicalResearch.ts`)
22. `backend/src/services/contextManager.ts`
23. `backend/src/services/personalizationEngine.ts`
24. `backend/src/services/pipeline.ts`

### Phase 4 — HTTP layer
25. `backend/src/schemas/research.schema.ts` — zod request + response schemas.
26. `backend/src/middleware/optionalAuth.ts` — non-blocking JWT decode.
27. `backend/src/middleware/rateLimiter.ts` — `express-rate-limit`.
28. `backend/src/controllers/researchController.ts` — research/followup/session.
29. `backend/src/controllers/healthController.ts` — Mongo + Ollama probes.
30. `backend/src/routes/researchRoutes.ts`
31. `backend/src/routes/index.ts` — wire the new routes.

### Phase 5 — Swagger
32. `backend/src/docs/openapi.ts` — typed OpenAPI 3.1 document.
33. `backend/src/docs/swagger.ts` — `swagger-ui-express` mount.
34. `backend/src/index.ts` — mount `/api-docs` + `/api-docs.json` before 404.

### Phase 6 — Seed data
35. `backend/data/mesh_terms.json`
36. `backend/data/synonyms.json`
37. `backend/data/journal_tiers.json`
38. `backend/src/scripts/pingPipeline.ts` — CLI smoke test.

### Phase 7 — Deployment
39. `backend/Dockerfile` (multi-stage).
40. `backend/.dockerignore`.
41. `docker-compose.yml` (root) — mongo + ollama + ollama-init + backend.

### Phase 8 — `.claude/`
42. `.claude/settings.json`
43. `.claude/agents/medical-researcher.md`
44. `.claude/agents/retrieval-debugger.md`
45. `.claude/agents/prompt-engineer.md`
46. `.claude/agents/schema-guardian.md`
47. `.claude/skills/run-pipeline/SKILL.md`
48. `.claude/skills/seed-data/SKILL.md`
49. `.claude/skills/pull-ollama-models/SKILL.md`
50. `.claude/references/api-contract.md`
51. `.claude/references/ranking-tuning.md`
52. `.claude/references/mesh-normalization.md`
53. `.claude/references/ollama-ops.md`

---

## 3. External integrations

| API | Endpoint | Env | Rate limit | Notes |
|---|---|---|---|---|
| OpenAlex | `https://api.openalex.org/works` | `OPENALEX_MAILTO` | ~100k/day polite pool | Pages of 100, ceiling 200. |
| PubMed | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/{esearch,efetch}.fcgi` | `NCBI_API_KEY` | 10/s with key, 3/s without | Two-step esearch + efetch with `usehistory=y`; backoff on 429. |
| ClinicalTrials.gov | `https://clinicaltrials.gov/api/v2/studies` | — | None | Single page @ 100. |
| Ollama generation | `${OLLAMA_URL}/api/generate` | `OLLAMA_URL`, `OLLAMA_MODEL` | local | `format: "json"`, `num_ctx: 8192`, `temperature: 0.1`. |
| Ollama embeddings | `${OLLAMA_URL}/api/embeddings` | `OLLAMA_EMBED_MODEL` | local | `nomic-embed-text` (768-dim). |

All retrievers wrap errors as `RetrievalError(source, status, message)` and the orchestrator uses `Promise.allSettled` so a single API failure never aborts the response (CLAUDE.md §15 Requirement 9).

---

## 4. Ranking pipeline decisions

- **BM25:** `wink-bm25-text-search` (field weights title=3, abstract=1).
- **Embedding store v1:** Mongo `number[]` on `EmbeddingCache`, in-process cosine. Upgrade path: Atlas Vector Search at >10k docs.
- **Dedup precedence:** `doi → pmid → nctId → lowercase(title).slice(0,60)`.
- **Normalization:** min-max for BM25 + semantic; recency + credibility already in [0,1].
- **Top-K:** `RANKING_TOPK=20` default; `mode=brief` → 15, `mode=deep` → 30.
- **Re-ranker:** deferred. `mode=high_quality` accepted but falls back with `metadata.warnings: ['reranker_disabled']`.

---

## 5. LLM strategy

- **Primary model:** `llama3.1:8b-instruct-q4_K_M` (pullable today, ~6 GB VRAM, supports `format: "json"` + 8k context). Fallbacks: `mistral:7b-instruct` → `llama3:8b-instruct`.
- **BioMistral:** documented in `.claude/references/ollama-ops.md` as the optional upgrade — requires GGUF download + `Modelfile` + `ollama create biomed:7b`.
- **Prompt template:** `backend/src/services/prompts/medicalResearch.ts`. Sections: System (invariant anti-hallucination rules) → Retrieved Context (`[Source N]`/`[Trial N]`) → Conversation History (last 4 turns) → Personalization (optional) → Current Question + JSON schema footer.
- **Citation validator:** drops `sourceRefs` not in retrieved IDs, sets `citationWarning` for orphan claims (does NOT delete them — CLAUDE.md §6.3 graceful degradation), drops trial entries with unknown NCT IDs, attaches `metadata.warnings` instead of failing.
- **Ollama unreachable:** controller returns HTTP 503 with a schema-conforming body (`metadata.warnings: ['ollama_unreachable']`) — frontend never crashes.

---

## 6. API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/research` | optional JWT | Run R3 pipeline (new or continuing session). |
| POST | `/api/v1/followup` | optional JWT | Same pipeline; `sessionId` required. |
| GET  | `/api/v1/session/:id` | optional | Retrieve session turns. |
| DELETE | `/api/v1/session/:id` | optional | Wipe a session. |
| GET  | `/api/v1/health` | none | Mongo + Ollama probes; powers Docker healthcheck. |
| GET  | `/api-docs` | none | Swagger UI. |
| GET  | `/api-docs.json` | none | OpenAPI 3.1 JSON. |
| `/api/v1/auth/*` | — | — | Existing scaffold; untouched. |

**Request example:**
```json
{ "disease": "Parkinson's disease", "query": "Deep Brain Stimulation", "queryType": "treatment", "sessionId": "sess_abc123" }
```

**Response:** strict `researchResponseSchema` mirroring CLAUDE.md §9.

---

## 7. Deployment

### `backend/Dockerfile`
Multi-stage `node:22-alpine`:
1. **builder** — `npm ci`, `npm run build`, then `npm prune --omit=dev`.
2. **runtime** — non-root `node` user, `dist/` + pruned `node_modules` + `data/`. `HEALTHCHECK` hits `/api/v1/health`.

### Root `docker-compose.yml`
Services: `mongodb` (with volume + healthcheck), `ollama` (with volume), `ollama-init` (one-shot model puller — `llama3.1` + `nomic-embed-text`), `backend` (depends_on healthy mongo + started ollama). Optional `mongo-express` under `dev` profile.

### Hosting recommendations
- **Backend:** Railway / Render via Docker.
- **MongoDB:** Atlas M0/M10.
- **Ollama:** GPU VPS (RunPod RTX 4090 on-demand, Hetzner GPU). Set `OLLAMA_URL` on backend env to the VPS URL.
- **Frontend (later):** Vercel.

### Local quickstart
```bash
docker compose up -d
docker compose exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
docker compose exec ollama ollama pull nomic-embed-text
curl http://localhost:5000/api/v1/health
open http://localhost:5000/api-docs
```

---

## 8. `.claude/` folder

Per Claude Code docs, agent files use frontmatter `name`, `description`, optional `tools` (omit = inherit all), optional `model`. Skills use `name`, `description`.

**Subagents (4):**
- `medical-researcher` — R3 pipeline architect; use proactively when editing `backend/src/services/`.
- `retrieval-debugger` — diagnoses empty/low-relevance corpora across the three external APIs.
- `prompt-engineer` — owns `prompts/medicalResearch.ts`, the JSON schema footer, and citation validation.
- `schema-guardian` — keeps zod schemas, OpenAPI doc, and CLAUDE.md §9 in sync.

**Skills (3):**
- `run-pipeline` — runs `pingPipeline.ts` end-to-end (Mongo + Ollama assumed running).
- `seed-data` — extends MeSH/synonyms/journal-tier seed JSON.
- `pull-ollama-models` — pulls or builds required Ollama models (incl. optional BioMistral GGUF).

**References (4):**
- `api-contract.md` — endpoints + curl examples + §9 schema.
- `ranking-tuning.md` — weight tables + when to tune.
- `mesh-normalization.md` — JSON shapes + how to extend.
- `ollama-ops.md` — model commands, JSON-mode caveats, BioMistral Modelfile template.

**`settings.json`:** project-scoped permissions for read/write/edit, npm/docker/curl/ollama bash commands, deny destructive ops. Optional soft post-edit `tsc --noEmit` hook (toggleable).

---

## 9. Risks, tradeoffs, open questions

- **No spaCy NER sidecar** — free-text queries rely on MeSH keyword matching. Session inheritance carries follow-ups; first-turn ambiguous queries will return a clarifying response rather than crash.
- **Ollama JSON mode** — keep regex-strip fallback in `parseAndValidateLLMOutput` for older model tags.
- **Cold-cache embedding latency** — first retrieval for a new disease embeds ~300 docs sequentially (~60–90s). Mitigation: warm via `pingPipeline.ts` at deploy.
- **Process-local PubMed token bucket** — won't survive a PM2 cluster; needs Redis backend at scale (`TODO(scale)` flagged in code).
- **Auth policy** — `/research` is anonymous-friendly with optional JWT. Switch `optionalAuth` → `authenticate` if strict auth is later required.
- **Session ID generation** — server-generated as `sess_<uuid>` if absent; returned in body and `X-Session-Id` header.
- **Scaffold/spec mismatch** — CLAUDE.md examples are JS, scaffold is TS+ESM (NodeNext). All new code is TS; imports use `.js` specifiers (matches existing scaffold).

---

## 10. Definition of done (v1)

- [ ] `npm run dev` boots the backend; `/api/v1/health` returns `{ mongo: 'up', ollama: 'up'|'down' }`.
- [ ] Swagger UI reachable at `/api-docs` with all 7 endpoints.
- [ ] `POST /api/v1/research` returns a §9-conforming JSON body for a real query (`"Latest treatments for Parkinson's"`).
- [ ] Citation validator drops orphan `sourceRefs` and never lets the response shape break.
- [ ] `Promise.allSettled` proven via integration test (one retriever forced to throw).
- [ ] `docker compose up` brings up mongo + ollama + backend; healthcheck green; pulled models persist in volume.
- [ ] `.claude/` folder boots Claude Code with custom agents + skills loaded.
- [ ] `tsc --noEmit` clean; no `any` in service signatures.
