import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  CLIENT_URL: z.string().url().default("http://localhost:5173"),

  // LLM (Ollama)
  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.1:8b-instruct-q4_K_M"),
  OLLAMA_EMBED_MODEL: z.string().default("nomic-embed-text"),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.1),
  LLM_NUM_CTX: z.coerce.number().min(2048).max(32768).default(8192),
  LLM_TIMEOUT_MS: z.coerce.number().default(120_000),
  EMBED_TIMEOUT_MS: z.coerce.number().default(15_000),

  // External retrieval APIs
  NCBI_API_KEY: z.string().optional(),
  OPENALEX_MAILTO: z.string().email().optional(),

  // Cache TTLs (hours)
  CACHE_TTL_HOURS_PUBS: z.coerce.number().default(6),
  CACHE_TTL_HOURS_TRIALS: z.coerce.number().default(24),
  CACHE_TTL_DAYS_EMBEDDINGS: z.coerce.number().default(30),

  // Ranking
  RANKING_TOPK: z.coerce.number().default(20),
  RANKING_TOPK_TRIALS: z.coerce.number().default(5),
  MIN_CORPUS_SIZE: z.coerce.number().default(20),

  // Rate limiting
  RATE_LIMIT_PER_MIN: z.coerce.number().default(30),

  // Retrieval ceilings
  OPENALEX_MAX_RESULTS: z.coerce.number().default(200),
  PUBMED_MAX_RESULTS: z.coerce.number().default(200),
  CT_MAX_RESULTS: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
