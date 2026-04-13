import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { sign, createPrivateKey } from "node:crypto";

const BRAIN_API = "http://localhost:3200/api/v1/memory";
const MINDSPACE_API = process.env.MINDSPACE_API_URL || "http://localhost:3101";
const MCP_PORT = parseInt(process.env.MCP_PORT || "3201", 10);

// Per-user auth: MCP passes the client's Bearer token through to brain API.
// No hardcoded API key — each user authenticates with their Mindspace API key.

// --- Mindspace A2A connection (MCP server authenticates as service agent) ---
let mindspaceToken: string | null = null;
let mindspaceAgentId: string | null = null;

async function connectToMindspace(): Promise<void> {
  const keyPath = process.env.MCP_KEY_FILE || join(homedir(), ".xp0", "keys", "mcp-service.json");
  let keyData: { key_id: string; private_key: string; server?: string };
  try {
    keyData = JSON.parse(readFileSync(keyPath, "utf-8"));
  } catch {
    console.warn(`[MCP] No service key at ${keyPath} — mindspace tools unavailable`);
    return;
  }

  const apiUrl = keyData.server || MINDSPACE_API;

  // Step 1: send connect with key_id → get CHALLENGE
  const connectRes = await fetch(`${apiUrl}/a2a/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: { agent_name: "hive-mcp-service", key_id: keyData.key_id },
      role: { current: "orchestrator" },
      project: { slug: "xpollination-mindspace" },
      state: { status: "active" },
      metadata: { client: "hive-mcp" },
    }),
  });
  const connectData = await connectRes.json() as any;

  if (connectData.type === "CHALLENGE") {
    // Step 2: sign nonce with Ed25519 private key
    const privateKey = createPrivateKey(keyData.private_key);
    const nonce = Buffer.from(connectData.nonce, "base64");
    const signature = sign(null, nonce, privateKey);

    const authRes = await fetch(`${apiUrl}/a2a/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: { agent_name: "hive-mcp-service", key_id: keyData.key_id },
        role: { current: "orchestrator" },
        project: { slug: "xpollination-mindspace" },
        state: { status: "active" },
        metadata: { client: "hive-mcp" },
        challenge_response: { signature: signature.toString("base64") },
      }),
    });
    const authData = await authRes.json() as any;
    if (authData.type === "ERROR") throw new Error(`A2A auth failed: ${authData.error}`);
    mindspaceToken = authData.session_token;
    mindspaceAgentId = authData.agent_id;
    console.log(`[MCP] Connected to Mindspace: agent_id=${mindspaceAgentId}`);
  } else if (connectData.session_token) {
    // Direct welcome (API key auth fallback)
    mindspaceToken = connectData.session_token;
    mindspaceAgentId = connectData.agent_id;
    console.log(`[MCP] Connected to Mindspace (direct): agent_id=${mindspaceAgentId}`);
  } else {
    console.warn(`[MCP] Mindspace connect failed:`, connectData.error || "unknown");
  }
}

async function callMindspace(body: Record<string, unknown>): Promise<any> {
  if (!mindspaceToken) {
    try { await connectToMindspace(); } catch (e) {
      throw new Error(`Mindspace not available: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!mindspaceToken) throw new Error("Mindspace not connected — register service key first");

  const res = await fetch(`${MINDSPACE_API}/a2a/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${mindspaceToken}` },
    body: JSON.stringify({ ...body, agent_id: mindspaceAgentId || "mcp-hive" }),
  });
  const data = await res.json() as any;

  // Reconnect on expired token
  if (data.error === "Invalid session" || data.error === "Token expired" || res.status === 401) {
    mindspaceToken = null;
    await connectToMindspace();
    return callMindspace(body); // retry once
  }
  return data;
}

async function callBrain(prompt: string, bearerToken: string, context?: string, session_id?: string, full_content?: boolean, read_only?: boolean): Promise<unknown> {
  const body: Record<string, unknown> = { prompt, agent_id: "mcp-client", agent_name: "MCP Client" };
  if (context) body.context = context;
  if (session_id) body.session_id = session_id;
  if (full_content) body.full_content = true;
  if (read_only) body.read_only = true;

  const res = await fetch(BRAIN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brain API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function getThought(thought_id: string, bearerToken: string): Promise<unknown> {
  const res = await fetch(`${BRAIN_API}/thought/${thought_id}`, {
    headers: { "Authorization": `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brain API error ${res.status}: ${err}`);
  }
  return res.json();
}

function createMcpServer(bearerToken: string): McpServer {
  const mcp = new McpServer(
    { name: "xpollination-brain", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  mcp.tool(
    "query_brain",
    "Query the shared agent brain for knowledge on a topic. Returns matching thoughts with sources and high-traffic knowledge paths.",
    {
      prompt: z.string().describe("Natural language question or topic to search"),
      context: z.string().optional().describe("What you are currently working on — changes retrieval direction"),
      session_id: z.string().optional().describe("Reuse from previous call for conversation continuity"),
      include_full_content: z.boolean().optional().describe("When true, sources include full content instead of 80-char preview"),
      read_only: z.boolean().optional().describe("When true, query is not persisted as a thought — use for research sessions to avoid noise"),
    },
    async ({ prompt, context, session_id, include_full_content, read_only }) => {
      const data = await callBrain(prompt, bearerToken, context, session_id, include_full_content ?? undefined, read_only ?? undefined) as Record<string, unknown>;
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  mcp.tool(
    "contribute_to_brain",
    "Contribute a strategic thought or learning to the shared agent brain. Must be >50 chars and a declarative statement (not a question).",
    {
      prompt: z.string().min(51).describe("Declarative statement to store as knowledge (>50 chars, not a question)"),
      context: z.string().optional().describe("What you are currently working on — stored as provenance"),
      session_id: z.string().optional().describe("Reuse from previous call for conversation continuity"),
    },
    async ({ prompt, context, session_id }) => {
      const data = await callBrain(prompt, bearerToken, context, session_id) as Record<string, unknown>;
      const trace = data.trace as Record<string, unknown> | undefined;
      const contributed = (trace?.thoughts_contributed as number) ?? 0;
      const prefix = contributed > 0
        ? "Thought stored successfully."
        : "Not stored (too short or interrogative). Still retrieved related thoughts:";
      return { content: [{ type: "text" as const, text: `${prefix}\n\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  mcp.tool(
    "drill_down_thought",
    "Retrieve the full content of a specific thought by its ID. Use after query_brain to read complete thoughts beyond the 80-char preview.",
    {
      thought_id: z.string().describe("The thought_id to retrieve"),
    },
    async ({ thought_id }) => {
      try {
        const data = await getThought(thought_id, bearerToken);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // --- Mindspace Tools (query/deliver tasks via A2A) ---

  mcp.tool(
    "query_tasks",
    "Query tasks from Mindspace. Returns lean list: slug, title, status, role. Use get_task for full DNA.",
    {
      status: z.string().optional().describe("Filter: pending, ready, active, review, approval, complete..."),
      role: z.string().optional().describe("Filter: dev, pdsa, qa, liaison"),
      project: z.string().optional().describe("Project slug, or __all__ for all"),
      limit: z.number().optional().describe("Max results (default 50)"),
    },
    async ({ status, role, project, limit }) => {
      try {
        const filters: Record<string, unknown> = {};
        if (status) filters.status = status;
        if (role) filters.current_role = role;
        if (project) filters.project_slug = project;
        if (limit) filters.limit = limit;
        const data = await callMindspace({ type: "OBJECT_QUERY", object_type: "task", filters });
        const lean = (data.objects || []).map((t: any) => ({
          slug: t.slug, title: t.dna?.title || t.title, status: t.status, role: t.current_role,
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ count: lean.length, tasks: lean }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : err}` }], isError: true };
      }
    }
  );

  mcp.tool(
    "get_task",
    "Get full task details including DNA. Use after query_tasks to drill into a specific task.",
    {
      slug: z.string().describe("Task slug or ID"),
    },
    async ({ slug }) => {
      try {
        const data = await callMindspace({ type: "OBJECT_QUERY", object_type: "task", filters: { slug } });
        const task = data.objects?.[0];
        if (!task) return { content: [{ type: "text" as const, text: "Task not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : err}` }], isError: true };
      }
    }
  );

  mcp.tool(
    "deliver_task",
    "Deliver task results. Automatically contributes learnings to brain (enforced), then transitions the task.",
    {
      slug: z.string().describe("Task slug"),
      transition: z.string().describe("Target status: review, approval, testing, complete"),
      findings: z.string().describe("What was done — implementation details"),
      learnings: z.string().min(50).describe("Key learnings for brain (min 50 chars) — decisions, patterns, what to remember"),
    },
    async ({ slug, transition, findings, learnings }) => {
      try {
        // 1. Brain contribute (enforced — not optional)
        const brain = await callMindspace({ type: "BRAIN_CONTRIBUTE", prompt: learnings, topic: slug });
        const thoughtId = brain.thought_id || null;
        // 2. Deliver with brain_contribution_id
        const result = await callMindspace({
          type: "DELIVER", task_slug: slug, transition_to: transition,
          payload: { findings, brain_contribution_id: thoughtId },
        });
        return { content: [{ type: "text" as const, text: JSON.stringify({ brain_thought_id: thoughtId, delivery: result }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : err}` }], isError: true };
      }
    }
  );

  mcp.tool(
    "claim_task",
    "Claim a ready task (transitions ready→active). Only works if task matches your role.",
    {
      slug: z.string().describe("Task slug to claim"),
    },
    async ({ slug }) => {
      try {
        const result = await callMindspace({ type: "CLAIM_TASK", task_slug: slug });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : err}` }], isError: true };
      }
    }
  );

  return mcp;
}

export async function startMcpServer(): Promise<void> {
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS for Claude.ai
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // RFC 9728: OAuth Protected Resource Metadata discovery
    const BRAIN_PUBLIC_URL = process.env.BRAIN_PUBLIC_URL || "https://hive.xpollination.earth";
    const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || "https://mindspace.xpollination.earth";
    if (req.url === "/.well-known/oauth-protected-resource") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        resource: BRAIN_PUBLIC_URL,
        authorization_servers: [AUTH_SERVER_URL],
        scopes_supported: ["brain:read", "brain:write"],
        bearer_methods_supported: ["header"],
        resource_name: "XPollination Brain",
        resource_documentation: `${AUTH_SERVER_URL}/docs`,
      }));
      return;
    }

    // Extract Bearer token from client request — pass through to brain API
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      // RFC 9728: WWW-Authenticate with resource_metadata for OAuth discovery
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${BRAIN_PUBLIC_URL}/.well-known/oauth-protected-resource"`,
      });
      res.end(JSON.stringify({ error: "Authorization required. Use OAuth or provide Bearer token." }));
      return;
    }
    const bearerToken = authHeader.slice("bearer ".length);

    // Stateless mode: new server+transport per request
    try {
      const mcp = createMcpServer(bearerToken);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      await mcp.connect(transport);
      await transport.handleRequest(req, res);
      await mcp.close();
    } catch (err) {
      console.error("MCP request handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal MCP server error" }));
      }
    }
  });

  httpServer.on("error", (err) => {
    console.error("MCP HTTP server error:", err);
  });

  httpServer.listen(MCP_PORT, "0.0.0.0", () => {
    console.log(`MCP server (brain + mindspace) running on http://0.0.0.0:${MCP_PORT}`);
  });

  // Connect to Mindspace A2A at startup (non-blocking — tools work after connection)
  connectToMindspace().catch((err) => {
    console.warn(`[MCP] Mindspace connection deferred: ${err.message}`);
  });
}
