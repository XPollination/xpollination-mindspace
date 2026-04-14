---
name: xpo.liaison.startTask
description: Process a liaison task from the Hive (approval, review, content)
user-invocable: true
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
---

# LIAISON Task Execution

You received a task slug. Execute it using MCP tools for all Hive communication.

## Step 1: Get Task Details

Call MCP tool `get_task` with the slug from the skill arguments.

Read: `title`, `status`, `dna.description`, `dna.findings`, `dna.implementation`, `dna.qa_review`, `dna.pdsa_review`.

## Step 2: Brain Context

Call MCP tool `query_brain` with prompt: "context for task {slug} {title}"

## Step 3: Process Based on Status

### If status = approval (PDSA design needs human decision)
- Review the proposed design in `dna.proposed_design`
- Present to Thomas: management abstract, scope, risk, recommendation
- In autonomous mode: decide immediately, document in `liaison_reasoning`
- Deliver with transition: "approved" or "rework"

### If status = review+liaison (final review before complete)
- Review `dna.findings`, `dna.implementation`, QA/PDSA reviews
- Present to Thomas: what was done, review chain results, recommendation
- Deliver with transition: "complete" or "rework"

### If status = ready/active+liaison (content task)
- Do the content work described in DNA
- Deliver with transition: "review"

## Step 4: Deliver

Call MCP tool `deliver_task` with:
- `slug`: the task slug
- `transition`: based on Step 3 decision
- `findings`: your review summary or content work
- `learnings`: key decisions and reasoning (minimum 50 characters)

The tool automatically contributes your learnings to brain before delivering.
