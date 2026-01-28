/**
 * RSS Parser Service
 *
 * Fetches and parses RSS feeds to extract articles for trend analysis.
 */

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: Date;
  categories?: string[];
  source: string;
}

export interface RssFeed {
  title: string;
  link: string;
  description?: string;
  items: RssItem[];
}

export class RssParser {
  private readonly userAgent =
    'XPollination/1.0 (https://xpollination.earth)';

  /**
   * Fetch and parse a single RSS feed
   */
  async parseFeed(url: string): Promise<RssFeed> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return this.parseXml(xml, url);
  }

  /**
   * Parse RSS XML content
   */
  private parseXml(xml: string, sourceUrl: string): RssFeed {
    // Simple regex-based XML parsing (avoiding heavy dependencies)
    const getTagContent = (tag: string, content: string): string | undefined => {
      const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return match ? this.decodeHtmlEntities(match[1].trim()) : undefined;
    };

    const getAllTagContents = (tag: string, content: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(content)) !== null) {
        matches.push(this.decodeHtmlEntities(match[1].trim()));
      }
      return matches;
    };

    // Extract channel info
    const channelMatch = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
    const channelContent = channelMatch ? channelMatch[1] : xml;

    const feedTitle = getTagContent('title', channelContent) || sourceUrl;
    const feedLink = getTagContent('link', channelContent) || sourceUrl;
    const feedDescription = getTagContent('description', channelContent);

    // Extract items
    const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
    const items: RssItem[] = [];

    for (const itemMatch of itemMatches) {
      const itemContent = itemMatch[1];

      const title = getTagContent('title', itemContent);
      const link = getTagContent('link', itemContent);
      const description = getTagContent('description', itemContent);
      const pubDateStr = getTagContent('pubDate', itemContent);
      const categories = getAllTagContents('category', itemContent);

      if (title && link) {
        items.push({
          title,
          link,
          description: description ? this.stripHtml(description) : undefined,
          pubDate: pubDateStr ? new Date(pubDateStr) : undefined,
          categories: categories.length > 0 ? categories : undefined,
          source: feedTitle
        });
      }
    }

    return {
      title: feedTitle,
      link: feedLink,
      description: feedDescription,
      items
    };
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Fetch multiple feeds in parallel
   */
  async parseFeeds(urls: string[]): Promise<Map<string, RssFeed>> {
    const results = new Map<string, RssFeed>();

    const promises = urls.map(async (url) => {
      try {
        const feed = await this.parseFeed(url);
        results.set(url, feed);
      } catch (error) {
        // Log error but continue with other feeds
        console.error(`Failed to parse feed ${url}:`, error);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Filter items by date (within lookback period)
   */
  filterByDate(items: RssItem[], lookbackDays: number): RssItem[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    return items.filter((item) => {
      if (!item.pubDate) return true; // Include items without date
      return item.pubDate >= cutoff;
    });
  }
}
