---
name: seed-data
description: Extends or regenerates the seed JSON files under backend/data/ (mesh_terms.json, synonyms.json, journal_tiers.json). Use when adding support for a new disease, acronym, drug class, or journal that the pipeline currently misses.
---

## When to use

- A user query for "X" returns empty `primaryDisease` because the term isn't in MeSH/synonym tables.
- A reputable journal lands at the fallback credibility tier (0.35) because it isn't in `journal_tiers.json`.
- A new acronym (e.g., "GLP-1") needs to expand canonically.

## Files

| File | Schema | Purpose |
|---|---|---|
| `backend/data/mesh_terms.json` | `{ acronyms, preferred, entryTerms }` | Term normalization + free-text disease detection. |
| `backend/data/synonyms.json` | `{ canonical: string[] }` | Synonym expansion for query assembly. |
| `backend/data/journal_tiers.json` | `{ "lower-cased journal name": "Q1"|"Q2"|"Q3" }` | Credibility scoring. Fallback for unmapped journals = 0.35 (tier 4). |

## Adding a disease

1. Pick a canonical name (prefer the MeSH preferred term, e.g. `"Lung Neoplasms"`).
2. In `mesh_terms.json`:
   - Add common abbreviations under `acronyms` (lowercase keys).
   - Add common variants under `preferred` (lowercase keys → canonical).
   - Add 3–8 entry terms under `entryTerms[canonical]`.
3. In `synonyms.json`: add the canonical name with 3–10 synonyms (clinical phrases that PubMed actually uses — quote them mentally as `[Title/Abstract]` searches).
4. Re-run the smoke test:
   ```bash
   cd backend && npm run pipe -- "<query mentioning the new disease>"
   ```
   Confirm `Condition overview.disease` is the canonical name.

## Adding a journal

- Insert into `journal_tiers.json` with the journal name **lowercased**, mapped to `Q1`, `Q2`, or `Q3`.
- Use Scimago Q-rankings as the source of truth (https://www.scimagojr.com).

## Sources

- MeSH descriptors: https://www.nlm.nih.gov/mesh/meshhome.html (the full JSON is ~50MB; for v1 we curate by hand).
- Scimago Journal Rank: https://www.scimagojr.com.

## What NOT to put in seed JSON

- Anything time-sensitive (drug names that change indication, trial outcomes). Those belong in PubMed/OpenAlex retrieval, not static data.
- Personal opinions about which journals are "good." Use the published Scimago tier.
