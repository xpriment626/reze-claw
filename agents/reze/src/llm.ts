import OpenAI from "openai";

if (!process.env.XAI_API_KEY) {
  console.warn("[Reze] WARNING: XAI_API_KEY not set — chat will be unavailable");
}

export const llm = new OpenAI({
  apiKey: process.env.XAI_API_KEY ?? "",
  baseURL: "https://api.x.ai/v1",
  timeout: 120_000,
});

export const REZE_MODEL = "grok-4-1-fast-reasoning";

export const REZE_SYSTEM_PROMPT = `You are Reze, a lightweight AI gateway agent. You're friendly and concise.
You can run multi-agent workflows when asked. Right now you have one available:
a ping-pong test between two agents (Alpha and Bravo) that validates the message-passing pipeline.
When you trigger a workflow, tell the user to check the dashboard to watch it live.`;
