/**
 * Proves CLAUDE.md §15 Requirement 9: a single failing retriever must not abort
 * the entire response. Uses Promise.allSettled in retrievalOrchestrator.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external I/O before any imports that transitively call it.
vi.mock("../services/retrievers/openAlexRetriever.js", () => ({
  fetchOpenAlex: vi.fn(),
}));
vi.mock("../services/retrievers/pubmedRetriever.js", () => ({
  fetchPubMed: vi.fn(),
}));
vi.mock("../services/retrievers/clinicalTrialsRetriever.js", () => ({
  fetchClinicalTrials: vi.fn(),
}));
vi.mock("../services/cacheService.js", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}));

import { fetchOpenAlex } from "../services/retrievers/openAlexRetriever.js";
import { fetchPubMed } from "../services/retrievers/pubmedRetriever.js";
import { fetchClinicalTrials } from "../services/retrievers/clinicalTrialsRetriever.js";
import { runRetrieval } from "../services/retrievalOrchestrator.js";
import type { IntentObject, Publication } from "../types/domain.js";

const mockIntent: IntentObject = {
  primaryDisease: "Parkinson's disease",
  clinicalConcept: "treatment",
  temporalBias: "recent",
  queryType: "treatment",
  rawInput: "treatment for Parkinson's",
  expandedTerms: [],
  queries: [
    '"treatment" AND "Parkinson\'s disease"',
    '"treatment" AND "Parkinson\'s disease"',
  ],
};

const makePublication = (source: "openalex" | "pubmed", id: string): Publication => ({
  source,
  id,
  title: `Test publication ${id}`,
  abstract: "Test abstract",
  year: 2023,
  journal: "Test Journal",
  url: `https://example.com/${id}`,
  authors: ["Author A"],
});

describe("retrievalOrchestrator — Promise.allSettled resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchClinicalTrials as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("continues and returns OpenAlex results when PubMed throws", async () => {
    (fetchOpenAlex as ReturnType<typeof vi.fn>).mockResolvedValue([
      makePublication("openalex", "oa_1"),
    ]);
    (fetchPubMed as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("PubMed 503"));

    const bundle = await runRetrieval(mockIntent);

    expect(bundle.publications).toHaveLength(1);
    expect(bundle.publications[0].source).toBe("openalex");
    expect(bundle.retrievalErrors.some((e) => e.source === "pubmed")).toBe(true);
    expect(bundle.cacheHit).toBe(false);
  });

  it("continues and returns PubMed results when OpenAlex throws", async () => {
    (fetchOpenAlex as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("OpenAlex timeout")
    );
    (fetchPubMed as ReturnType<typeof vi.fn>).mockResolvedValue([
      makePublication("pubmed", "pm_1"),
    ]);

    const bundle = await runRetrieval(mockIntent);

    expect(bundle.publications).toHaveLength(1);
    expect(bundle.publications[0].source).toBe("pubmed");
    expect(bundle.retrievalErrors.some((e) => e.source === "openalex")).toBe(true);
  });

  it("returns an empty bundle (not a thrown error) when all retrievers fail", async () => {
    (fetchOpenAlex as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    (fetchPubMed as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network error"));
    (fetchClinicalTrials as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network error")
    );

    const bundle = await runRetrieval(mockIntent);

    expect(bundle.publications).toHaveLength(0);
    expect(bundle.trials).toHaveLength(0);
    expect(bundle.retrievalErrors.some((e) => e.source === "openalex")).toBe(true);
    expect(bundle.retrievalErrors.some((e) => e.source === "pubmed")).toBe(true);
    expect(bundle.retrievalErrors.some((e) => e.source === "clinicaltrials")).toBe(true);
    expect(bundle.cacheHit).toBe(false);
  });

  it("does not include trial errors in publications list", async () => {
    (fetchOpenAlex as ReturnType<typeof vi.fn>).mockResolvedValue([
      makePublication("openalex", "oa_1"),
      makePublication("openalex", "oa_2"),
    ]);
    (fetchPubMed as ReturnType<typeof vi.fn>).mockResolvedValue([
      makePublication("pubmed", "pm_1"),
    ]);
    (fetchClinicalTrials as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("ClinicalTrials.gov down")
    );

    const bundle = await runRetrieval(mockIntent);

    expect(bundle.publications).toHaveLength(3);
    expect(bundle.trials).toHaveLength(0);
    expect(bundle.retrievalErrors.some((e) => e.source === "clinicaltrials")).toBe(true);
    expect(bundle.retrievalErrors.some((e) => e.source === "openalex")).toBe(false);
    expect(bundle.retrievalErrors.some((e) => e.source === "pubmed")).toBe(false);
  });
});
