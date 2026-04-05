import type { WaitForMessageOutput, SendMessageOutput } from "@rezeclaw/coral-types/tools";
import { generate } from "./generate.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "kali";

/**
 * Coral mode — launched by Coral server with CORAL_CONNECTION_URL set.
 * REPLICATE_API_TOKEN is provided by Coral as an agent option (env var).
 * Do NOT load .env files during orchestration.
 */
async function coralMode() {
  const { connectMcp, callTool } = await import("./mcp.js");

  console.log(`[${AGENT_NAME}] Starting in Coral mode`);
  const client = await connectMcp(AGENT_NAME);

  // Wait for someone to mention us with a prompt
  console.log(`[${AGENT_NAME}] Waiting for mention...`);
  const { message } = (await callTool(
    client,
    "coral_wait_for_mention",
    {}
  )) as WaitForMessageOutput;

  if (!message) {
    console.log(`[${AGENT_NAME}] No message received`);
    return;
  }

  console.log(`[${AGENT_NAME}] Received from ${message.senderName}: ${message.text}`);

  // Generate the image
  console.log(`[${AGENT_NAME}] Generating image...`);
  const url = await generate(message.text);
  console.log(`[${AGENT_NAME}] Generated: ${url}`);

  // Send the result back on the same thread
  (await callTool(client, "coral_send_message", {
    threadId: message.threadId,
    content: url,
    mentions: [message.senderName],
  })) as SendMessageOutput;

  console.log(`[${AGENT_NAME}] Done.`);
}

/**
 * Standalone mode — no Coral server, runs from CLI args.
 * Loads .env for REPLICATE_API_TOKEN.
 */
async function standaloneMode() {
  const { loadEnv } = await import("./env.js");
  loadEnv();

  const prompt = process.argv[2];
  if (!prompt) {
    console.log("[Kali] Image generation agent — standing by");
    console.log("[Kali] CLI usage: npx tsx src/index.ts '<prompt>'");
    return;
  }

  console.log(`[Kali] Generating: "${prompt}"`);
  const url = await generate(prompt);
  console.log(`[Kali] Output: ${url}`);
}

// Route to the appropriate mode
const isCoralMode = !!process.env.CORAL_CONNECTION_URL;

if (isCoralMode) {
  coralMode().catch((err) => {
    console.error(`[${AGENT_NAME}] Fatal error:`, err);
    process.exit(1);
  });
} else {
  standaloneMode().catch(console.error);
}
