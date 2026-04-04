import { readFileSync } from "fs";
import path from "path";

export function loadEnv() {
  // Walk up from agents/kali/src to find the project root .env
  const candidates = [
    path.resolve(import.meta.dirname, "../../../.env"),
    path.resolve(import.meta.dirname, "../.env"),
  ];

  for (const envPath of candidates) {
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    } catch {
      // file not found, try next
    }
  }
}
