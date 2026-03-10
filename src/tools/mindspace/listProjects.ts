/**
 * mindspace_list_projects MCP Tool
 *
 * Lists all projects from the Mindspace REST API.
 * Uses fetch to call GET /api/projects with X-API-Key authentication.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const listProjectsInputSchema = z.object({}).passthrough();

export const listProjectsTool: Tool = {
  name: 'mindspace_list_projects',
  description: 'List all projects in the Mindspace system. Returns project slugs, names, descriptions, and metadata. Use this to discover available projects before querying tasks or capabilities.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};

export async function handleListProjects(): Promise<ListProjectsResult> {
  const url = `${MINDSPACE_API_URL}/api/projects`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': MINDSPACE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Mindspace API error: ${response.status} ${response.statusText}`);
  }

  const projects = await response.json() as ProjectSummary[];

  return {
    count: projects.length,
    projects,
    message: projects.length > 0
      ? `Found ${projects.length} project(s): ${projects.map(p => p.name || p.slug).join(', ')}`
      : 'No projects found. Use the Mindspace API to create a project first.'
  };
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string;
}

export interface ListProjectsResult {
  count: number;
  projects: ProjectSummary[];
  message: string;
}
