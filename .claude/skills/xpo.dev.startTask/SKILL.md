---
name: xpo.dev.startTask
description: Execute a development task from the Hive
user-invocable: true
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

# DEV Task Execution

You received a task slug. Execute it using MCP tools for all Hive communication.

## Step 1: Get Task Details

Call MCP tool `get_task` with the slug from the skill arguments.

Read the response: `title`, `dna.description`, `dna.proposed_design`, `dna.role`, `dna.constraints`.

If the task is not found or not in `active` status for your role, stop and report.

## Step 2: Brain Context

Call MCP tool `query_brain` with prompt: "context for task {slug} {title}"

Read relevant prior decisions, patterns, and learnings.

## Step 3: Implement

Do the development work described in the task DNA:
- Read existing code before modifying
- Follow git protocol: specific file staging, atomic commands, one-liner commits, immediate push
- Write/run tests if applicable
- Do NOT over-engineer — implement exactly what was requested

## Step 4: Deliver

When done, call MCP tool `deliver_task` with:
- `slug`: the task slug
- `transition`: "review"
- `findings`: what you implemented (files changed, approach taken)
- `learnings`: key decisions, patterns, what to remember (minimum 50 characters)

The tool automatically contributes your learnings to brain before delivering.

If delivery fails (gate error), read the error and fix what's missing.
