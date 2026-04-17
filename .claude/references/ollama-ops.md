# Ollama Ops

Operational notes for the local LLM runtime. Pair with the `pull-ollama-models` skill.

## Endpoints we use

- `POST {OLLAMA_URL}/api/generate` — JSON-mode reasoning (`format: "json"`).
- `POST {OLLAMA_URL}/api/embeddings` — 768-dim semantic embeddings.
- `GET  {OLLAMA_URL}/api/tags` — health probe.

## Default model choice (v1)

| Var | Default | Notes |
|---|---|---|
| `OLLAMA_MODEL` | `llama3.1:8b-instruct-q4_K_M` | ~6 GB VRAM, supports `format: "json"`, 8k context. |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | 768-dim, fast on CPU. |

Fallback ladder if the default isn't pullable on this host: `mistral:7b-instruct` → `llama3:8b-instruct`. Set via `OLLAMA_MODEL`.

## VRAM / RAM budgets

| Model | Quant | GPU VRAM | CPU RAM |
|---|---|---|---|
| llama3.1:8b-instruct | Q4_K_M | ~6 GB | ~10 GB |
| mistral:7b-instruct | Q4_K_M | ~5 GB | ~9 GB |
| BioMistral-7B (custom) | Q4_K_M | ~5 GB | ~9 GB |
| nomic-embed-text | f16 | ~0.5 GB | ~1 GB |

## JSON-mode caveats

- `format: "json"` was added in Ollama 0.1.30+. Older releases produce unstructured text → `metadata.warnings: ['llm_invalid_json']`.
- Some models fight JSON mode and produce a single token of preamble. The parser already handles this (`tryParseJson` extracts the outer `{...}`), but if you see frequent `llm_invalid_json` warnings, upgrade Ollama or switch to a more JSON-friendly tag.

## BioMistral build (optional, per CLAUDE.md §6.1)

```bash
curl -L -o BioMistral-7B-DARE.Q4_K_M.gguf \
  https://huggingface.co/MaziyarPanahi/BioMistral-7B-GGUF/resolve/main/BioMistral-7B.Q4_K_M.gguf

cat > Modelfile <<'EOF'
FROM ./BioMistral-7B-DARE.Q4_K_M.gguf
SYSTEM "You are a biomedical research assistant. Synthesize peer-reviewed evidence only."
PARAMETER temperature 0.1
PARAMETER num_ctx 8192
EOF

ollama create biomed:7b -f Modelfile
# Then set OLLAMA_MODEL=biomed:7b
```

## Cold start budget

- Embedding cache is empty on a fresh deployment. First retrieval for a new disease embeds ~300 docs sequentially → ~60–90 s for `nomic-embed-text` on CPU, ~10–15 s on a modern GPU.
- Mitigation: warm common diseases at deploy time:
  ```bash
  for q in "Parkinson DBS" "lung cancer immunotherapy" "type 2 diabetes GLP-1"; do
    cd backend && npm run pipe -- "$q"
  done
  ```

## Troubleshooting

- **`ollama: down` in `/health`** — check `docker compose ps ollama`; restart if necessary.
- **`pull manifest unknown`** — model tag was renamed upstream. Pick a current alternative.
- **Out of memory** — drop quantization (`q4_0` instead of `q4_K_M`) or use the 3B variant.
- **High latency (>10 s/request)** — check `metadata.embeddingCoverage`; if low, embedding calls are timing out. Either increase `EMBED_TIMEOUT_MS` or move Ollama to a GPU.
- **CORS errors hitting `/api/generate` directly** — Ollama doesn't ship CORS by default. Always proxy through the backend.

## Production hosting

- **CPU-only VPS** works for demo / low traffic but expect 10–30 s/request.
- **GPU VPS** (RunPod RTX 4090, Hetzner GPU, Vast.ai) recommended for >5 req/min.
- Set `OLLAMA_URL` on the backend container to the GPU host's URL — backend and Ollama don't have to live together.
