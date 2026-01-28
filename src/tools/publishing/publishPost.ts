/**
 * Publish Post Tool
 *
 * Commits an approved draft to the Hugo repository and triggers deployment.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GitPublisher, PostFrontmatter } from '../../services/git/GitPublisher.js';
import type { DatabaseContext } from '../../db/client.js';

/**
 * Tool definition exposed to Claude
 */
export const publishPostTool: Tool = {
  name: 'publish_post',
  description: `Publish an approved draft to the blog.

Commits the draft to the Hugo repository with proper frontmatter,
triggers a deploy via GitHub Actions, and records the publication.

Only use this after the user has explicitly approved the draft.`,
  inputSchema: {
    type: 'object',
    properties: {
      draftId: {
        type: 'string',
        description: 'The draft ID to publish'
      },
      publishAs: {
        type: 'string',
        enum: ['live', 'draft'],
        description: 'Publish as live post or as Hugo draft (default: live)',
        default: 'live'
      },
      metadata: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          categories: {
            type: 'array',
            items: { type: 'string' }
          },
          author: { type: 'string' },
          description: { type: 'string' }
        },
        description: 'Additional metadata to include in the post'
      }
    },
    required: ['draftId']
  }
};

export interface PublishMetadata {
  tags?: string[];
  categories?: string[];
  author?: string;
  description?: string;
}

export interface PublishPostInput {
  draftId: string;
  publishAs?: 'live' | 'draft';
  metadata?: PublishMetadata;
}

export interface PublishPostResult {
  success: boolean;
  draftId: string;
  title: string;
  slug: string;
  filePath?: string;
  commitSha?: string;
  deployTriggered: boolean;
  postUrl?: string;
  error?: string;
  message: string;
}

/**
 * Handle the publish_post tool call
 */
export async function handlePublishPost(
  input: PublishPostInput,
  db: DatabaseContext
): Promise<PublishPostResult> {
  const { draftId, publishAs = 'live', metadata = {} } = input;

  // Get the draft
  const draft = await db.draftRepo.findById(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  const draftData = draft as any;

  // Check draft status
  if (draftData.status !== 'verified' && draftData.status !== 'approved') {
    return {
      success: false,
      draftId,
      title: draftData.title,
      slug: '',
      deployTriggered: false,
      error: `Draft status is '${draftData.status}'. Must be 'verified' or 'approved' to publish.`,
      message: `Cannot publish: draft must be verified first. Current status: ${draftData.status}`
    };
  }

  // Initialize Git publisher
  const publisher = new GitPublisher();
  const slug = publisher.generateSlug(draftData.title);

  // Parse existing metadata from draft
  const draftMeta = JSON.parse(draftData.metadata || '{}');

  // Create frontmatter
  const frontmatter: PostFrontmatter = {
    title: draftData.title,
    date: new Date().toISOString(),
    draft: publishAs === 'draft',
    tags: metadata.tags || draftMeta.tags || [],
    categories: metadata.categories || draftMeta.category ? [draftMeta.category] : [],
    author: metadata.author || 'Thomas Pichler',
    description: metadata.description || draftData.angle
  };

  // Create full post content
  const postContent = publisher.createPostContent(frontmatter, draftData.content);

  try {
    // Write file
    const filePath = publisher.writePostFile(slug, postContent);

    // Commit and push
    const commitMessage = `feat(content): publish "${draftData.title}"`;
    const result = await publisher.commitAndPush(filePath, commitMessage);

    if (!result.success) {
      return {
        success: false,
        draftId,
        title: draftData.title,
        slug,
        filePath,
        deployTriggered: false,
        error: result.error,
        message: `Failed to commit: ${result.error}`
      };
    }

    // Update draft status
    await db.draftRepo.update(draftId, { status: 'published' });

    // Generate post URL
    const baseUrl = process.env.SITE_URL || 'https://xpollination.earth';
    const postUrl = `${baseUrl}/posts/${slug}/`;

    return {
      success: true,
      draftId,
      title: draftData.title,
      slug,
      filePath,
      commitSha: result.commitSha,
      deployTriggered: true,
      postUrl,
      message: `Successfully published "${draftData.title}". ` +
        `GitHub Actions will deploy the site. Post will be available at ${postUrl}`
    };
  } catch (error) {
    return {
      success: false,
      draftId,
      title: draftData.title,
      slug,
      deployTriggered: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: `Publication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
