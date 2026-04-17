---
name: pull-ollama-models
description: Pulls or builds the Ollama models the backend relies on (llama3.1 instruct + nomic-embed-text by default; optional BioMistral GGUF via Modelfile). Use on first setup, after wiping the ollama_models volume, or when switching the default model.
---

## When to use

- First-time local setup.
- After `docker compose down -v` (volumes wiped).
- Switching `OLLAMA_MODEL` in `.env` to a tag that isn't pulled yet.
- Health endpoint reports `ollama: down` but the daemon is up.

## Default models (v1)

| Var | Default | Purpose |
|---|---|---|
| `OLLAMA_MODEL` | `llama3.1:8b-instruct-q4_K_M` | Primary reasoning. ~6 GB VRAM, supports `format: "json"`. |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | 768-dim embeddings for semantic ranking. |

## Steps (Docker)

```bash
# Inside the running ollama container
docker compose exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
docker compose exec ollama ollama pull nomic-embed-text
docker compose exec ollama ollama list
```

## Steps (host install)

```bash
ollama pull llama3.1:8b-instruct-q4_K_M
ollama pull nomic-embed-text
ollama list
```

## Verifying

```bash
curl -s http://localhost:11434/api/tags | jq '.models[].name'
curl -s http://localhost:5000/api/v1/health | jq
```
The health endpoint should now show `"ollama": "up"`.

## Optional: BioMistral (per CLAUDE.md §6.1)

BioMistral is pre-trained on PubMed Central and outperforms the default on biomedical NLI. It is NOT on the Ollama registry — you build it from a GGUF.

```bash
# 1. Download GGUF (~4–5 GB)
curl -L -o BioMistral-7B-DARE.Q4_K_M.gguf \
  https://huggingface.co/MaziyarPanahi/BioMistral-7B-GGUF/resolve/main/BioMistral-7B.Q4_K_M.gguf

# 2. Modelfile (place next to the GGUF)
cat > Modelfile <<'EOF'
FROM ./BioMistral-7B-DARE.Q4_K_M.gguf
SYSTEM "You are a biomedical research assistant."
PARAMETER temperature 0.1
PARAMETER num_ctx 8192
EOF

# 3. Create
ollama create biomed:7b -f Modelfile

# 4. Switch the backend
# In backend/.env:
# OLLAMA_MODEL=biomed:7b
```

## Troubleshooting

- **`pull manifest unknown`** → the tag was renamed upstream. Pick a current alternative (`mistral:7b-instruct`, `llama3:8b-instruct`).
- **`out of memory`** → drop to `q4_0` quantization or use a smaller param size.
- **JSON-mode garbled output on older models** — see `.claude/references/ollama-ops.md`.
