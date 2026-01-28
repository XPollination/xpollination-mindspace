/**
 * XPollination MCP Server
 *
 * Entry point for the Model Context Protocol server that powers
 * the XPollination content generation pipeline.
 *
 * Tools exposed:
 * - Frame management (create, update, delete, list, test)
 * - Trend crawling (crawl_trends)
 * - Content generation (propose_topic, write_draft, get_draft, list_drafts)
 * - Verification (fact_check, improve_draft)
 * - Publishing (publish_post, get_post_status)
 *
 * Resources exposed:
 * - content://frames/{id}
 * - content://drafts/{id}
 * - content://queue
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { initDatabase } from './db/client.js';
import { tools, handleToolCall } from './tools/index.js';
import { resources, handleResourceRead } from './resources/index.js';
import { ContentPipeline } from './workflow/processes/ContentPipeline.js';
import { WorkflowEngine } from './workflow/WorkflowEngine.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('Starting XPollination MCP Server...');

  // Initialize database
  const db = await initDatabase();
  logger.info('Database initialized');

  // Initialize workflow engine
  const workflowEngine = new WorkflowEngine(db.workflowRepo);
  const pipeline = new ContentPipeline(workflowEngine);
  logger.info('Workflow engine initialized');

  // Create MCP server
  const server = new Server(
    {
      name: process.env.MCP_SERVER_NAME || 'xpollination-content',
      version: process.env.MCP_SERVER_VERSION || '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => t.definition)
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Tool call: ${name}`, { args });

    try {
      const result = await handleToolCall(name, args, db, pipeline);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Tool error: ${name}`, { error: message });
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true
      };
    }
  });

  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resources.map(r => r.definition)
  }));

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    logger.info(`Resource read: ${uri}`);

    const content = await handleResourceRead(uri, db);
    return {
      contents: [{ uri, text: JSON.stringify(content, null, 2) }]
    };
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('XPollination MCP Server running');
}

main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
