# API Contract

The single source of truth for what the backend serves. Mirrors `CLAUDE.md` §9 and `backend/src/schemas/research.schema.ts`. The OpenAPI doc at `/api-docs.json` is generated from `backend/src/docs/openapi.ts`.

## Base URL

- Local dev: `http://localhost:5000`
- Docker network: `http://backend:5000`

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/research` | optional JWT | Run R3 pipeline. |
| `POST` | `/api/v1/followup` | optional JWT | Continue an existing session (`sessionId` required). |
| `GET`  | `/api/v1/session/:id` | optional | Retrieve session turns. |
| `DELETE` | `/api/v1/session/:id` | optional | Delete a session. |
| `GET`  | `/api/v1/health` | none | Mongo + Ollama probes. |
| `GET`  | `/api-docs` | none | Swagger UI. |
| `GET`  | `/api-docs.json` | none | OpenAPI 3.1. |

## Request

`POST /api/v1/research`
```json
{
  "disease": "Parkinson's disease",
  "query": "Deep Brain Stimulation",
  "userAge": 62,
  "queryType": "treatment",
  "sessionId": "sess_abc123",
  "mode": "standard"
}
```
Either `message` (free text) **or** at least one of `disease`/`query` must be provided.

`POST /api/v1/followup` requires `sessionId`.

## Response (success — wraps the §9 payload in the standard envelope)

```json
{
  "success": true,
  "message": "Research response",
  "data": {
    "sessionId": "sess_abc123",
    "turnIndex": 0,
    "conditionOverview": {
      "disease": "Parkinson's disease",
      "subtypes": ["Idiopathic Parkinsonism"],
      "summary": "...",
      "evidenceLevel": "high"
    },
    "researchInsights": [
      {
        "insightId": "ins_001",
        "claim": "STN-DBS reduces motor fluctuations in advanced PD.",
        "detail": "...",
        "sourceRefs": ["pmid:30280635", "openalex:W2963903345"],
        "confidence": "high",
        "year": 2018
      }
    ],
    "clinicalTrials": [
      {
        "nctId": "NCT04736940",
        "title": "...",
        "status": "Recruiting",
        "phase": "Phase II",
        "url": "https://clinicaltrials.gov/study/NCT04736940"
      }
    ],
    "sources": [
      {
        "refId": "pmid:30280635",
        "title": "...",
        "year": 2018,
        "url": "https://pubmed.ncbi.nlm.nih.gov/30280635/"
      }
    ],
    "disclaimer": "This response is for research and informational purposes only ...",
    "metadata": {
      "retrievedCount": 187,
      "rankedCount": 20,
      "retrievalSources": ["pubmed", "openalex", "clinicaltrials"],
      "modelUsed": "llama3.1:8b-instruct-q4_K_M",
      "latencyMs": 4320,
      "cacheHit": false,
      "warnings": []
    }
  }
}
```

## Status codes

| Code | Meaning |
|---|---|
| 200 | Successful response. |
| 422 | Request failed zod validation. |
| 429 | Rate limit (default 30/min/IP). |
| 502 | LLM produced an output that failed the response zod gate. |
| 503 | Ollama unreachable — body still conforms; `metadata.warnings` includes `ollama_unreachable`. |

## Headers

- `X-Session-Id` returned only when the server generated a new session id.

## Curl quick-tests

```bash
curl -s http://localhost:5000/api/v1/health | jq

curl -s -X POST http://localhost:5000/api/v1/research \
  -H "Content-Type: application/json" \
  -d '{"message":"Latest treatments for Parkinson disease using DBS"}' | jq

curl -s http://localhost:5000/api/v1/session/sess_abc123 | jq
```

## Warning catalog (`metadata.warnings[]`)

| String | Source |
|---|---|
| `ollama_unreachable` | LLM service down or model missing. |
| `llm_invalid_json` | Model returned non-JSON. |
| `no_insights_generated` | Model returned an empty insights array. |
| `uncited_insight:<insightId>` | Insight had zero valid `sourceRefs` after filtering. |
| `retrieval_error:<source>` | One retriever in `Promise.allSettled` rejected. |
| `reranker_disabled` | Caller asked for `mode=high_quality`; cross-encoder reranker is deferred. |
