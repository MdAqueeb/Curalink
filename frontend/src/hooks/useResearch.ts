import { useMutation, useQuery } from "@tanstack/react-query";
import { researchApi } from "@/api/research";
import type { FollowupRequest, ResearchRequest } from "@/types/api";

export function useResearch() {
  return useMutation({
    mutationFn: (body: ResearchRequest) => researchApi.query(body),
  });
}

export function useFollowup() {
  return useMutation({
    mutationFn: (body: FollowupRequest) => researchApi.followup(body),
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: researchApi.health,
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
  });
}
