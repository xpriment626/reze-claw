import { loadEnv } from "./env";
loadEnv();

export { generate } from "./generate";
export type { GenerateOptions, AspectRatio, Resolution } from "./generate";

// Agent entry point — will be wired to:
// 1. LLM brain (Grok 4.1 / GPT-5.4-mini) for interpreting user intent
// 2. Coral MCP for receiving tasks from other agents and reporting results
// 3. Tool call interface for the gateway agent to invoke directly
//
// For now, supports standalone CLI usage:
//   npx tsx src/index.ts '<prompt>'

async function main() {
  const { generate } = await import("./generate");

  const prompt = process.argv[2];
  if (!prompt) {
    console.log("[Kali] Image generation agent — standing by");
    console.log("[Kali] CLI usage: npx tsx src/index.ts '<prompt>'");
    console.log("[Kali] Awaiting Coral connection...");
    return;
  }

  console.log(`[Kali] Generating: "${prompt}"`);
  const url = await generate(prompt);
  console.log(`[Kali] Output: ${url}`);
}

main().catch(console.error);
