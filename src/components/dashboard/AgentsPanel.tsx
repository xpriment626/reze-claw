import { useAgents, type RezeAgent } from "@/shared/use-reze";

function StatusDot({ status }: { status?: string }) {
  const color =
    status === "running" || status === "active"
      ? "bg-emerald-400 animate-pulse"
      : status === "error"
        ? "bg-red-400"
        : "bg-claw-500";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

export function AgentsPanel() {
  const { agents, loading } = useAgents();

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-claw-100 mb-1">Agents</h2>
      <p className="text-sm text-claw-500 mb-6">
        Registered agents in the Coral server
      </p>

      {loading && agents.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">No agents registered. Start Coral server and register agents.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: RezeAgent }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-claw-800/50 border border-claw-700/30">
      <div className="flex items-center gap-3">
        <StatusDot status={agent.status} />
        <div>
          <div className="text-sm font-medium text-claw-100">{agent.name}</div>
          {agent.version && (
            <div className="text-xs text-claw-500">{agent.version}</div>
          )}
        </div>
      </div>
      <span className="text-xs text-claw-500 capitalize">
        {agent.status ?? "registered"}
      </span>
    </div>
  );
}
