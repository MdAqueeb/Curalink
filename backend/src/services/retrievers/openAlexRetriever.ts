import { env } from "../../config/env.js";
import type { Publication } from "../../types/domain.js";
import { logger } from "../../utils/logger.js";

interface OpenAlexAuthorship {
  author?: { display_name?: string };
}

interface OpenAlexLocation {
  source?: { display_name?: string };
  landing_page_url?: string;
}

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string;
  abstract_inverted_index?: Record<string, number[]> | null;
  abstract?: string | null;
  publication_year?: number | null;
  cited_by_count?: number;
  primary_location?: OpenAlexLocation | null;
  authorships?: OpenAlexAuthorship[];
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
  meta?: { count?: number; per_page?: number };
}

const PER_PAGE = 100;
const REQUEST_TIMEOUT = 10_000;

export async function fetchOpenAlex(
  queryString: string,
  maxResults: number = env.OPENALEX_MAX_RESULTS
): Promise<Publication[]> {
  const out: Publication[] = [];
  let page = 1;
  const ceiling = Math.min(maxResults, 300);

  while (out.length < ceiling) {
    const url = new URL("https://api.openalex.org/works");
    url.searchParams.set("search", queryString);
    url.searchParams.set("filter", "publication_year:>2015,type:article");
    url.searchParams.set("sort", "relevance_score:desc");
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));
    url.searchParams.set(
      "select",
      "id,doi,title,abstract_inverted_index,publication_year,cited_by_count,primary_location,authorships"
    );
    if (env.OPENALEX_MAILTO) url.searchParams.set("mailto", env.OPENALEX_MAILTO);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        logger.warn("OpenAlex non-2xx", { status: res.status, page });
        break;
      }
      const data = (await res.json()) as OpenAlexResponse;
      const results = data.results ?? [];
      if (results.length === 0) break;
      out.push(...results.map(normalizeOpenAlexRecord));
      if (results.length < PER_PAGE) break;
      page++;
    } finally {
      clearTimeout(timer);
    }
  }

  return out.slice(0, ceiling);
}

function abstractFromInvertedIndex(idx?: Record<string, number[]> | null): string {
  if (!idx) return "";
  const tokens: { word: string; pos: number }[] = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const p of positions) tokens.push({ word, pos: p });
  }
  tokens.sort((a, b) => a.pos - b.pos);
  return tokens.map((t) => t.word).join(" ");
}

function normalizeOpenAlexRecord(r: OpenAlexWork): Publication {
  const abstract = r.abstract ?? abstractFromInvertedIndex(r.abstract_inverted_index);
  return {
    source: "openalex",
    id: r.id,
    doi: r.doi ?? null,
    title: r.title ?? "",
    abstract,
    year: r.publication_year ?? null,
    citationCount: r.cited_by_count ?? 0,
    journal: r.primary_location?.source?.display_name ?? "Unknown",
    url: r.primary_location?.landing_page_url ?? r.id,
    authors: (r.authorships ?? [])
      .slice(0, 5)
      .map((a) => a.author?.display_name ?? "")
      .filter(Boolean),
  };
}
