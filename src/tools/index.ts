/**
 * Tool Registry
 *
 * Exports all MCP tools and the handler function.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ContentPipeline } from '../workflow/processes/ContentPipeline.js';
import { DatabaseContext } from '../db/client.js';

// Frame management tools
import { createFrameTool, handleCreateFrame } from './frames/createFrame.js';
import { listFramesTool, handleListFrames } from './frames/listFrames.js';

export interface ToolDefinition {
  definition: Tool;
  handler: (args: unknown, db: DatabaseContext, pipeline: ContentPipeline) => Promise<unknown>;
}

export { DatabaseContext };

/**
 * All available tools
 * Add new tools here as they are implemented
 */
export const tools: ToolDefinition[] = [
  // Frame management
  {
    definition: createFrameTool,
    handler: async (args, db, _pipeline) => handleCreateFrame(args, db.frameRepo)
  },
  {
    definition: listFramesTool,
    handler: async (args, db, _pipeline) => handleListFrames(args as { includeInactive?: boolean }, db.frameRepo)
  },

  // Trend crawling
  // { definition: crawlTrendsTool, handler: handleCrawlTrends },

  // Content generation
  // { definition: proposeTopicTool, handler: handleProposeTopic },
  // { definition: writeDraftTool, handler: handleWriteDraft },

  // Verification
  // { definition: factCheckTool, handler: handleFactCheck },
  // { definition: improveDraftTool, handler: handleImproveDraft },

  // Publishing
  // { definition: publishPostTool, handler: handlePublishPost },
];

/**
 * Handle a tool call by name
 */
export async function handleToolCall(
  name: string,
  args: unknown,
  db: DatabaseContext,
  pipeline: ContentPipeline
): Promise<unknown> {
  const tool = tools.find(t => t.definition.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return tool.handler(args, db, pipeline);
}
