import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { env } from "../../config/env.js";
import type { Publication } from "../../types/domain.js";
import { logger } from "../../utils/logger.js";

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const REQUEST_TIMEOUT = 15_000;
const BATCH_SIZE = 100;

// Process-local token bucket: NCBI allows 10 req/s with key, 3 without.
// TODO(scale): swap for Redis-backed limiter when running under PM2 cluster.
const minIntervalMs = env.NCBI_API_KEY ? 110 : 350;
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastCallAt + minIntervalMs - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

interface ESearchResponse {
  esearchresult?: {
    count?: string;
    webenv?: string;
    querykey?: string;
    WebEnv?: string;
    QueryKey?: string;
  };
}

export async function fetchPubMed(
  queryString: string,
  maxResults: number = env.PUBMED_MAX_RESULTS
): Promise<Publication[]> {
  await throttle();

  const searchParams: Record<string, string> = {
    db: "pubmed",
    term: queryString,
    retmax: String(maxResults),
    sort: "relevance",
    retmode: "json",
    usehistory: "y",
  };
  if (env.NCBI_API_KEY) searchParams.api_key = env.NCBI_API_KEY;

  const searchRes = await axios.get<ESearchResponse>(`${EUTILS_BASE}/esearch.fcgi`, {
    params: searchParams,
    timeout: REQUEST_TIMEOUT,
  });

  const r = searchRes.data.esearchresult ?? {};
  const webenv = r.webenv ?? r.WebEnv;
  const queryKey = r.querykey ?? r.QueryKey;
  const count = parseInt(r.count ?? "0", 10);
  if (!webenv || !queryKey || count === 0) return [];

  const total = Math.min(count, maxResults);
  const records: Publication[] = [];

  for (let start = 0; start < total; start += BATCH_SIZE) {
    await throttle();
    const fetchParams: Record<string, string> = {
      db: "pubmed",
      WebEnv: webenv,
      query_key: queryKey,
      retstart: String(start),
      retmax: String(BATCH_SIZE),
      retmode: "xml",
      rettype: "abstract",
    };
    if (env.NCBI_API_KEY) fetchParams.api_key = env.NCBI_API_KEY;

    try {
      const fetchRes = await axios.get<string>(`${EUTILS_BASE}/efetch.fcgi`, {
        params: fetchParams,
        timeout: REQUEST_TIMEOUT,
        responseType: "text",
      });
      const parsed = parser.parse(fetchRes.data) as {
        PubmedArticleSet?: { PubmedArticle?: unknown };
      };
      const raw = parsed?.PubmedArticleSet?.PubmedArticle ?? [];
      const arr = Array.isArray(raw) ? raw : [raw];
      records.push(...arr.map(normalizePubMedRecord).filter((p): p is Publication => Boolean(p)));
    } catch (err) {
      logger.warn("PubMed efetch batch failed", {
        start,
        err: (err as Error).message,
      });
    }
  }

  return records;
}

function extractText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    return Object.values(obj).map(extractText).join(" ");
  }
  return "";
}

function extractAbstract(abs: unknown): string {
  if (!abs) return "";
  const obj = abs as Record<string, unknown>;
  const text = obj.AbstractText;
  if (Array.isArray(text)) return text.map(extractText).join(" ");
  return extractText(text);
}

function extractAuthors(authorList: unknown): string[] {
  if (!authorList) return [];
  const arr = Array.isArray(authorList) ? authorList : [authorList];
  return arr
    .slice(0, 5)
    .map((a) => {
      const obj = a as Record<string, unknown>;
      const ln = extractText(obj.LastName);
      const fn = extractText(obj.ForeName ?? obj.Initials);
      return [ln, fn].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

function normalizePubMedRecord(article: unknown): Publication | null {
  const wrapper = article as Record<string, unknown>;
  const med = wrapper?.MedlineCitation as Record<string, unknown> | undefined;
  const art = med?.Article as Record<string, unknown> | undefined;
  if (!med || !art) return null;

  const pmidRaw = med.PMID as unknown;
  const pmid =
    typeof pmidRaw === "object" && pmidRaw !== null
      ? extractText((pmidRaw as Record<string, unknown>)["#text"] ?? pmidRaw)
      : String(pmidRaw ?? "");
  if (!pmid) return null;

  const journal = art.Journal as Record<string, unknown> | undefined;
  const journalIssue = journal?.JournalIssue as Record<string, unknown> | undefined;
  const pubDate = journalIssue?.PubDate as Record<string, unknown> | undefined;
  const yearRaw = extractText(pubDate?.Year ?? pubDate?.MedlineDate);
  const yearMatch = yearRaw.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null;

  const authorList = art.AuthorList as Record<string, unknown> | undefined;

  return {
    source: "pubmed",
    id: `pmid:${pmid}`,
    pmid,
    title: extractText(art.ArticleTitle),
    abstract: extractAbstract(art.Abstract),
    year,
    journal: extractText(journal?.Title) || "Unknown",
    authors: extractAuthors(authorList?.Author),
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
  };
}
