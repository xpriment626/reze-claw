import { connectMcp, callTool } from "./mcp.js";
import type { WaitForMessageOutput, SendMessageOutput } from "@rezeclaw/coral-types/tools";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "bravo";

async function main() {
  console.log(`[${AGENT_NAME}] Starting responder agent`);

  const client = await connectMcp(AGENT_NAME);

  // Step 1: Wait for someone to mention us
  console.log(`[${AGENT_NAME}] Waiting for mention...`);
  const { message } = await callTool(client, "coral_wait_for_mention", {}) as WaitForMessageOutput;

  if (!message) {
    console.log(`[${AGENT_NAME}] No message received`);
    return;
  }

  console.log(
    `[${AGENT_NAME}] Received from ${message.senderName}: ${message.text}`
  );

  // Step 2: Send "pong" back on the same thread
  console.log(`[${AGENT_NAME}] Sending pong...`);
  await callTool(client, "coral_send_message", {
    threadId: message.threadId,
    content: "pong",
    mentions: [message.senderName],
  }) as SendMessageOutput;

  console.log(`[${AGENT_NAME}] Done.`);
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal error:`, err);
  process.exit(1);
});
