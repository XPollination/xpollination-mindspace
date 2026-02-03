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

// Trend crawling tools
import { crawlTrendsTool, handleCrawlTrends, CrawlTrendsInput } from './crawler/crawlTrends.js';

// Content generation tools
import { proposeTopicTool, handleProposeTopic, ProposeTopicInput } from './content/proposeTopic.js';
import { writeDraftTool, handleWriteDraft, WriteDraftInput } from './content/writeDraft.js';

// Verification tools
import { factCheckTool, handleFactCheck, FactCheckInput } from './verification/factCheck.js';
import { improveDraftTool, handleImproveDraft, ImproveDraftInput } from './verification/improveDraft.js';

// Publishing tools
import { publishPostTool, handlePublishPost, PublishPostInput } from './publishing/publishPost.js';

// PM (Project Management) tools
import {
  pmCreateNodeTool, handlePmCreateNode,
  pmGetNodeTool, handlePmGetNode,
  pmListNodesTool, handlePmListNodes,
  pmUpdateNodeTool, handlePmUpdateNode,
  pmTransitionTool, handlePmTransition,
  pmGetValidTransitionsTool, handlePmGetValidTransitions,
  pmValidateNodeTool, handlePmValidateNode,
  pmDeleteNodeTool, handlePmDeleteNode
} from './pm/index.js';

export interface ToolDefinition {
  definition: Tool;
  handler: (args: unknown, db: DatabaseContext, pipeline: ContentPipeline) => Promise<unknown>;
}

export { DatabaseContext };

/**
 * All available tools
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
  {
    definition: crawlTrendsTool,
    handler: async (args, db, _pipeline) => handleCrawlTrends(args as CrawlTrendsInput, db.frameRepo)
  },

  // Content generation
  {
    definition: proposeTopicTool,
    handler: async (args, db, _pipeline) => handleProposeTopic(args as ProposeTopicInput, db.frameRepo)
  },
  {
    definition: writeDraftTool,
    handler: async (args, db, _pipeline) => handleWriteDraft(args as WriteDraftInput, db)
  },

  // Verification
  {
    definition: factCheckTool,
    handler: async (args, db, _pipeline) => handleFactCheck(args as FactCheckInput, db)
  },
  {
    definition: improveDraftTool,
    handler: async (args, db, _pipeline) => handleImproveDraft(args as ImproveDraftInput, db)
  },

  // Publishing
  {
    definition: publishPostTool,
    handler: async (args, db, _pipeline) => handlePublishPost(args as PublishPostInput, db)
  },

  // PM (Project Management) tools
  {
    definition: pmCreateNodeTool,
    handler: async (args, db, _pipeline) => handlePmCreateNode(args, db.mindspaceRepo)
  },
  {
    definition: pmGetNodeTool,
    handler: async (args, db, _pipeline) => handlePmGetNode(args, db.mindspaceRepo)
  },
  {
    definition: pmListNodesTool,
    handler: async (args, db, _pipeline) => handlePmListNodes(args, db.mindspaceRepo)
  },
  {
    definition: pmUpdateNodeTool,
    handler: async (args, db, _pipeline) => handlePmUpdateNode(args, db.mindspaceRepo)
  },
  {
    definition: pmTransitionTool,
    handler: async (args, db, _pipeline) => handlePmTransition(args, db.mindspaceRepo)
  },
  {
    definition: pmGetValidTransitionsTool,
    handler: async (args, db, _pipeline) => handlePmGetValidTransitions(args, db.mindspaceRepo)
  },
  {
    definition: pmValidateNodeTool,
    handler: async (args, db, _pipeline) => handlePmValidateNode(args, db.mindspaceRepo)
  },
  {
    definition: pmDeleteNodeTool,
    handler: async (args, db, _pipeline) => handlePmDeleteNode(args, db.mindspaceRepo)
  }
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
