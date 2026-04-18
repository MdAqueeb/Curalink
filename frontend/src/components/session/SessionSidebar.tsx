import { cn, relativeTime, truncate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useDeleteSession } from "@/hooks/useSession";
import type { LocalSession } from "@/types/api";

interface SessionSidebarProps {
  sessions: LocalSession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onDelete: (sessionId: string) => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
}: SessionSidebarProps) {
  const deleteMutation = useDeleteSession();

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteMutation.mutateAsync(sessionId);
    onDelete(sessionId);
  };

  return (
    <aside className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      <div className="p-3 border-b border-slate-200">
        <Button variant="secondary" size="sm" onClick={onNew} className="w-full justify-start gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New research
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8 px-4">
            Your research sessions will appear here.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.sessionId}
              onClick={() => onSelect(s.sessionId)}
              className={cn(
                "group flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors mx-1 rounded-lg",
                activeSessionId === s.sessionId && "bg-white border border-slate-200 shadow-sm"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">
                  {s.disease || "Research session"}
                </p>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {truncate(s.snippet, 50)}
                </p>
                <p className="text-xs text-slate-300 mt-1">{relativeTime(s.createdAt)}</p>
              </div>
              <button
                onClick={(e) => handleDelete(e, s.sessionId)}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-all"
                aria-label="Delete session"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
