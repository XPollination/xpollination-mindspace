/**
 * Trend Matcher Service
 *
 * Matches RSS items against frame keywords to calculate relevance scores.
 */

import { RssItem } from '../rss/RssParser.js';

export interface FrameConfig {
  id: string;
  name: string;
  keywords: string[];
  exclusions?: string[];
}

export interface TrendMatch {
  item: RssItem;
  frameId: string;
  frameName: string;
  relevanceScore: number;
  matchedKeywords: string[];
  trendScore: number;
}

export class TrendMatcher {
  /**
   * Match RSS items against a frame's keywords
   */
  matchItems(items: RssItem[], frame: FrameConfig): TrendMatch[] {
    const matches: TrendMatch[] = [];

    for (const item of items) {
      const match = this.matchItem(item, frame);
      if (match) {
        matches.push(match);
      }
    }

    // Sort by relevance score (highest first)
    return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Match a single item against a frame
   */
  private matchItem(item: RssItem, frame: FrameConfig): TrendMatch | null {
    const text = this.normalizeText(
      `${item.title} ${item.description || ''} ${(item.categories || []).join(' ')}`
    );

    // Check exclusions first
    if (frame.exclusions) {
      for (const exclusion of frame.exclusions) {
        if (text.includes(this.normalizeText(exclusion))) {
          return null; // Excluded
        }
      }
    }

    // Find matching keywords
    const matchedKeywords: string[] = [];
    let keywordScore = 0;

    for (const keyword of frame.keywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      if (text.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
        // Longer keywords = higher score (more specific)
        keywordScore += keyword.split(' ').length;
      }
    }

    if (matchedKeywords.length === 0) {
      return null; // No matches
    }

    // Calculate relevance score (0-1)
    const relevanceScore = Math.min(
      1,
      (matchedKeywords.length / frame.keywords.length) * 2
    );

    // Calculate trend score based on recency
    const trendScore = this.calculateTrendScore(item);

    return {
      item,
      frameId: frame.id,
      frameName: frame.name,
      relevanceScore,
      matchedKeywords,
      trendScore
    };
  }

  /**
   * Normalize text for matching (lowercase, remove special chars)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate trend score based on recency (0-1)
   * More recent = higher score
   */
  private calculateTrendScore(item: RssItem): number {
    if (!item.pubDate) {
      return 0.5; // Unknown date = middle score
    }

    const now = new Date();
    const ageInHours = (now.getTime() - item.pubDate.getTime()) / (1000 * 60 * 60);

    // Exponential decay: score halves every 24 hours
    return Math.exp(-ageInHours / 24);
  }

  /**
   * Match items against multiple frames
   */
  matchItemsMultiFrame(items: RssItem[], frames: FrameConfig[]): TrendMatch[] {
    const allMatches: TrendMatch[] = [];

    for (const frame of frames) {
      const matches = this.matchItems(items, frame);
      allMatches.push(...matches);
    }

    // Sort by combined score
    return allMatches.sort((a, b) => {
      const scoreA = a.relevanceScore * 0.6 + a.trendScore * 0.4;
      const scoreB = b.relevanceScore * 0.6 + b.trendScore * 0.4;
      return scoreB - scoreA;
    });
  }

  /**
   * Deduplicate matches by URL (keep highest scoring)
   */
  deduplicateMatches(matches: TrendMatch[]): TrendMatch[] {
    const seen = new Map<string, TrendMatch>();

    for (const match of matches) {
      const existing = seen.get(match.item.link);
      if (!existing || match.relevanceScore > existing.relevanceScore) {
        seen.set(match.item.link, match);
      }
    }

    return Array.from(seen.values());
  }
}
