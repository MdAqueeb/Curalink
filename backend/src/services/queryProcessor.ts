import type { IntentObject, QueryType, RawInput, TemporalBias } from "../types/domain.js";
import { QUERY_TYPE_ENRICHMENT } from "../config/constants.js";
import { detectDiseaseInText, expandSynonyms, normalizeTerm } from "./meshNormalizer.js";

const TEMPORAL_RECENT = ["latest", "recent", "new", "current", "modern", "2023", "2024", "2025"];
const TEMPORAL_SEMINAL = ["seminal", "foundational", "landmark", "classic", "original"];

function detectTemporalBias(text: string): TemporalBias {
  const lower = text.toLowerCase();
  if (TEMPORAL_RECENT.some((k) => lower.includes(k))) return "recent";
  if (TEMPORAL_SEMINAL.some((k) => lower.includes(k))) return "seminal";
  return "all-time";
}

function detectQueryType(text: string, explicit?: QueryType): QueryType {
  if (explicit && explicit !== "general") return explicit;
  const lower = text.toLowerCase();
  if (/\btreat(?:ment)?|therap|drug[s]?|medication[s]?|management|intervention|tablet[s]?|pill[s]?|medicine[s]?|prescription|dosage|dose[s]?\b/.test(lower)) return "treatment";
  if (/\bmechan|pathophysiol|pathway|how does\b/.test(lower)) return "mechanism";
  if (/\btrial|study|recruit|nct\b/.test(lower)) return "trial";
  if (/\bprevent|prophyla|risk reduc\b/.test(lower)) return "prevention";
  return explicit ?? "general";
}

function detectConcept(text: string, disease: string): string {
  const lower = text.toLowerCase();
  const diseaseLower = disease.toLowerCase();
  const cleaned = lower.replace(diseaseLower, "").replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(/[^a-zA-Z0-9-]+/).filter((t) => t.length > 2 && !STOP.has(t));
  if (tokens.length === 0) return "treatment";
  return tokens.slice(0, 3).join(" ");
}

const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "about", "that", "this",
  "what", "are", "give", "tell", "show", "can", "does", "how",
  "latest", "current", "best", "new", "recent",
  "patient", "patients", "people", "person",
  "treatment", "treatments", "study", "studies", "research", "evidence",
  "have", "has", "had", "feel", "feels", "felt", "feeling",
  "got", "get", "getting", "been", "being", "experiencing",
  "am", "suffering", "complaining", "noticed",
  "question", "problem", "issue", "help", "pain",
  "please", "suggest", "tell", "give", "show", "want", "need", "know",
  "age", "year", "years", "old",
]);

// Normalize common informal/misspelled medical terms before MeSH lookup
const TEXT_NORMALIZATIONS: Array<[RegExp, string]> = [
  // Vomiting — covers correct spelling + dialect transpositions (wamting, wamtings)
  [/[wv][ao]mit(?:ing|ings|ed|s)?/gi, "vomiting"],
  [/[wv]amt(?:ing|ings)/gi, "vomiting"],
  // Diarrhea variants
  [/diarr?h[aeio]+a?/gi, "diarrhea"],
  [/loose\s+(?:stool|motion|bowel)/gi, "diarrhea"],
  [/stomach\s+upset/gi, "diarrhea"],
  [/loose\s+motion/gi, "diarrhea"],
  // Common pain patterns
  [/head[-\s]?ach/gi, "headache"],
  [/stomac?h[-\s]?ach/gi, "stomachache"],
  [/back[-\s]?pain/gi, "back pain"],
  [/chest[-\s]?pain/gi, "chest pain"],
  [/hand[-\s]?pain/gi, "hand pain"],
  [/knee[-\s]?pain/gi, "knee pain"],
  [/shoulder[-\s]?pain/gi, "shoulder pain"],
  [/joint[-\s]?pain/gi, "joint pain"],
  [/neck[-\s]?pain/gi, "neck pain"],
  [/leg[-\s]?pain/gi, "leg pain"],
  [/hip[-\s]?pain/gi, "hip pain"],
  [/stomach[-\s]?pain/gi, "abdominal pain"],
  [/abdominal[-\s]?pain/gi, "abdominal pain"],
  [/ear[-\s]?pain|earache/gi, "ear pain"],
  [/tooth[-\s]?ach|dental\s+pain/gi, "toothache"],
  // Throat / respiratory
  [/soar\s+throat/gi, "sore throat"],
  [/sore[-\s]?throat/gi, "sore throat"],
  [/runny[-\s]?nose/gi, "rhinorrhea"],
  [/short(?:ness)?\s+of\s+breath/gi, "dyspnea"],
  [/breath(?:ing)?\s+(?:problem|difficult|shortness)/gi, "dyspnea"],
  [/\bcough(?:ing)?\b/gi, "cough"],
  // Systemic symptoms
  [/migrain[e]?s?/gi, "migraine"],
  [/high\s+blood\s+pressur/gi, "hypertension"],
  [/diabet[ei]c?s?/gi, "diabetes"],
  [/dizzy|dizzines?s?/gi, "dizziness"],
  [/nause[ao]us?/gi, "nausea"],
  [/fatigue[d]?/gi, "fatigue"],
  [/anxiet[y]?/gi, "anxiety"],
  [/insomni[a]?/gi, "insomnia"],
  [/depress(?:ed|ion)?/gi, "depression"],
  [/constipat(?:ion|ed|ing)?/gi, "constipation"],
  [/heart\s*burn/gi, "heartburn"],
  [/indigestion/gi, "indigestion"],
  [/\bitch(?:ing|y)?\b/gi, "itching"],
  [/\bswollen\b|\bswelling\b/gi, "swelling"],
  [/\brash(?:es)?\b/gi, "skin rash"],
  [/\bbleed(?:ing)?\b/gi, "bleeding"],
  [/\bweak(?:ness)?\b/gi, "weakness"],
  [/\bnumb(?:ness)?\b/gi, "numbness"],
  [/palpitation[s]?/gi, "palpitations"],
  [/bloa[dt](?:ing|ed)?/gi, "bloating"],
  [/\bjaundice\b/gi, "jaundice"],
  [/allerg(?:y|ies|ic)/gi, "allergies"],
  // Adjective → noun
  [/\bfeverish\b/gi, "fever"],
  [/\bdepressed\b/gi, "depression"],
  [/\banxious\b/gi, "anxiety"],
  [/\bsleepless\b/gi, "insomnia"],
  [/\btired\b/gi, "fatigue"],
];

function preNormalizeText(text: string): string {
  let t = text;
  for (const [re, replacement] of TEXT_NORMALIZATIONS) {
    t = t.replace(re, replacement);
  }
  return t;
}

// --- Fuzzy correction for completely unrecognized symptom terms ---

const KNOWN_CONDITIONS = [
  "headache", "migraine", "fever", "cough", "nausea", "vomiting", "vomitings",
  "diarrhea", "diarrhoea", "dizziness", "fatigue", "anxiety", "depression",
  "insomnia", "back pain", "chest pain", "abdominal pain", "sore throat",
  "rhinorrhea", "dyspnea", "hand pain", "knee pain", "shoulder pain",
  "joint pain", "neck pain", "leg pain", "hip pain", "swelling", "skin rash",
  "hypertension", "diabetes", "asthma", "constipation", "heartburn",
  "indigestion", "itching", "bleeding", "weakness", "numbness", "palpitations",
  "bloating", "jaundice", "allergies", "ear pain", "toothache",
];

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyCorrectTerm(term: string): string {
  if (term.length < 4) return term;
  const lower = term.toLowerCase();
  // Allow up to half the shorter word's length in edits (generous but catches dialect spelling)
  const threshold = Math.floor(Math.min(lower.length, 10) / 2);
  let best = { dist: Infinity, match: "" };
  for (const cond of KNOWN_CONDITIONS) {
    if (Math.abs(lower.length - cond.length) > threshold + 1) continue;
    const dist = levenshteinDistance(lower, cond);
    if (dist <= threshold && dist < best.dist) {
      best = { dist, match: cond };
    }
  }
  // Map plural/gerund forms back to base form
  const matched = best.match || term;
  return matched === "vomitings" || matched === "diarrhoea" ? matched.replace("vomitings", "vomiting").replace("diarrhoea", "diarrhea") : matched;
}

// --- Age extraction from free text ---

function extractAgeFromMessage(text: string): number | undefined {
  const patterns = [
    /my\s+age\s+(?:is\s+)?(\d+)/i,
    /(?:i\s+am|i'm|im)\s+(\d+)\s*(?:years?\s+old)?/i,
    /(\d+)\s+years?\s+old/i,
    /(\d+)-year[s]?-old/i,
    /age[d]?\s+(\d+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const age = parseInt(m[1], 10);
      if (age >= 1 && age <= 120) return age;
    }
  }
  return undefined;
}

// Handle direct symptom/condition inputs: "hand pain", "headache", "chest pain"
function extractDirectCondition(text: string): string {
  const cleaned = text.replace(/-/g, " ").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 1 || words.length > 4) return "";
  const FILLER = new Set([
    "the", "a", "an", "for", "with", "about", "what", "how", "give", "tell",
    "show", "are", "is", "do", "does", "me", "my", "its", "please", "suggest",
  ]);
  const content = words.filter((w) => !FILLER.has(w.toLowerCase()));
  return content.length > 0 ? content.join(" ") : "";
}

// --- Activity & onset extraction ---

const ACTIVITY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bfootball\b|\bsoccer\b/i,                       label: "football" },
  { re: /\bcricket\b/i,                                    label: "cricket" },
  { re: /\bbasketball\b/i,                                 label: "basketball" },
  { re: /\btennis\b/i,                                     label: "tennis" },
  { re: /\bvolleyball\b/i,                                 label: "volleyball" },
  { re: /\bbadminton\b/i,                                  label: "badminton" },
  { re: /\brunning\b|\bjogging\b/i,                        label: "running" },
  { re: /\bcycling\b|\bbiking\b/i,                         label: "cycling" },
  { re: /\bswimming\b/i,                                   label: "swimming" },
  { re: /\bgymnastics?\b|\bgym\b|\bworkout\b/i,            label: "gym workout" },
  { re: /\bweightlift(?:ing)?\b|\blifting\s+weights?\b/i,  label: "weightlifting" },
  { re: /\bboxing\b|\bwrestling\b|\bmartial\s+arts?\b/i,   label: "martial arts" },
  { re: /\bhiking\b|\btrekking\b|\bclimbing\b/i,           label: "hiking" },
  { re: /\byoga\b/i,                                       label: "yoga" },
  { re: /\bdanc(?:ing|e)\b/i,                              label: "dancing" },
  { re: /\bsports?\b|\bphysical\s+(?:activity|exercise)\b/i, label: "sports" },
];

// Gerund verbs that signal activity description, not a symptom
const ACTIVITY_STARTER_VERBS = new Set([
  "playing", "running", "jogging", "swimming", "cycling", "lifting",
  "training", "exercising", "practicing", "doing", "performing",
]);

function extractActivity(text: string): string | undefined {
  for (const { re, label } of ACTIVITY_PATTERNS) {
    if (re.test(text)) return label;
  }
  return undefined;
}

function extractOnset(text: string): string | undefined {
  if (/\bsuddenly\b|\babrupt(?:ly)?\b|\binstant(?:ly)?\b/i.test(text)) return "sudden";
  if (/\bgradual(?:ly)?\b|\bslowly\b|\bover\s+time\b/i.test(text)) return "gradual";
  return undefined;
}

// --- Body part & trigger event extraction ---

const BODY_PARTS: string[] = [
  "hand", "wrist", "finger", "fingers", "thumb", "palm",
  "arm", "elbow", "forearm", "shoulder",
  "head", "skull", "face", "jaw",
  "neck", "throat",
  "chest", "rib", "ribs",
  "back", "spine", "lumbar",
  "abdomen", "stomach", "belly",
  "hip", "groin",
  "leg", "thigh", "knee", "calf", "shin",
  "ankle", "foot", "feet", "toe",
  "eye", "eyes", "ear", "ears", "nose",
  "heart", "lung",
];

// Returns the primary body part found in the text
function extractBodyPart(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const part of BODY_PARTS) {
    if (new RegExp(`\\b${part}\\b`).test(lower)) return part;
  }
  return undefined;
}

const TRIGGER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bfall(?:ing|en)?\b|\bfell\b/i,             label: "fall" },
  { re: /\binjur(?:y|ed|ing)?\b/i,                   label: "injury" },
  { re: /\baccident\b/i,                              label: "accident" },
  { re: /\bhit\b|\bstruck\b|\bbump(?:ed)?\b/i,       label: "impact" },
  { re: /\btwist(?:ed)?\b|\bsprain(?:ed)?\b/i,       label: "sprain" },
  { re: /\bcut\b|\bwound\b/i,                         label: "wound" },
  { re: /\bburn(?:ed|t)?\b/i,                         label: "burn" },
  { re: /\bfractur(?:e|ed)?\b|\bbroke\b|\bbroken\b/i, label: "fracture" },
  { re: /\boveruse\b|\boverwork\b|\brepetitive\b/i,  label: "overuse" },
];

function extractTriggerEvent(text: string): string | undefined {
  for (const { re, label } of TRIGGER_PATTERNS) {
    if (re.test(text)) return label;
  }
  return undefined;
}

// --- Patient summary builders ---

function extractGender(text: string): string | null {
  if (/\b(?:i\s+am|i'm)\s+(?:a\s+)?(?:\d+[-\s]year[-\s]old\s+)?(?:male|man|boy)\b/i.test(text)) return "male";
  if (/\b(?:i\s+am|i'm)\s+(?:a\s+)?(?:\d+[-\s]year[-\s]old\s+)?(?:female|woman|girl)\b/i.test(text)) return "female";
  if (/\bhe\s+(?:is|has)\b|\bhis\s+age\b/i.test(text)) return "male";
  if (/\bshe\s+(?:is|has)\b|\bher\s+age\b/i.test(text)) return "female";
  return null;
}

function extractDuration(text: string): string | null {
  const m = text.match(
    /(?:for|since|past|last)\s+(?:the\s+)?(\d+\s+(?:hour|day|week|month|year)[s]?|a\s+(?:day|week|month)|few\s+(?:days|weeks|hours)|yesterday|a\s+while)/i
  );
  return m ? m[0].trim() : null;
}

function buildPatientSummary(
  rawText: string,
  primarySymptom: string,
  userAge: number | undefined,
  bodyPart: string | undefined,
  triggerEvent: string | undefined,
  activity: string | undefined,
  onset: string | undefined,
): string {
  const gender = extractGender(rawText);
  const duration = extractDuration(rawText);

  const who =
    userAge && gender ? `${userAge}-year-old ${gender}`
    : userAge ? `${userAge}-year-old patient`
    : gender ? `${gender} patient`
    : "Patient";

  const parts = [`${who} presenting with ${primarySymptom || "unspecified complaint"}`];
  if (activity)     parts.push(`during/after ${activity}`);
  if (onset)        parts.push(`onset: ${onset}`);
  if (triggerEvent && !activity) parts.push(`triggered by ${triggerEvent}`);
  if (duration)     parts.push(duration);

  const scope = bodyPart ? ` Body part: ${bodyPart}.` : "";
  return parts.join(", ") + "." + scope;
}

// Extract symptom from first-person messages: "I have a headache" / "I'm feeling dizzy"
// Does NOT return activity-verb phrases like "playing football"
function extractSymptomFromMessage(text: string): string {
  const match = text.match(
    /\bi(?:'m| am| have| got| feel|'ve)\s+(?:a\s+|an\s+|some\s+)?([a-z][\w\s-]{2,30})/i
  );
  if (!match) return "";
  const candidate = match[1].trim().split(/\s+/).slice(0, 3).join(" ").toLowerCase();
  if (STOP.has(candidate)) return "";
  // Reject if the first word is an activity verb ("playing football" → not a symptom)
  if (ACTIVITY_STARTER_VERBS.has(candidate.split(" ")[0])) return "";
  return candidate;
}

export function processInput(input: RawInput): IntentObject {
  const rawText = (input.message ?? `${input.disease ?? ""} ${input.query ?? ""}`).trim();
  const normalizedText = preNormalizeText(rawText);

  // Extract age from message text if not provided as a structured field
  const userAge = input.userAge ?? extractAgeFromMessage(rawText);

  const diseaseRaw =
    input.disease?.trim() ||
    detectDiseaseInText(normalizedText) ||
    extractSymptomFromMessage(normalizedText) ||
    extractDirectCondition(normalizedText) ||
    "";

  // Fuzzy-correct unrecognized terms (catches dialect/typo variants like "wamtings" → "vomiting")
  const diseaseCorrected = diseaseRaw ? fuzzyCorrectTerm(diseaseRaw) : "";
  const primaryDisease = diseaseCorrected ? normalizeTerm(diseaseCorrected) : "";

  const conceptRaw = input.query?.trim() || detectConcept(normalizedText, primaryDisease);
  // Don't use a concept that's just a word from the disease name itself
  const conceptIsRedundant =
    Boolean(primaryDisease && conceptRaw &&
    primaryDisease.toLowerCase().includes(conceptRaw.toLowerCase()));
  const clinicalConcept = normalizeTerm(
    !conceptIsRedundant && conceptRaw ? conceptRaw : "treatment"
  );

  const queryType = detectQueryType(normalizedText, input.queryType);
  const temporalBias = detectTemporalBias(normalizedText);

  const diseaseSyns = primaryDisease ? expandSynonyms(primaryDisease) : [];
  const conceptSyns = expandSynonyms(clinicalConcept);
  const enrichment = QUERY_TYPE_ENRICHMENT[queryType];

  const bodyPart     = extractBodyPart(normalizedText);
  const triggerEvent = extractTriggerEvent(rawText);
  const activity     = extractActivity(rawText);
  const onset        = extractOnset(rawText);

  // When an activity is detected and the text mentions pain but no specific disease was found,
  // synthesise a clinically meaningful disease term rather than leaving it as an activity phrase.
  let finalDisease = primaryDisease;
  if (activity && !finalDisease) {
    const hasPain   = /\bpain\b|\bach(?:e|ing)?\b|\bsor(?:e|eness)\b/i.test(rawText);
    const hasInjury = triggerEvent === "injury" || /\binjur\b/i.test(rawText);
    finalDisease = hasPain   ? "muscle pain"
                 : hasInjury ? "sports injury"
                 : "sports-related pain";
  }
  // Also make sure an activity-phrase that slipped through (e.g. "playing football") is replaced
  if (finalDisease && ACTIVITY_STARTER_VERBS.has(finalDisease.split(" ")[0])) {
    finalDisease = "muscle pain";
  }

  const duration     = extractDuration(rawText);
  const expandedTerms = [...new Set([...diseaseSyns, ...conceptSyns, ...enrichment])];
  const queries       = buildQueries(finalDisease, clinicalConcept, diseaseSyns, conceptSyns, triggerEvent, activity);
  const patientSummary = buildPatientSummary(rawText, finalDisease, userAge, bodyPart, triggerEvent, activity, onset);
  const searchQuery   = buildSearchQuery(finalDisease, queryType, userAge, onset, activity, bodyPart, duration);

  return {
    primaryDisease: finalDisease,
    clinicalConcept,
    temporalBias,
    queryType,
    rawInput: rawText,
    expandedTerms,
    queries,
    userAge,
    patientSummary,
    bodyPart,
    triggerEvent,
    activity,
    onset,
    searchQuery,
  };
}

// Produces a clean, filler-free medical query string for retrieval and display.
// Example: age=24, symptom=headache, onset=sudden → "acute headache causes young adults"
function buildSearchQuery(
  disease: string,
  queryType: QueryType,
  userAge?: number,
  onset?: string,
  activity?: string,
  bodyPart?: string,
  duration?: string | null,
): string {
  const parts: string[] = [];

  if (onset === "sudden") parts.push("acute");
  else if (onset === "gradual") parts.push("chronic");

  if (disease) parts.push(disease);
  if (activity && !disease.includes("muscle")) parts.push(`after ${activity}`);
  if (bodyPart && !disease.toLowerCase().includes(bodyPart)) parts.push(bodyPart);

  if (queryType === "treatment")   parts.push("treatment");
  else if (queryType === "mechanism")  parts.push("causes");
  else if (queryType === "prevention") parts.push("prevention");

  if (userAge) {
    if (userAge < 12)       parts.push("pediatric");
    else if (userAge < 18)  parts.push("adolescent");
    else if (userAge < 40)  parts.push("young adults");
    else if (userAge >= 60) parts.push("elderly");
  }

  if (duration) parts.push(duration);

  return parts.filter(Boolean).join(" ");
}

function buildQueries(
  disease: string,
  concept: string,
  diseaseSyns: string[],
  conceptSyns: string[],
  triggerEvent?: string,
  activity?: string,
): string[] {
  const orList = (arr: string[]) => arr.map((t) => `"${t}"`).join(" OR ");
  const safeDisease = disease || concept || "medicine";
  const safeConcept = concept || "treatment";

  const dSyns = diseaseSyns.length ? diseaseSyns : [safeDisease];
  const cSyns = conceptSyns.length ? conceptSyns : [safeConcept];

  // Sports/activity context → bias toward exercise-related pain / sports medicine
  if (activity) {
    return [
      `"muscle pain" AND "sports" AND "${safeConcept}"`,
      `"exercise-related pain" OR "sports injury" OR "muscle strain"`,
      `"${safeDisease}" AND ("sports" OR "exercise" OR "physical activity")`,
      `"${safeDisease}" AND "sports medicine" AND "clinical trial"`,
    ];
  }

  // Trauma/injury context → bias toward trauma papers
  const traumaTerm = triggerEvent
    ? ({ fall: "trauma", injury: "injury", fracture: "fracture", sprain: "sprain", accident: "trauma" } as Record<string, string>)[triggerEvent] ?? "injury"
    : null;

  const base = [
    `"${safeConcept}" AND "${safeDisease}"`,
    `(${orList(cSyns)}) AND (${orList(dSyns)})`,
    `"${safeDisease}" AND (${orList(cSyns.slice(0, 4))})`,
    `"${safeDisease}" AND "${safeConcept}" AND "clinical trial"`,
  ];

  if (traumaTerm) {
    base[0] = `"${safeDisease}" AND "${traumaTerm}"`;
    base[1] = `(${orList(dSyns)}) AND ("${traumaTerm}" OR "injury")`;
  }

  return base;
}
