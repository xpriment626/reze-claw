import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { AgentsPanel } from "./AgentsPanel";
import { SessionsPanel } from "./SessionsPanel";
import { SessionDetailView } from "./SessionDetailView";
import { SceneView } from "../widget/SceneView";
import { ChatInput } from "../widget/ChatInput";

interface DashboardViewProps {
  onCollapse: () => void;
}

export function DashboardView({ onCollapse }: DashboardViewProps) {
  const handleSend = (message: string) => {
    console.log("[RezeClaw] User:", message);
  };

  return (
    <div className="h-screen flex">
      <Sidebar onCollapse={onCollapse} />

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Widget preview (left) */}
        <div className="w-80 flex flex-col border-r border-claw-700/50">
          <SceneView />
          <ChatInput onSend={handleSend} />
        </div>

        {/* Dashboard panels (right) — routed */}
        <div className="flex-1 bg-claw-950 overflow-y-auto">
          <Routes>
            <Route path="/agents" element={<AgentsPanel />} />
            <Route path="/config" element={<Placeholder label="Config" />} />
            <Route path="/sessions" element={<SessionsPanel />} />
            <Route path="/sessions/:namespace/:sessionId" element={<SessionDetailView />} />
            <Route path="/logs" element={<Placeholder label="Logs" />} />
            <Route path="*" element={<Navigate to="/agents" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-claw-100 mb-1">{label}</h2>
      <p className="text-sm text-claw-500">Coming soon</p>
    </div>
  );
}
