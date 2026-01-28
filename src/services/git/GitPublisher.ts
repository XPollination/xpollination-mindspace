/**
 * Git Publisher Service
 *
 * Handles committing content to the Hugo repository and triggering deploys.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export interface PublishConfig {
  repoPath: string;
  contentDir: string;
  branch: string;
  remote: string;
}

export interface PostFrontmatter {
  title: string;
  date: string;
  draft: boolean;
  tags?: string[];
  categories?: string[];
  author?: string;
  description?: string;
}

export interface PublishResult {
  success: boolean;
  filePath: string;
  commitSha?: string;
  error?: string;
}

export class GitPublisher {
  private config: PublishConfig;

  constructor(config: Partial<PublishConfig> = {}) {
    this.config = {
      repoPath: config.repoPath || process.env.HUGO_REPO_PATH || '/var/www/xpollination',
      contentDir: config.contentDir || 'content/posts',
      branch: config.branch || 'main',
      remote: config.remote || 'origin'
    };
  }

  /**
   * Generate Hugo frontmatter in YAML format
   */
  generateFrontmatter(meta: PostFrontmatter): string {
    const lines = ['---'];
    lines.push(`title: "${meta.title.replace(/"/g, '\\"')}"`);
    lines.push(`date: ${meta.date}`);
    lines.push(`draft: ${meta.draft}`);

    if (meta.description) {
      lines.push(`description: "${meta.description.replace(/"/g, '\\"')}"`);
    }
    if (meta.author) {
      lines.push(`author: "${meta.author}"`);
    }
    if (meta.tags && meta.tags.length > 0) {
      lines.push(`tags: [${meta.tags.map(t => `"${t}"`).join(', ')}]`);
    }
    if (meta.categories && meta.categories.length > 0) {
      lines.push(`categories: [${meta.categories.map(c => `"${c}"`).join(', ')}]`);
    }

    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Generate a slug from the title
   */
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 60);
  }

  /**
   * Create the full post content with frontmatter
   */
  createPostContent(frontmatter: PostFrontmatter, content: string): string {
    const fm = this.generateFrontmatter(frontmatter);
    return `${fm}\n\n${content}`;
  }

  /**
   * Write post file to the Hugo content directory
   */
  writePostFile(slug: string, content: string): string {
    const fileName = `${slug}.md`;
    const filePath = join(this.config.repoPath, this.config.contentDir, fileName);

    // Ensure directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Commit and push the post to the repository
   */
  async commitAndPush(filePath: string, commitMessage: string): Promise<PublishResult> {
    try {
      const relativePath = filePath.replace(this.config.repoPath + '/', '');

      // Stage the file
      this.execGit(`add "${relativePath}"`);

      // Commit
      this.execGit(`commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

      // Get commit SHA
      const commitSha = this.execGit('rev-parse HEAD').trim();

      // Push
      this.execGit(`push ${this.config.remote} ${this.config.branch}`);

      return {
        success: true,
        filePath,
        commitSha
      };
    } catch (error) {
      return {
        success: false,
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a git command in the repo directory
   */
  private execGit(command: string): string {
    return execSync(`git ${command}`, {
      cwd: this.config.repoPath,
      encoding: 'utf-8'
    });
  }

  /**
   * Check if the repository is clean (no uncommitted changes)
   */
  isRepoClean(): boolean {
    try {
      const status = this.execGit('status --porcelain');
      return status.trim() === '';
    } catch {
      return false;
    }
  }

  /**
   * Pull latest changes from remote
   */
  pullLatest(): void {
    this.execGit(`pull ${this.config.remote} ${this.config.branch}`);
  }
}
