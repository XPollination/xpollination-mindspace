# Documentation Practices — Living Document

**Last Updated:** 2026-03-02
**Status:** v1

This document describes how the team documents within the XPollination mindspace project. It is a living document — when practices change, this doc changes.

---

## Naming Conventions

### PDSA Documents
- **Location:** `tracks/<domain>/<task-slug>/v0.0.1/pdsa/`
- **Format:** `YYYY-MM-DD-<task-slug>.pdsa.md`
- **Example:** `tracks/brain-infrastructure/correction-lifecycle-activation/v0.0.1/pdsa/2026-03-02-correction-lifecycle-activation.pdsa.md`

### Completion Abstracts
- **Location:** `tracks/<domain>/<task-slug>/v0.0.1/abstract/`
- **Format:** `YYYY-MM-DD-<task-slug>.abstract.md`
- **Example:** `tracks/brain-infrastructure/correction-lifecycle-activation/v0.0.1/abstract/2026-03-02-correction-lifecycle-activation.abstract.md`

### General Rules
- Slugs use kebab-case (`my-task-name`)
- Dates use ISO format (`YYYY-MM-DD`)
- Version directories start at `v0.0.1`
- Domain directories match the track domain (e.g., `brain-infrastructure`, `process`, `content-pipeline`)

---

## Writing Abstracts

A completion abstract is a short management summary created when a task reaches `complete` or `cancelled`. It answers: **what happened, what changed, and what was learned?**

### Completion Abstract Template

```markdown
# Completion Abstract: <Task Title>

**Task:** <slug>
**Status:** complete | cancelled
**Date:** YYYY-MM-DD
**Author:** <agent or human>

## Outcome
<1-3 sentences: what was the result?>

## Changes Made
- <file or system changed>: <what changed>

## Key Decisions
- <decision>: <why>

## Documentation Objects Added
- <link to any new docs, PDSAs, or artifacts>

## Learnings
- <what the team learned from this task>
```

### Cancellation Abstract
For cancelled tasks, the abstract is shorter:
- **Outcome:** Why the task was cancelled
- **Context:** What was done before cancellation (if any)
- **Learnings:** What the team learned (even from cancellation)

### Quality Criteria
- Abstracts should be readable standalone (no assumed context)
- Link to related PDSA and DNA using GitHub URLs
- Keep it concise — management summary, not a full report
- Written by LIAISON as part of the completion transition

---

## Linking Conventions

### DNA References
- `pdsa_ref`: GitHub URL to the PDSA document
- `abstract_ref`: GitHub URL to the completion/cancellation abstract
- Both must be full GitHub URLs (e.g., `https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/tracks/...`)

### Cross-References
- PDSAs reference task slugs: `Task: <slug>`
- Abstracts reference both PDSA and task slug
- Use GitHub URLs for cross-repo references
- DNA is self-contained — all references should be resolvable from the DNA alone

### Git Protocol for Documentation
1. Write the document to the correct `tracks/` location
2. `git add <specific-file>`
3. `git commit -m "docs: <task-slug> abstract"`
4. `git push`
5. Use the GitHub URL (not local path) for `pdsa_ref` or `abstract_ref` in DNA

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-02 | v1 Initial document — naming, abstracts, linking | DEV |
