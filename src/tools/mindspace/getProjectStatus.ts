/**
 * mindspace_get_project_status MCP Tool
 *
 * Returns project overview: details, members, and progressive data
 * from available endpoints. Graceful degradation for missing endpoints.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const MINDSPACE_API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const MINDSPACE_API_KEY = process.env.MINDSPACE_API_KEY || '';

export const getProjectStatusInputSchema = z.object({
  project_slug: z.string().describe('The project slug to get status for')
});

export const getProjectStatusTool: Tool = {
  name: 'mindspace_get_project_status',
  description: 'Get project status overview including details, members, task distribution, and active agents. Returns a comprehensive snapshot of the project state. Gracefully degrades when some data sources are unavailable.',
  inputSchema: {
    type: 'object',
    properties: {
      project_slug: {
        type: 'string',
        description: 'The project slug to get status for'
      }
    },
    required: ['project_slug']
  }
};

// Helper function for DRY HTTP calls with graceful degradation
async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const url = `${MINDSPACE_API_URL}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': MINDSPACE_API_KEY,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    // Graceful degradation: return null for unreachable endpoints
    return null;
  }
}

export async function handleGetProjectStatus(
  input: { project_slug: string }
): Promise<ProjectStatusResult> {
  const { project_slug } = input;

  // Fetch project details
  const project = await apiGet<any>(`/api/projects/${project_slug}`);
  if (!project) {
    throw new Error(`Project not found: ${project_slug}`);
  }

  // Fetch members (graceful fallback to empty array)
  const members = await apiGet<any[]>(`/api/projects/${project_slug}/members`) || [];

  // Future endpoints — graceful degradation returns null
  const tasks = await apiGet<any>(`/api/projects/${project_slug}/tasks`);
  const agents = await apiGet<any>(`/api/projects/${project_slug}/agents`);
  const approvals = await apiGet<any>(`/api/projects/${project_slug}/approvals`);

  const status: ProjectStatusResult = {
    project: {
      slug: project.slug,
      name: project.name,
      description: project.description,
      created_at: project.created_at
    },
    members: {
      count: members.length,
      list: members.map((m: any) => ({
        name: m.name || m.email,
        role: m.role,
        email: m.email
      }))
    },
    tasks: tasks || { available: false, message: 'Task endpoints not yet deployed' },
    agents: agents || { available: false, message: 'Agent endpoints not yet deployed' },
    approvals: approvals || { available: false, message: 'Approval endpoints not yet deployed' },
    message: `Project "${project.name}" has ${members.length} member(s).`
  };

  return status;
}

export interface ProjectStatusResult {
  project: {
    slug: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  members: {
    count: number;
    list: Array<{ name: string; role: string; email: string }>;
  };
  tasks: any;
  agents: any;
  approvals: any;
  message: string;
}
