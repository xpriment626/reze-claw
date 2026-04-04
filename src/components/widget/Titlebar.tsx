import { useState } from "react";
import { startDragging, toggleAlwaysOnTop } from "@/shared/tauri";

interface TitlebarProps {
  onExpand: () => void;
}

export function Titlebar({ onExpand }: TitlebarProps) {
  const [pinned, setPinned] = useState(false);

  const handlePin = async () => {
    const next = !pinned;
    setPinned(next);
    try {
      await toggleAlwaysOnTop(next);
    } catch {
      // browser dev mode
    }
  };

  const handleDragStart = async (e: React.MouseEvent) => {
    // Only drag from the bar itself, not from buttons
    if ((e.target as HTMLElement).closest("button")) return;
    try {
      await startDragging();
    } catch {
      // browser dev mode
    }
  };

  return (
    <div
      onMouseDown={handleDragStart}
      className="flex items-center justify-between px-3 py-2 bg-claw-900/80 backdrop-blur-sm border-b border-claw-700/50 cursor-grab active:cursor-grabbing"
    >
      <span className="text-xs font-medium text-claw-400 tracking-wider uppercase pointer-events-none select-none">
        RezeClaw
      </span>
      <div className="flex items-center gap-1">
        {/* Pin toggle */}
        <button
          onClick={handlePin}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
            pinned
              ? "bg-accent/20 text-accent-light"
              : "text-claw-400 hover:text-claw-100 hover:bg-claw-700"
          }`}
          title={pinned ? "Unpin from top" : "Pin to top"}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill={pinned ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 1v7" />
            <path d="M3 4l3 4 3-4" />
            <path d="M2 11h8" />
          </svg>
        </button>
        {/* Expand to dashboard */}
        <button
          onClick={onExpand}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-claw-700 transition-colors text-claw-400 hover:text-claw-100"
          title="Open dashboard"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 5L7 2L12 5" />
            <path d="M2 9L7 12L12 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
