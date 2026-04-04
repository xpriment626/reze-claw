import { useState } from "react";
import { startDragging } from "@/shared/tauri";

interface SidebarProps {
  onCollapse: () => void;
}

type Tab = "agents" | "config" | "logs";

export function Sidebar({ onCollapse }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("agents");

  const tabs: { id: Tab; label: string }[] = [
    { id: "agents", label: "Agents" },
    { id: "config", label: "Config" },
    { id: "logs", label: "Logs" },
  ];

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
            onClick={() => setActiveTab(tab.id)}
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
      <div className="px-3 py-3 border-t border-claw-700/50">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-claw-500" />
          <span className="text-[10px] text-claw-500">Coral: disconnected</span>
        </div>
      </div>
    </div>
  );
}
