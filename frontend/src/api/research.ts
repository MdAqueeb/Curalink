import axios from "axios";
import { apiClient } from "./client";
import type {
  FollowupRequest,
  HealthStatus,
  ResearchRequest,
  ResearchResponse,
  SessionHistory,
} from "@/types/api";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

function extractPartial503(err: unknown): ResearchResponse | null {
  if (axios.isAxiosError(err) && err.response?.status === 503) {
    const body = err.response.data as ApiEnvelope<ResearchResponse> | undefined;
    if (body?.data?.sessionId) return body.data;
  }
  return null;
}

export const researchApi = {
  async query(body: ResearchRequest): Promise<{ data: ResearchResponse; sessionId: string }> {
    try {
      const res = await apiClient.post<ApiEnvelope<ResearchResponse>>("/research", body);
      const sessionId =
        (res.headers["x-session-id"] as string | undefined) ?? res.data.data.sessionId;
      return { data: res.data.data, sessionId };
    } catch (err) {
      const partial = extractPartial503(err);
      if (partial) {
        const sessionId =
          (axios.isAxiosError(err) &&
            (err.response?.headers?.["x-session-id"] as string | undefined)) ||
          partial.sessionId;
        return { data: partial, sessionId };
      }
      throw err;
    }
  },

  async followup(body: FollowupRequest): Promise<{ data: ResearchResponse }> {
    try {
      const res = await apiClient.post<ApiEnvelope<ResearchResponse>>("/followup", body);
      return { data: res.data.data };
    } catch (err) {
      const partial = extractPartial503(err);
      if (partial) return { data: partial };
      throw err;
    }
  },

  getSession(id: string): Promise<SessionHistory> {
    return apiClient
      .get<ApiEnvelope<SessionHistory>>(`/session/${id}`)
      .then((r) => r.data.data);
  },

  deleteSession(id: string): Promise<void> {
    return apiClient.delete(`/session/${id}`).then(() => undefined);
  },

  health(): Promise<HealthStatus> {
    return apiClient.get<HealthStatus>("/health").then((r) => r.data);
  },
};
