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

const SYSTEM_PROMPT = `You are a Medical Research Assistant. Your role is to synthesize peer-reviewed research evidence to answer medical research questions.

STRICT RULES:
1. ONLY use information from the RETRIEVED CONTEXT section below.
2. NEVER invent facts, statistics, drug names, dosages, or study results.
3. Every claim you make MUST be attributed to a specific source in the context (cite by [Source N] using its exact refId).
4. If the retrieved context does not contain sufficient information to answer the question, explicitly state: "The available research does not provide sufficient evidence on this specific point."
5. You are providing research summaries, NOT medical advice. Always include the disclaimer field.
6. Respond with ONLY a valid JSON object that conforms to the schema described at the end.`;

const SCHEMA_FOOTER = `Respond with a single JSON object — no prose, no markdown — matching this schema:
{
  "conditionOverview": {
    "disease": string,
    "subtypes": string[],
    "summary": string,                    // 2-4 sentences, source-grounded
    "evidenceLevel": "high" | "moderate" | "low"
  },
  "researchInsights": [
    {
      "insightId": string,                 // e.g. "ins_001"
      "claim": string,                     // single-sentence claim
      "detail": string,                    // 1-3 sentences expanding the claim
      "sourceRefs": string[],              // refIds from RETRIEVED CONTEXT (use the exact ids shown)
      "confidence": "high" | "moderate" | "low",
      "year": number | null
    }
  ],
  "clinicalTrials": [
    {
      "nctId": string,                     // must match a [Trial N] nctId from CLINICAL TRIALS
      "title": string,
      "status": string,
      "phase": string,
      "summary": string,
      "url": string,
      "relevanceNote": string
    }
  ],
  "sources": [
    {
      "refId": string,                     // copy refId from RETRIEVED CONTEXT
      "title": string,
      "year": number | null,
      "url": string
    }
  ],
  "disclaimer": string
}`;

function formatSources(top: RankedDoc[]): { block: string; ids: Set<string> } {
  const ids = new Set<string>();
  const lines = top.map((r) => {
    const d = r.doc;
    ids.add(d.id);
    return `[Source refId=${d.id}] Title: "${d.title.replace(/"/g, "'")}" | Year: ${
      d.year ?? "n/a"
    } | Journal: ${d.journal} | DOI: ${d.doi ?? "n/a"} | URL: ${d.url}\nAbstract: ${(
      d.abstract || "(no abstract)"
    ).slice(0, 1500)}`;
  });
  return { block: lines.join("\n\n"), ids };
}

function formatTrials(trials: Trial[]): { block: string; ids: Set<string> } {
  const ids = new Set<string>();
  const lines = trials.map((t, i) => {
    ids.add(t.nctId);
    return `[Trial ${i + 1} nctId=${t.nctId}] Title: "${t.title.replace(/"/g, "'")}" | Status: ${
      t.status
    } | Phase: ${t.phase} | URL: ${t.url}\nSummary: ${(t.summary || "(no summary)").slice(0, 800)}`;
  });
  return { block: lines.join("\n\n"), ids };
}

function formatHistory(history?: ConversationHistoryItem[]): string {
  if (!history || history.length === 0) return "(none — first turn in session)";
  return history
    .map((h, i) => `Turn ${i + 1} — User: "${h.userMessage}"\nTurn ${i + 1} — Assistant: ${h.assistantSummary}`)
    .join("\n\n");
}

function formatPersona(persona?: PersonaDirectives | null): string {
  if (!persona) return "";
  return `\n\nPERSONALIZATION CONTEXT:
- Frequently researched diseases: ${persona.preferredDiseases.join(", ") || "(none yet)"}
- Preferred query types: ${persona.preferredQueryTypes.join(", ") || "(none yet)"}
- Response depth preference: ${persona.responseDepth}
- Avoid repeating content already provided in this session.`;
}

export function buildPrompt(
  intent: IntentObject,
  topPubs: RankedDoc[],
  topTrials: Trial[],
  persona?: PersonaDirectives | null
): BuiltPrompt {
  const { block: sourceBlock, ids: retrievedIds } = formatSources(topPubs);
  const { block: trialBlock, ids: trialIds } = formatTrials(topTrials);

  const prompt = `${SYSTEM_PROMPT}

RETRIEVED CONTEXT:
${sourceBlock || "(no publications retrieved)"}

CLINICAL TRIALS:
${trialBlock || "(no trials retrieved)"}

CONVERSATION HISTORY:
${formatHistory(intent.conversationHistory)}${formatPersona(persona)}

CURRENT QUESTION: "${intent.rawInput}"
ACTIVE DISEASE CONTEXT: ${intent.primaryDisease || "(unspecified)"}
QUERY TYPE: ${intent.queryType}
${intent.userAge ? `USER AGE: ${intent.userAge}\n` : ""}
${SCHEMA_FOOTER}`;

  return { prompt, retrievedIds, trialIds };
}
