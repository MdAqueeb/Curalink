# MeSH normalization

The pipeline relies on three pieces of curated data to canonicalize medical terminology before retrieval. Stay close to the MeSH preferred form (https://www.nlm.nih.gov/mesh/meshhome.html) — PubMed indexes against it.

## Files

### `backend/data/mesh_terms.json`

```jsonc
{
  "acronyms": {
    "pd": "Parkinson's disease",       // lowercase keys → canonical expansion
    "dbs": "Deep Brain Stimulation"
  },
  "preferred": {
    "parkinson disease": "Parkinson's disease",   // common variants → canonical
    "lung cancer": "Lung Neoplasms"
  },
  "entryTerms": {
    "Parkinson's disease": [             // canonical → MeSH entry terms (used as synonyms)
      "Parkinson disease",
      "paralysis agitans"
    ]
  }
}
```

Keys in `acronyms` and `preferred` are matched **case-insensitively** but stored lowercase. Canonical values are stored as-is and used downstream.

### `backend/data/synonyms.json`

```jsonc
{
  "Parkinson's disease": ["PD", "Lewy body Parkinsonism", ...],
  "Deep Brain Stimulation": ["DBS", "STN-DBS", ...]
}
```

Canonical-name keys, list of synonyms used during query expansion (CLAUDE.md §3.2 step 2). These join the entry terms during query assembly.

### `backend/data/journal_tiers.json`

Lowercase journal name → `Q1` / `Q2` / `Q3`. Unmapped journals fall back to score `0.35`.

## How `services/meshNormalizer.ts` uses them

| Function | Behavior |
|---|---|
| `normalizeTerm(term)` | acronyms → preferred → passthrough. |
| `expandSynonyms(canonical)` | Union of `entryTerms[canonical]` and `synonyms.json[canonical]`. |
| `detectDiseaseInText(text)` | Regex over acronyms (whole-word) → preferred (substring) → canonical names → synonyms; returns the first match. |

## Adding a new term

Use the `seed-data` skill — it has the step-by-step.

## Common pitfalls

- **Plural/singular drift.** PubMed prefers `Lung Neoplasms` (plural). Map `lung cancer` to that, not to `Lung Cancer`.
- **Apostrophes.** Always normalize to `'` (curly, unicode) for canonical names that include it (`Parkinson's disease`, `Alzheimer's disease`). Provide an apostrophe-free variant in `preferred` (`parkinsons disease`) so user input matches.
- **Acronym collisions.** `MS` could be Multiple Sclerosis or Mass Spectrometry. We keep `ms → Multiple Sclerosis` because the medical context dominates; if mass-spec queries become common, drop the acronym entry and require explicit input.
- **Case sensitivity.** Keys are normalized to lowercase before lookup; canonical values are returned as-stored.

## Out of scope (v1)

- spaCy `en_ner_bc5cdr_md` NER sidecar (planned v2).
- Full UMLS metathesaurus integration (license + dataset size are heavy; deferred).
