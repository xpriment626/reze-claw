import { useNavigate } from "react-router-dom";
import { useSessions, type RezeSession } from "@/shared/use-reze";

function StatusIndicator({ status }: { status?: string }) {
  const config =
    status === "executed" || status === "running"
      ? { color: "bg-emerald-400 animate-pulse", label: "running" }
      : status === "completed"
        ? { color: "bg-claw-400", label: "completed" }
        : status === "failed" || status === "error"
          ? { color: "bg-red-400", label: "failed" }
          : { color: "bg-claw-500", label: status ?? "unknown" };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-claw-500 capitalize">{config.label}</span>
    </div>
  );
}

export function SessionsPanel() {
  const { sessions, loading } = useSessions();
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-claw-100 mb-1">Sessions</h2>
      <p className="text-sm text-claw-500 mb-6">
        Active and past Coral sessions
      </p>

      {loading && sessions.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">No sessions. Create one through Reze chat.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={`${session.namespace}/${session.id}`}
              onClick={() => navigate(`/sessions/${session.namespace}/${session.id}`)}
              className="w-full text-left p-3 rounded-lg bg-claw-800/50 border border-claw-700/30 hover:bg-claw-800 hover:border-claw-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-claw-100 font-mono">
                  {session.id.slice(0, 8)}...
                </span>
                <StatusIndicator status={session.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-claw-500">{session.namespace}</span>
                {session.timestamp && (
                  <span className="text-xs text-claw-600">
                    {new Date(session.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
