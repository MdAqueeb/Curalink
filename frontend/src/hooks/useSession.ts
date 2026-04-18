import { useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { researchApi } from "@/api/research";
import type { LocalSession, StoredTurn } from "@/types/api";

const INDEX_KEY = "curalink_sessions";
const turnsKey = (id: string) => `curalink_turns_${id}`;

function readIndex(): LocalSession[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as LocalSession[];
  } catch {
    return [];
  }
}

function readTurns(sessionId: string): StoredTurn[] {
  try {
    return JSON.parse(localStorage.getItem(turnsKey(sessionId)) ?? "[]") as StoredTurn[];
  } catch {
    return [];
  }
}

export function useSessionHistory(id: string | null) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => researchApi.getSession(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useDeleteSession() {
  return useMutation({ mutationFn: researchApi.deleteSession });
}

export function useLocalSessions() {
  const [sessions, setSessions] = useState<LocalSession[]>(readIndex);

  const addSession = useCallback((session: LocalSession) => {
    setSessions((prev) => {
      const next = [session, ...prev.filter((s) => s.sessionId !== session.sessionId)].slice(0, 20);
      localStorage.setItem(INDEX_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.sessionId !== sessionId);
      localStorage.setItem(INDEX_KEY, JSON.stringify(next));
      localStorage.removeItem(turnsKey(sessionId));
      return next;
    });
  }, []);

  const saveTurns = useCallback((sessionId: string, turns: StoredTurn[]) => {
    const capped = turns.slice(-10);
    localStorage.setItem(turnsKey(sessionId), JSON.stringify(capped));
  }, []);

  const loadTurns = useCallback((sessionId: string): StoredTurn[] => {
    return readTurns(sessionId);
  }, []);

  return { sessions, addSession, removeSession, saveTurns, loadTurns };
}
