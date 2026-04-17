import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

interface MeshIndex {
  acronyms: Record<string, string>;
  preferred: Record<string, string>;
  entryTerms: Record<string, string[]>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = resolve(__dirname, "../../data");

const meshIndex: MeshIndex = JSON.parse(
  readFileSync(resolve(dataDir, "mesh_terms.json"), "utf8")
);

const synonymTable: Record<string, string[]> = JSON.parse(
  readFileSync(resolve(dataDir, "synonyms.json"), "utf8")
);

export function normalizeTerm(term: string): string {
  if (!term) return term;
  const lower = term.toLowerCase().trim();
  if (meshIndex.acronyms[lower]) return meshIndex.acronyms[lower];
  if (meshIndex.preferred[lower]) return meshIndex.preferred[lower];
  return term.trim();
}

export function expandSynonyms(canonicalTerm: string): string[] {
  const set = new Set<string>([canonicalTerm]);
  const entryTerms = meshIndex.entryTerms[canonicalTerm];
  if (entryTerms) entryTerms.forEach((t) => set.add(t));
  const explicit = synonymTable[canonicalTerm];
  if (explicit) explicit.forEach((t) => set.add(t));
  return [...set];
}

export function detectDiseaseInText(text: string): string | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  // Check acronyms first (whole-word match)
  for (const [acronym, expansion] of Object.entries(meshIndex.acronyms)) {
    const re = new RegExp(`\\b${escapeRegex(acronym)}\\b`, "i");
    if (re.test(text)) return expansion;
  }
  // Then preferred mappings
  for (const [variant, canonical] of Object.entries(meshIndex.preferred)) {
    if (lower.includes(variant)) return canonical;
  }
  // Then canonical names themselves
  for (const canonical of Object.keys(meshIndex.entryTerms)) {
    if (lower.includes(canonical.toLowerCase())) return canonical;
  }
  // Then any synonym in synonyms.json
  for (const [canonical, syns] of Object.entries(synonymTable)) {
    for (const s of syns) {
      if (lower.includes(s.toLowerCase())) return canonical;
    }
  }
  return undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
