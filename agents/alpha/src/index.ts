import { connectMcp, callTool } from "./mcp.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "alpha";

async function main() {
  console.log(`[${AGENT_NAME}] Starting initiator agent`);

  const client = await connectMcp(AGENT_NAME);

  // Step 1: Create a thread with bravo as participant
  console.log(`[${AGENT_NAME}] Creating thread with bravo...`);
  const threadResult = await callTool(client, "coral_create_thread", {
    threadName: "ping-pong",
    participantNames: ["bravo"],
  }) as { thread?: { id: string } };
  const threadId = threadResult.thread?.id;
  console.log(`[${AGENT_NAME}] Thread created: ${threadId}`);

  if (!threadId) {
    console.error(`[${AGENT_NAME}] Failed to get thread ID`);
    process.exit(1);
  }

  // Step 2: Send "ping" mentioning bravo
  console.log(`[${AGENT_NAME}] Sending ping...`);
  await callTool(client, "coral_send_message", {
    threadId,
    content: "ping",
    mentions: ["bravo"],
  });

  // Step 3: Wait for bravo's response
  console.log(`[${AGENT_NAME}] Waiting for response...`);
  const response = await callTool(client, "coral_wait_for_message", {}) as {
    message?: { senderName: string; text: string };
  };

  if (response.message) {
    console.log(
      `[${AGENT_NAME}] Received from ${response.message.senderName}: ${response.message.text}`
    );
  } else {
    console.log(`[${AGENT_NAME}] No response received`);
  }

  // Step 4: Close the session
  console.log(`[${AGENT_NAME}] Closing session...`);
  await callTool(client, "coral_close_session", {});
  console.log(`[${AGENT_NAME}] Done.`);
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal error:`, err);
  process.exit(1);
});
