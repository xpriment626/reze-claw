import { useState, useCallback } from "react";
import { expandWindow, collapseWindow } from "./tauri";

export type AppMode = "widget" | "dashboard";

export function useAppMode() {
  const [mode, setMode] = useState<AppMode>("widget");

  const expand = useCallback(async () => {
    try {
      await expandWindow();
    } catch {
      // In browser dev mode (no Tauri), just switch view
    }
    setMode("dashboard");
  }, []);

  const collapse = useCallback(async () => {
    try {
      await collapseWindow();
    } catch {
      // In browser dev mode (no Tauri), just switch view
    }
    setMode("widget");
  }, []);

  return { mode, expand, collapse };
}
