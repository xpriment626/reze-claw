import { Sidebar } from "./Sidebar";
import { AgentsPanel } from "./AgentsPanel";
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

        {/* Dashboard panels (right) */}
        <div className="flex-1 bg-claw-950 overflow-y-auto">
          <AgentsPanel />
        </div>
      </div>
    </div>
  );
}
