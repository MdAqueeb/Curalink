import { Link, useNavigate } from "react-router";
import { useMe, useLogout } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useResearch";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function HealthDot() {
  const { data } = useHealth();
  const isUp = data?.status === "ok";
  const ollamaUp = data?.ollama === "up";

  return (
    <span
      title={
        data
          ? `Mongo: ${data.mongo} · Ollama: ${data.ollama}`
          : "Checking health…"
      }
      className="flex items-center gap-1.5 text-xs text-slate-500"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          !data ? "bg-slate-300" :
          isUp && ollamaUp ? "bg-green-500" :
          isUp ? "bg-amber-500" : "bg-red-500"
        )}
      />
      {data ? (ollamaUp ? "AI online" : "AI offline") : "Connecting…"}
    </span>
  );
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-10">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <Link to="/research" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <span className="font-semibold text-slate-900 text-sm">Curalink</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <HealthDot />
        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-600">{user.name}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        ) : (
          <Link to="/login">
            <Button variant="secondary" size="sm">Sign in</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
