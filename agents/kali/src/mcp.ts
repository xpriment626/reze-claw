import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function connectMcp(agentName: string): Promise<Client> {
  const connectionUrl = process.env.CORAL_CONNECTION_URL;
  if (!connectionUrl) {
    throw new Error("CORAL_CONNECTION_URL not set");
  }

  console.log(`[${agentName}] Connecting to Coral MCP at ${connectionUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(connectionUrl));
  const client = new Client(
    { name: agentName, version: "0.1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log(`[${agentName}] MCP connected`);

  return client;
}

export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const result = await client.callTool({ name: toolName, arguments: args });
  if (result.content && Array.isArray(result.content)) {
    const textParts = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text);
    if (textParts.length === 1) {
      try {
        return JSON.parse(textParts[0]);
      } catch {
        return textParts[0];
      }
    }
    return textParts.join("\n");
  }
  return result;
}
