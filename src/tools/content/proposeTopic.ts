/**
 * Propose Topic Tool
 *
 * Analyzes trending topics and generates blog post proposals.
 * This tool structures the trending content for Claude to evaluate
 * and propose specific angles for blog posts.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { FrameRepository } from '../../db/client.js';

/**
 * Tool definition exposed to Claude
 */
export const proposeTopicTool: Tool = {
  name: 'propose_topic',
  description: `Analyze trending topics and generate blog post proposals.

Takes trending topics from crawl_trends and generates structured proposals
with specific angles, key points, and target audience. Claude uses this
structure to create focused proposals that align with the frame's tone.

This is the second step in the content pipeline, after crawl_trends.`,
  inputSchema: {
    type: 'object',
    properties: {
      trendingTopics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            link: { type: 'string' },
            description: { type: 'string' },
            frameId: { type: 'string' },
            matchedKeywords: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['title', 'link', 'frameId']
        },
        description: 'Trending topics from crawl_trends'
      },
      maxProposals: {
        type: 'number',
        description: 'Maximum number of proposals to generate (default: 3)',
        default: 3
      }
    },
    required: ['trendingTopics']
  }
};

export interface TrendingTopicInput {
  title: string;
  link: string;
  description?: string;
  frameId: string;
  matchedKeywords?: string[];
}

export interface ProposeTopicInput {
  trendingTopics: TrendingTopicInput[];
  maxProposals?: number;
}

export interface TopicProposal {
  id: string;
  title: string;
  angle: string;
  keyPoints: string[];
  targetAudience: string;
  estimatedLength: string;
  frameId: string;
  frameName: string;
  tone: string;
  sourceTopics: {
    title: string;
    link: string;
  }[];
  suggestedTags: string[];
}

export interface ProposeTopicResult {
  proposals: TopicProposal[];
  frameContext: {
    id: string;
    name: string;
    description: string;
    audience: string;
    tone: string;
    keywords: string[];
  }[];
  message: string;
  nextStep: string;
}

/**
 * Handle the propose_topic tool call
 */
export async function handleProposeTopic(
  input: ProposeTopicInput,
  frameRepo: FrameRepository
): Promise<ProposeTopicResult> {
  const maxProposals = input.maxProposals ?? 3;
  const { trendingTopics } = input;

  if (trendingTopics.length === 0) {
    return {
      proposals: [],
      frameContext: [],
      message: 'No trending topics provided. Run crawl_trends first.',
      nextStep: 'crawl_trends'
    };
  }

  // Get unique frame IDs and fetch frame details
  const frameIds = [...new Set(trendingTopics.map(t => t.frameId))];
  const frames = await Promise.all(
    frameIds.map(id => frameRepo.findById(id))
  );
  const validFrames = frames.filter((f): f is NonNullable<typeof f> => f !== null);

  // Build frame context for Claude to use when generating proposals
  const frameContext = validFrames.map(frame => ({
    id: frame.id,
    name: frame.name,
    description: frame.description,
    audience: frame.audience,
    tone: frame.tone,
    keywords: JSON.parse(frame.keywords || '[]')
  }));

  // Group topics by frame
  const topicsByFrame = new Map<string, TrendingTopicInput[]>();
  for (const topic of trendingTopics) {
    const existing = topicsByFrame.get(topic.frameId) || [];
    existing.push(topic);
    topicsByFrame.set(topic.frameId, existing);
  }

  // Generate proposal structures (Claude will fill in the creative content)
  const proposals: TopicProposal[] = [];
  let proposalCount = 0;

  for (const [frameId, topics] of topicsByFrame) {
    const frame = validFrames.find(f => f.id === frameId);
    if (!frame || proposalCount >= maxProposals) continue;

    // Take top topics for this frame
    const topTopics = topics.slice(0, Math.ceil(maxProposals / frameIds.length));

    for (const topic of topTopics) {
      if (proposalCount >= maxProposals) break;

      const proposalId = `proposal-${Date.now()}-${proposalCount}`;

      proposals.push({
        id: proposalId,
        title: `[TO BE REFINED] ${topic.title}`,
        angle: '[Claude should propose a unique angle based on frame context]',
        keyPoints: [
          'Key point 1 based on trending topic',
          'Key point 2 connecting to frame themes',
          'Key point 3 with actionable insight'
        ],
        targetAudience: frame.audience,
        estimatedLength: '800-1200 words',
        frameId: frame.id,
        frameName: frame.name,
        tone: frame.tone,
        sourceTopics: [{
          title: topic.title,
          link: topic.link
        }],
        suggestedTags: topic.matchedKeywords || []
      });

      proposalCount++;
    }
  }

  return {
    proposals,
    frameContext,
    message: `Generated ${proposals.length} proposal structure(s) for refinement. ` +
      `Review the frame context and trending sources to develop specific angles.`,
    nextStep: 'Claude should refine these proposals, then present them to the user for selection. ' +
      'After user selects a topic and provides framing, use write_draft.'
  };
}
