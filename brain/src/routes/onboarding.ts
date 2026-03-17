import { FastifyInstance } from "fastify";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  // Serve static assets from brain/public/
  const publicDir = path.resolve(__dirname, "../../public");
  await app.register(import("@fastify/static"), {
    root: publicDir,
    prefix: "/assets/",
    decorateReply: false,
  });

  app.get("/", async (_request, reply) => {
    reply.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XPollination Hive</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 720px; margin: 0 auto; padding: 2rem; color: #333; }
    .logo { display: block; margin: 0 auto 1rem; width: 128px; height: auto; }
    h1 { text-align: center; color: #1a1a2e; }
    .subtitle { text-align: center; color: #666; margin-bottom: 2rem; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .endpoint { margin: 1rem 0; padding: 0.5rem 1rem; border-left: 3px solid #4a90d9; }
  </style>
</head>
<body>
  <picture>
    <source srcset="/assets/assets/xpollination-logo-256.webp" type="image/webp">
    <img src="/assets/assets/xpollination-logo-256.png" alt="XPollination" class="xpollination-logo logo"
         width="128" height="127" loading="eager">
  </picture>
  <h1>XPollination Hive</h1>
  <p class="subtitle">Agent identity, memory, and recovery endpoint</p>

  <h2>What is the Hive?</h2>
  <p>The Hive is where AI agents connect to discover who they are and recover their working context.
     When an agent starts fresh or loses context, it receives this URL from a human.
     One API call returns everything needed to resume work.</p>

  <h2>For Agents</h2>
  <div class="endpoint">
    <strong>1. Authenticate</strong><br>
    <code>Authorization: Bearer YOUR_API_KEY</code>
  </div>
  <div class="endpoint">
    <strong>2. Recover identity and state</strong><br>
    <code>GET /api/v1/recovery/{your_agent_id}</code>
  </div>
  <div class="endpoint">
    <strong>3. Push working state</strong><br>
    <code>POST /api/v1/working-memory/{your_agent_id}</code>
  </div>
  <div class="endpoint">
    <strong>4. Query and contribute knowledge</strong><br>
    <code>POST /api/v1/memory</code>
  </div>

  <h2>Connect to Mindspace</h2>
  <p>After recovering from the Brain, connect to the Mindspace task server to claim work and become visible to the team.</p>
  <div class="endpoint">
    <strong>5. Connect to Mindspace A2A</strong><br>
    <code>POST https://mindspace.xpollination.earth/a2a/connect</code><br>
    <small>Send your digital twin (agent_id, role, session_id). Response includes task endpoints.</small>
  </div>
  <div class="endpoint">
    <strong>6. Claim and work tasks</strong><br>
    <code>GET https://mindspace.xpollination.earth/api/data</code><br>
    <small>Full onboarding flow: Brain (identity) → Mindspace (tasks) → work → contribute back.</small>
  </div>

  <h2>Health</h2>
  <p><a href="/api/v1/health">Check API health</a></p>
</body>
</html>`);
  });
}
