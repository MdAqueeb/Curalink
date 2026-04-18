import { env } from "../../config/env.js";
import type {
  ConversationHistoryItem,
  IntentObject,
  PersonaDirectives,
  RankedDoc,
  Trial,
} from "../../types/domain.js";

export interface BuiltPrompt {
  prompt: string;
  retrievedIds: Set<string>;
  trialIds: Set<string>;
}

// 5-step reasoning — query rewriting, activity-aware, body-part locked, hard relevance filter
const SYSTEM_PROMPT = `You are a Medical Research Assistant. Follow ALL 5 steps strictly.

STEP 1 – STRUCTURED EXTRACTION: From PATIENT SUMMARY extract ALL elements:
  - Age, symptoms, onset (sudden/gradual), duration, activity, body part.

STEP 2 – QUERY REWRITING (CRITICAL): Use the SEARCH QUERY provided below as your research query.
  It is already cleaned and rewritten. NEVER use the raw patient message as a query.
  NEVER include filler ("and my", "i have", etc.) in reasoning.

STEP 3 – CONTEXT-AWARE TOPIC LOCK:
  - Activity detected → topic = "<symptom> after <activity>" (e.g. "Muscle pain after football").
  - Body part detected → topic MUST include that exact body part. NEVER switch to another.
  - NEVER infer unrelated diseases. Prefer symptom-based reasoning.

STEP 4 – RESEARCH FILTER: Generate insights ONLY from RETRIEVED CONTEXT using the search query.
  HARD FILTER: Discard insights not related to the symptom + context.
  Never invent facts. Cite every claim with exact refId.

STEP 5 – VALIDATE before output:
  1. Used ALL key elements? (symptom + context + duration)
  2. Topic specific and relevant?
  3. ALL insights related to symptom?
  If ANY answer is NO → remove that insight.
  Output ONLY valid JSON, no prose outside JSON.`;

// clinicalTrials and sources are built server-side; LLM outputs conditionOverview + insights only.
const SCHEMA_FOOTER = `Output ONLY this JSON (no markdown fences). Maximum 10 researchInsights.
{"conditionOverview":{"disease":string,"subtypes":string[],"summary":"2-4 sentences: patient context + key findings for their specific symptom/body part","evidenceLevel":"high"|"moderate"|"low"},"researchInsights":[{"insightId":"ins_001","claim":"one sentence — MUST mention the body part or injury","sourceRefs":["refId"],"confidence":"high"|"moderate"|"low","year":number|null}],"disclaimer":string}`;

// Tokens reserved for the LLM's JSON output (empirically, response is 300–500 tokens)
const OUTPUT_TOKENS = 800;
// Fixed overhead: system prompt + schema + section labels + query line + 2-turn history ≈ 250 tokens
const PROMPT_OVERHEAD_TOKENS = 250;
// Conservative chars-per-token estimate for English medical text
const CHARS_PER_TOKEN = 4;
// Max chars for each trial block in the prompt
const TRIAL_CHARS_EACH = 100;
// Hard cap on abstract chars — keeps prefill fast on CPU regardless of context window size
const MAX_ABSTRACT_CHARS = 200;

/**
 * Extractive abstract compressor.
 * Scores sentences by query-term overlap + positional bonus, keeps highest-scoring
 * sentences that fit within maxChars, reconstructed in original document order.
 */
function compressAbstract(text: string, queryTerms: Set<string>, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || "";

  const sentences = text
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  if (sentences.length === 0) return text.slice(0, maxChars);
  if (sentences.length === 1) return sentences[0].slice(0, maxChars);

  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);
    const hits = words.filter((w) => w.length > 3 && queryTerms.has(w)).length;
    // First sentence = context (+2), last sentence = conclusion (+1)
    const posBonus = i === 0 ? 2 : i === sentences.length - 1 ? 1 : 0;
    return { s, score: hits + posBonus, i };
  });

  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const kept = new Set<number>();
  let budget = maxChars;

  for (const { s, i } of byScore) {
    const need = s.length + (kept.size > 0 ? 2 : 0);
    if (need <= budget) {
      kept.add(i);
      budget -= need;
    }
  }

  if (kept.size === 0) return sentences[0].slice(0, maxChars);

  return sentences
    .filter((_, i) => kept.has(i))
    .join(" ")
    .slice(0, maxChars);
}

function formatSources(
  top: RankedDoc[],
  queryTerms: Set<string>,
  abstractBudgetPerDoc: number
): { block: string; ids: Set<string> } {
  const ids = new Set<string>();
  const lines = top.map((r) => {
    const d = r.doc;
    ids.add(d.id);
    // Omit DOI/URL from the context block — LLM cites by refId only; full metadata goes in sources[]
    const meta = `[Source refId=${d.id}] "${d.title.slice(0, 80).replace(/"/g, "'")}" (${d.year ?? "n/a"}, ${d.journal.slice(0, 40)})`;
    const snippet = compressAbstract(d.abstract || "", queryTerms, Math.max(60, abstractBudgetPerDoc));
    return `${meta}\n${snippet || "(no abstract)"}`;
  });
  return { block: lines.join("\n\n"), ids };
}

function formatTrials(trials: Trial[]): { block: string; ids: Set<string> } {
  const ids = new Set<string>();
  const lines = trials.map((t) => {
    ids.add(t.nctId);
    const summary = (t.summary || "").slice(0, TRIAL_CHARS_EACH);
    return `[Trial nctId=${t.nctId}] "${t.title.slice(0, 80).replace(/"/g, "'")}" | ${t.status} | ${t.phase}\n${summary}`;
  });
  return { block: lines.join("\n\n"), ids };
}

function formatHistory(history?: ConversationHistoryItem[]): string {
  if (!history || history.length === 0) return "(none)";
  // Cap to last 2 turns to conserve tokens
  return history
    .slice(-2)
    .map(
      (h, i) =>
        `[T${i + 1}] User: "${h.userMessage.slice(0, 100)}" | Asst: ${h.assistantSummary.slice(0, 80)}`
    )
    .join("\n");
}

function formatPersona(persona?: PersonaDirectives | null): string {
  if (!persona) return "";
  const parts: string[] = [];
  if (persona.preferredDiseases.length)
    parts.push(`diseases: ${persona.preferredDiseases.slice(0, 3).join(", ")}`);
  if (persona.preferredQueryTypes.length)
    parts.push(`types: ${persona.preferredQueryTypes.slice(0, 2).join(", ")}`);
  return parts.length ? `\nPERSONALIZATION: ${parts.join(" | ")}` : "";
}

export function buildPrompt(
  intent: IntentObject,
  topPubs: RankedDoc[],
  topTrials: Trial[],
  persona?: PersonaDirectives | null,
  numCtx = env.LLM_NUM_CTX
): BuiltPrompt {
  // Extract query terms for extractive compression scoring
  const queryTerms = new Set(
    [intent.primaryDisease, intent.clinicalConcept, ...intent.expandedTerms]
      .filter(Boolean)
      .flatMap((t) => (t as string).toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/))
      .filter((w) => w.length > 3)
  );

  // Derive per-doc abstract budget from the actual context window size.
  // Formula: input token budget = numCtx - output_reserve - overhead
  // → convert to chars, subtract trial blocks, divide by number of sources.
  const inputTokenBudget = Math.max(200, numCtx - OUTPUT_TOKENS - PROMPT_OVERHEAD_TOKENS);
  const contentCharBudget = inputTokenBudget * CHARS_PER_TOKEN;
  const trialCharBudget = topTrials.length * (TRIAL_CHARS_EACH + 100); // +100 for title/meta line
  const sourceCharBudget = Math.max(topPubs.length * 80, contentCharBudget - trialCharBudget);
  const abstractBudgetPerDoc = Math.min(
    MAX_ABSTRACT_CHARS,
    Math.max(60, Math.floor(sourceCharBudget / Math.max(1, topPubs.length)) - 110)
  );

  const { block: sourceBlock, ids: retrievedIds } = formatSources(topPubs, queryTerms, abstractBudgetPerDoc);
  const { block: trialBlock, ids: trialIds } = formatTrials(topTrials);

  const topicLabel =
    intent.activity
      ? `${intent.primaryDisease || "muscle pain"} after ${intent.activity}`
      : intent.triggerEvent
        ? `${intent.primaryDisease || "pain"} after ${intent.triggerEvent}`
        : intent.primaryDisease || "unspecified complaint";

  const prompt = `${SYSTEM_PROMPT}

PATIENT SUMMARY:
${intent.patientSummary || `Patient presenting with ${topicLabel}.`}
SEARCH QUERY: ${intent.searchQuery || topicLabel}
LOCKED TOPIC: ${topicLabel}
ACTIVITY: ${intent.activity ?? "none"} | BODY PART: ${intent.bodyPart ?? "unspecified"} | TRIGGER: ${intent.triggerEvent ?? "none"} | ONSET: ${intent.onset ?? "unspecified"}
QUERY TYPE: ${intent.queryType}${intent.userAge ? ` | AGE: ${intent.userAge}` : ""}

RETRIEVED CONTEXT:
${sourceBlock || "(no publications retrieved for this topic)"}

CLINICAL TRIALS:
${trialBlock || "(none)"}

CONVERSATION HISTORY:
${formatHistory(intent.conversationHistory)}${formatPersona(persona)}

PATIENT'S ORIGINAL MESSAGE: "${intent.rawInput.slice(0, 300)}"

${SCHEMA_FOOTER}`;

  return { prompt, retrievedIds, trialIds };
}
