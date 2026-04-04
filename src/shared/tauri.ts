import { invoke } from "@tauri-apps/api/core";

export async function expandWindow() {
  return invoke("expand_window");
}

export async function collapseWindow() {
  return invoke("collapse_window");
}

export async function toggleAlwaysOnTop(pinned: boolean) {
  return invoke("toggle_always_on_top", { pinned });
}

export async function startDragging() {
  return invoke("start_dragging");
}
