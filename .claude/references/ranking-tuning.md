# Ranking tuning

Hybrid score formula (per CLAUDE.md §5.3):

```
composite = w.bm25 * bm25Norm
          + w.semantic * semanticNorm
          + w.recency * recencyScore(year, temporalBias)
          + w.credibility * credibilityScore(source, journal)
```

Defaults live in `backend/src/config/rankingWeights.ts`:

| Weight | Default |
|---|---|
| `bm25` | 0.25 |
| `semantic` | 0.40 |
| `recency` | 0.20 |
| `credibility` | 0.15 |

## When to tune

| Symptom | Likely cause | Adjustment |
|---|---|---|
| Off-topic but high-similarity papers float to the top. | Semantic dominates. | Lower `semantic` to 0.30, raise `bm25` to 0.35. |
| Old seminal papers get buried. | Recency too punishing for the query. | Set `temporalBias=seminal` on the request, or lower `recency` to 0.10. |
| Preprints rank above peer-reviewed. | Credibility too small. | Raise `credibility` to 0.20, lower `bm25` to 0.20. |
| Queries with niche terminology return nothing. | BM25 over-weighted; vocabulary mismatch with corpus. | Confirm synonyms.json + lower `bm25` slightly; trust embeddings. |

After tuning, re-run the smoke-test CLI on at least 3 representative queries (Parkinson DBS, lung cancer immunotherapy, COVID long-term effects) and inspect `signals.composite` — sort consistency matters more than absolute values.

## Recency curve

```
ageYears  = currentYear - publicationYear
score     = exp(-0.17 * ageYears)        // half-life ≈ 4 years
seminal   = 1 - score                     // inverted when temporalBias = "seminal"
```

| Age (yrs) | score |
|---|---|
| 0 | 1.00 |
| 4 | 0.51 |
| 8 | 0.26 |
| 12 | 0.13 |

## Credibility composition

```
credibility = 0.5 * SOURCE_CREDIBILITY[source] + 0.5 * journalTier(journal)
```

`SOURCE_CREDIBILITY`: `pubmed: 1.0`, `clinicaltrials: 0.9`, `openalex: 0.85`.
Journal tiers (`data/journal_tiers.json`): `Q1: 1.0`, `Q2: 0.75`, `Q3: 0.50`, fallback: `0.35`.

## Top-K behavior

- `RANKING_TOPK` env (default 20) sets the standard top-K.
- `mode=brief` → 15.
- `mode=deep` → 30.
- `mode=high_quality` → top-K stays standard, but `metadata.warnings: ['reranker_disabled']` is set (cross-encoder reranker per CLAUDE.md §5.4 is deferred to v2).

## Embedding coverage

The ranking engine embeds only the top-60 BM25 candidates to bound latency. If `embeddingCoverage` (logged at debug level) drops below 0.8, suspect Ollama issues, not ranking issues.
