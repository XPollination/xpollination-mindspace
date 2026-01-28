/**
 * Tool Registry
 *
 * Exports all MCP tools and the handler function.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ContentPipeline } from '../workflow/processes/ContentPipeline.js';

// Tool definitions will be imported here as they are implemented
// import { createFrameTool, handleCreateFrame } from './frames/createFrame.js';

export interface ToolDefinition {
  definition: Tool;
  handler: (args: unknown, db: DatabaseContext, pipeline: ContentPipeline) => Promise<unknown>;
}

export interface DatabaseContext {
  frameRepo: unknown;  // FrameRepository
  draftRepo: unknown;  // DraftRepository
  trendRepo: unknown;  // TrendRepository
  workflowRepo: unknown; // WorkflowRepository
}

/**
 * All available tools
 * Add new tools here as they are implemented
 */
export const tools: ToolDefinition[] = [
  // Frame management
  // { definition: createFrameTool, handler: handleCreateFrame },

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
