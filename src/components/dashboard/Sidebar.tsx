import { useNavigate, useLocation } from "react-router-dom";
import { startDragging } from "@/shared/tauri";
import { useRezeHealth } from "@/shared/use-reze";

interface SidebarProps {
  onCollapse: () => void;
}

type Tab = "agents" | "config" | "sessions" | "logs";

const tabs: { id: Tab; label: string; path: string }[] = [
  { id: "agents", label: "Agents", path: "/agents" },
  { id: "config", label: "Config", path: "/config" },
  { id: "sessions", label: "Sessions", path: "/sessions" },
  { id: "logs", label: "Logs", path: "/logs" },
];

export function Sidebar({ onCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const health = useRezeHealth();

  const activeTab = tabs.find((t) => location.pathname.startsWith(t.path))?.id ?? "agents";
  const coralStatus = health?.coral ?? "disconnected";
  const rezeStatus = health ? "connected" : "disconnected";

  const handleDragStart = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    try {
      await startDragging();
    } catch {
      // browser dev mode
    }
  };

  return (
    <div className="w-48 bg-claw-900 border-r border-claw-700/50 flex flex-col">
      {/* Header with collapse button */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-3 py-3 border-b border-claw-700/50 cursor-grab active:cursor-grabbing"
      >
        <span className="text-xs font-medium text-claw-400 tracking-wider uppercase pointer-events-none select-none">
          RezeClaw
        </span>
        <button
          onClick={onCollapse}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-claw-700 transition-colors text-claw-400 hover:text-claw-100"
          title="Collapse to widget"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M9 3L6 6L3 3" />
            <path d="M9 7L6 10L3 7" />
          </svg>
        </button>
      </div>

      {/* Navigation tabs */}
      <nav className="flex-1 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? "text-claw-100 bg-claw-800"
                : "text-claw-400 hover:text-claw-200 hover:bg-claw-800/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Status footer */}
      <div className="px-3 py-3 border-t border-claw-700/50 space-y-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${rezeStatus === "connected" ? "bg-emerald-400" : "bg-claw-500"}`} />
          <span className="text-[10px] text-claw-500">Reze: {rezeStatus}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${coralStatus === "connected" ? "bg-emerald-400" : "bg-claw-500"}`} />
          <span className="text-[10px] text-claw-500">Coral: {coralStatus}</span>
        </div>
      </div>
    </div>
  );
}
