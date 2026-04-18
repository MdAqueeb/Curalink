import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Header } from "@/components/layout/Header";
import { QueryForm, type QueryFormData } from "@/components/research/QueryForm";
import { ResultSkeleton } from "@/components/research/ResultSkeleton";
import { SessionSidebar } from "@/components/session/SessionSidebar";
import { SessionMessage } from "@/components/session/SessionMessage";
import { EmptyState } from "@/components/session/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { useResearch, useFollowup } from "@/hooks/useResearch";
import { useLocalSessions } from "@/hooks/useSession";
import { parseAxiosError } from "@/lib/utils";
import type { ResearchResponse, StoredTurn } from "@/types/api";

export default function ResearchPage() {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(urlSessionId ?? null);
  const [turns, setTurns] = useState<StoredTurn[]>([]);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { sessions, addSession, removeSession, saveTurns, loadTurns } = useLocalSessions();
  const research = useResearch();
  const followup = useFollowup();
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoading = research.isPending || followup.isPending;

  // Load stored turns when URL session changes
  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
      const stored = loadTurns(urlSessionId);
      setTurns(stored);
      setError(null);
    }
  }, [urlSessionId, currentSessionId, loadTurns]);

  // Scroll to bottom on new turn
  useEffect(() => {
    if (turns.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [turns.length]);

  const handleSubmit = async (formData: QueryFormData) => {
    const userMessage =
      formData.message ||
      [formData.disease, formData.query].filter(Boolean).join(" — ") ||
      "Research query";

    setError(null);
    setPendingQuery(userMessage);

    try {
      let response: ResearchResponse;
      let resolvedSessionId = currentSessionId;

      if (!currentSessionId) {
        const result = await research.mutateAsync({
          message: formData.message || undefined,
          disease: formData.disease || undefined,
          query: formData.query || undefined,
          queryType: formData.queryType,
          mode: formData.mode,
          userAge: formData.userAge,
        });
        response = result.data;
        resolvedSessionId = result.sessionId;
        setCurrentSessionId(resolvedSessionId);
        navigate(`/research/${resolvedSessionId}`, { replace: true });

        addSession({
          sessionId: resolvedSessionId,
          disease: response.conditionOverview.disease,
          snippet: userMessage,
          createdAt: new Date().toISOString(),
        });
      } else {
        const result = await followup.mutateAsync({
          message: formData.message || undefined,
          disease: formData.disease || undefined,
          query: formData.query || undefined,
          queryType: formData.queryType,
          mode: formData.mode,
          userAge: formData.userAge,
          sessionId: currentSessionId,
        });
        response = result.data;
      }

      const newTurn: StoredTurn = {
        userMessage,
        response,
        timestamp: new Date().toISOString(),
      };

      const updatedTurns = [...turns, newTurn];
      setTurns(updatedTurns);
      if (resolvedSessionId) saveTurns(resolvedSessionId, updatedTurns);
    } catch (err) {
      setError(parseAxiosError(err));
    } finally {
      setPendingQuery(null);
    }
  };

  const handlePromptClick = (prompt: string) => {
    handleSubmit({
      message: prompt,
      disease: "",
      query: "",
      queryType: "general",
      mode: "standard",
      userAge: undefined,
    });
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
    setTurns([]);
    setError(null);
    setPendingQuery(null);
    navigate("/research", { replace: true });
    setSidebarOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    const stored = loadTurns(sessionId);
    setCurrentSessionId(sessionId);
    setTurns(stored);
    setError(null);
    setPendingQuery(null);
    navigate(`/research/${sessionId}`, { replace: true });
    setSidebarOpen(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    removeSession(sessionId);
    if (sessionId === currentSessionId) handleNewSession();
  };

  return (
    <div className="flex flex-col h-screen bg-muted overflow-hidden">
      <Header onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
            fixed md:relative z-30 md:z-auto inset-y-0 left-0 w-64
            transform transition-transform duration-200 md:transform-none
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            flex flex-col h-full
          `}
        >
          <SessionSidebar
            sessions={sessions}
            activeSessionId={currentSessionId}
            onSelect={handleSelectSession}
            onNew={handleNewSession}
            onDelete={handleDeleteSession}
          />
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6">
              {turns.length === 0 && !pendingQuery ? (
                <EmptyState onPromptClick={handlePromptClick} />
              ) : (
                <>
                  {turns.map((turn, i) => (
                    <SessionMessage key={i} turn={turn} />
                  ))}

                  {pendingQuery && (
                    <div className="mb-8">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="shrink-0 h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center">
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div className="bg-brand-600 text-white rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-xl">
                          {pendingQuery}
                        </div>
                      </div>
                      <div className="ml-10">
                        <ResultSkeleton />
                      </div>
                    </div>
                  )}

                  {error && (
                    <Alert variant="error" className="mb-4">
                      {error}
                    </Alert>
                  )}
                </>
              )}
              <div ref={bottomRef} />
            </div>
          </main>

          <QueryForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
            hasSession={Boolean(currentSessionId)}
          />
        </div>
      </div>
    </div>
  );
}
