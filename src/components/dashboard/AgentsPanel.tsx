const MOCK_AGENTS = [
  { id: "kali", name: "Kali", type: "Image Gen (Replicate)", status: "idle" as const },
];

function StatusDot({ status }: { status: "idle" | "active" | "error" }) {
  const colors = {
    idle: "bg-claw-500",
    active: "bg-emerald-400 animate-pulse",
    error: "bg-red-400",
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status]}`} />;
}

export function AgentsPanel() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-claw-100 mb-1">Agents</h2>
      <p className="text-sm text-claw-500 mb-6">
        Registered agents and Coral sessions
      </p>

      <div className="space-y-2">
        {MOCK_AGENTS.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center justify-between p-3 rounded-lg bg-claw-800/50 border border-claw-700/30"
          >
            <div className="flex items-center gap-3">
              <StatusDot status={agent.status} />
              <div>
                <div className="text-sm font-medium text-claw-100">
                  {agent.name}
                </div>
                <div className="text-xs text-claw-500">{agent.type}</div>
              </div>
            </div>
            <span className="text-xs text-claw-500 capitalize">
              {agent.status}
            </span>
          </div>
        ))}

        {/* Add agent placeholder */}
        <button className="w-full p-3 rounded-lg border border-dashed border-claw-700/50 text-sm text-claw-500 hover:text-claw-300 hover:border-claw-600 transition-colors">
          + Register agent
        </button>
      </div>

      {/* Coral sessions section */}
      <h3 className="text-sm font-medium text-claw-300 mt-8 mb-3">
        Coral Sessions
      </h3>
      <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
        <p className="text-xs text-claw-500">No active sessions</p>
      </div>
    </div>
  );
}
