import { env } from "../../config/env.js";
import type { Trial } from "../../types/domain.js";
import { logger } from "../../utils/logger.js";

const REQUEST_TIMEOUT = 10_000;

interface CtStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      primaryCompletionDateStruct?: { date?: string };
    };
    descriptionModule?: { briefSummary?: string };
    designModule?: { phases?: string[]; enrollmentInfo?: { count?: number } };
  };
}

interface CtResponse {
  studies?: CtStudy[];
}

export async function fetchClinicalTrials(
  disease: string,
  concept: string,
  maxResults: number = env.CT_MAX_RESULTS
): Promise<Trial[]> {
  const term = [disease, concept].filter(Boolean).join(" ").trim();
  if (!term) return [];

  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.term", term);
  url.searchParams.set("filter.overallStatus", "RECRUITING,COMPLETED,ACTIVE_NOT_RECRUITING");
  url.searchParams.set("pageSize", String(Math.min(maxResults, 100)));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      logger.warn("ClinicalTrials non-2xx", { status: res.status });
      return [];
    }
    const data = (await res.json()) as CtResponse;
    return (data.studies ?? []).map(normalizeTrial).filter((t): t is Trial => Boolean(t));
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTrial(study: CtStudy): Trial | null {
  const p = study.protocolSection;
  const id = p?.identificationModule;
  const status = p?.statusModule;
  const desc = p?.descriptionModule;
  const design = p?.designModule;
  if (!id?.nctId) return null;
  return {
    source: "clinicaltrials",
    id: `nct:${id.nctId}`,
    nctId: id.nctId,
    title: id.briefTitle ?? "",
    summary: desc?.briefSummary ?? "",
    status: status?.overallStatus ?? "UNKNOWN",
    phase: design?.phases?.join(", ") ?? "N/A",
    startDate: status?.startDateStruct?.date ?? null,
    completionDate: status?.primaryCompletionDateStruct?.date ?? null,
    enrollment: design?.enrollmentInfo?.count ?? null,
    url: `https://clinicaltrials.gov/study/${id.nctId}`,
  };
}
