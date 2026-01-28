/**
 * Crawl Trends Tool
 *
 * Crawls RSS feeds and matches content against active frames.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RssParser, RssItem } from '../../services/rss/RssParser.js';
import { TrendMatcher, FrameConfig, TrendMatch } from '../../services/trends/TrendMatcher.js';
import type { FrameRepository } from '../../db/client.js';

/**
 * Tool definition exposed to Claude
 */
export const crawlTrendsTool: Tool = {
  name: 'crawl_trends',
  description: `Crawl RSS feeds for trending topics matching active content frames.

This tool fetches articles from RSS feeds defined in each frame's sources,
matches them against frame keywords, and returns ranked trending topics.

Use this as the first step in the content pipeline to discover what's
trending in your topic areas.`,
  inputSchema: {
    type: 'object',
    properties: {
      frameIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific frame IDs to crawl (omit for all active frames)'
      },
      lookbackDays: {
        type: 'number',
        description: 'How many days back to look for content (default: 7)',
        default: 7
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of trending topics to return (default: 20)',
        default: 20
      }
    },
    required: []
  }
};

export interface CrawlTrendsInput {
  frameIds?: string[];
  lookbackDays?: number;
  maxResults?: number;
}

export interface TrendingTopic {
  title: string;
  link: string;
  description?: string;
  source: string;
  publishedAt?: string;
  frameId: string;
  frameName: string;
  relevanceScore: number;
  trendScore: number;
  matchedKeywords: string[];
}

export interface CrawlTrendsResult {
  trendingTopics: TrendingTopic[];
  framesProcessed: number;
  feedsProcessed: number;
  articlesAnalyzed: number;
  message: string;
}

/**
 * Handle the crawl_trends tool call
 */
export async function handleCrawlTrends(
  input: CrawlTrendsInput,
  frameRepo: FrameRepository
): Promise<CrawlTrendsResult> {
  const lookbackDays = input.lookbackDays ?? 7;
  const maxResults = input.maxResults ?? 20;

  // Get frames to process
  const frames = input.frameIds
    ? await Promise.all(input.frameIds.map(id => frameRepo.findById(id)))
    : await frameRepo.findActive();

  const validFrames = frames.filter((f): f is NonNullable<typeof f> => f !== null);

  if (validFrames.length === 0) {
    return {
      trendingTopics: [],
      framesProcessed: 0,
      feedsProcessed: 0,
      articlesAnalyzed: 0,
      message: 'No active frames found. Create a frame first with create_frame.'
    };
  }

  // Collect all RSS URLs from frames
  const rssParser = new RssParser();
  const trendMatcher = new TrendMatcher();
  const allItems: RssItem[] = [];
  const feedUrls = new Set<string>();

  // Parse frame sources and collect RSS URLs
  const frameConfigs: FrameConfig[] = [];
  for (const frame of validFrames) {
    const sources = JSON.parse(frame.sources || '{}');
    const keywords = JSON.parse(frame.keywords || '[]');
    const exclusions = JSON.parse(frame.exclusions || '[]');

    frameConfigs.push({
      id: frame.id,
      name: frame.name,
      keywords,
      exclusions
    });

    if (sources.rss && Array.isArray(sources.rss)) {
      for (const url of sources.rss) {
        feedUrls.add(url);
      }
    }
  }

  // Fetch all RSS feeds
  const feeds = await rssParser.parseFeeds(Array.from(feedUrls));

  // Collect and filter items by date
  for (const feed of feeds.values()) {
    const recentItems = rssParser.filterByDate(feed.items, lookbackDays);
    allItems.push(...recentItems);
  }

  // Match items against frames
  const matches = trendMatcher.matchItemsMultiFrame(allItems, frameConfigs);
  const dedupedMatches = trendMatcher.deduplicateMatches(matches);

  // Convert to trending topics
  const trendingTopics: TrendingTopic[] = dedupedMatches
    .slice(0, maxResults)
    .map(match => ({
      title: match.item.title,
      link: match.item.link,
      description: match.item.description,
      source: match.item.source,
      publishedAt: match.item.pubDate?.toISOString(),
      frameId: match.frameId,
      frameName: match.frameName,
      relevanceScore: Math.round(match.relevanceScore * 100) / 100,
      trendScore: Math.round(match.trendScore * 100) / 100,
      matchedKeywords: match.matchedKeywords
    }));

  return {
    trendingTopics,
    framesProcessed: validFrames.length,
    feedsProcessed: feeds.size,
    articlesAnalyzed: allItems.length,
    message: trendingTopics.length > 0
      ? `Found ${trendingTopics.length} trending topic(s) across ${validFrames.length} frame(s)`
      : `No trending topics found matching frame keywords. Try adding more RSS sources or adjusting keywords.`
  };
}
