# Claude Knowledge Index - Long-Running Session

**Purpose:** Quick context recovery for permanent Claude session
**Project:** xpollination-mcp-server
**Last Updated:** 2026-01-29
**Session Type:** Persistent development session

---

## IMPORTANT: PARALLEL AGENT AWARENESS

**Another agent is working in parallel on other files in this repository.**

**Rules for this session:**
- Only modify files I created or am explicitly responsible for
- Do NOT touch files being worked on by other agents
- Always check git status before committing
- Only stage files I know are mine
- Document any file ownership questions

**My files (this session):**
- `docs/CLAUDE-KNOWLEDGE-INDEX.md` (this file)
- `docs/pdca/*.pdca.md`
- `docs/usecases/*.md`

---

## QUICK RECOVERY CHECKLIST

```bash
# 1. Verify environment
source ~/.nvm/nvm.sh && node --version  # v22.22.0

# 2. Navigate to active project
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server

# 3. Verify state
git status && npm run build && npm test
```

---

## ACTIVE PROJECT: XPollination MCP Server

### Project Vision (EXPANDED 2026-01-29)

**XPollination MCP Server** is an **Agentic Software Development Orchestration Framework** with two use cases:

1. **Use Case 1: Content Pipeline** - AI-generated blog posts with fact-checking
2. **Use Case 2: Software Development Pipeline** (PRIMARY) - Multi-agent autonomous coding

**The Big Picture:**
```
This Terminal (Human + Claude) → Define Requirements → MCP Server →
  → Orchestrator Agent → Specialist Agents (Architect/Coder/Tester/Reviewer) →
  → Quality Gates → Loop until criteria pass →
  → Return to This Terminal for Approval
```

### Current State (2026-01-29)

| Aspect | Status |
|--------|--------|
| **Repository** | https://github.com/PichlerThomas/xpollination-mcp-server (private) |
| **Local Path** | `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server` |
| **Branch** | `main` - clean, up to date |
| **Commits** | 8 total |
| **Build** | Working |
| **Tests** | 15 passing (FrameRepository) |

### Implementation Complete (Phase 1 - Content Pipeline)

- [x] MCP Server with @modelcontextprotocol/sdk
- [x] SQLite database with content schema
- [x] 8 Content Tools: create_frame, list_frames, crawl_trends, propose_topic, write_draft, fact_check, improve_draft, publish_post
- [x] 3 Content Resources: frames, drafts, queue
- [x] 3 Services: RssParser, TrendMatcher, GitPublisher
- [x] 2 Repositories: FrameRepository, DraftRepository

### Next Steps (Priority Reordered)

1. **Agentic Framework Design** (NEW PRIORITY)
   - [ ] Database schema extension for dev_specs, dev_tasks, code_units
   - [ ] Development tools: define_spec, execute_development_task
   - [ ] Orchestrator agent design
   - [ ] Specialist agent prompts (Architect, Coder, Tester, Reviewer)
   - [ ] Quality gate logic

2. **Unit Tests** (supports both use cases)
   - [x] FrameRepository.test.ts (15 tests)
   - [ ] DraftRepository.test.ts
   - [ ] New: DevSpecRepository.test.ts
   - [ ] New: DevTaskRepository.test.ts

3. **Content Pipeline Completion** (Use Case 1)
   - [ ] First Frame ("Fourth Temple")
   - [ ] Hugo site setup

### Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Development guide, architecture |
| `TODO.md` | Detailed test specifications |
| `src/index.ts` | MCP server entry point |
| `src/db/schema.sql` | Database schema |

---

## INFRASTRUCTURE OVERVIEW

### Systems Map

```
Thomas Pichler Infrastructure
├── Hetzner CX22 (142.132.190.254) - Cloud VPS
│   ├── VPN Server (10.33.33.1)
│   ├── Paperless-ngx
│   ├── Ollama (Gemma2:2b)
│   ├── Nginx + SSL
│   └── xpollination-dev container (port 2222) ← YOU ARE HERE
│
├── Synology DS218 (10.0.0.148 / 10.33.33.2 VPN) - NAS
│   ├── Home Assistant (8123)
│   ├── AdGuard DNS
│   ├── Ring-MQTT
│   └── WireGuard VPN client
│
└── Local LLM Server - RTX 2080 TI
    └── Ollama (mistral, llama2, codellama)
```

### Access Credentials Quick Reference

| System | Access |
|--------|--------|
| **Dev Container** | `ssh -p 2222 developer@142.132.190.254` (pwd: developer) |
| **Hetzner Host** | `ssh -i ~/.ssh/hetzner-cx22 thomas@142.132.190.254` |
| **Synology** | `ssh -i ~/.ssh/id_rsa_ds218 HomeAssistant@10.0.0.148` |
| **GitHub PAT** | `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` |

---

## CONTEXT HIERARCHY

### Documentation Tree

```
/home/developer/workspaces/github/PichlerThomas/
├── README.md                          # Root overview
│
├── xpollination-mcp-server/           # THIS PROJECT (PRIMARY CONTEXT)
│   ├── CLAUDE.md                      # Development guide
│   ├── TODO.md                        # Test specifications
│   ├── src/                           # Source code
│   └── docs/
│       ├── CLAUDE-KNOWLEDGE-INDEX.md  # THIS FILE
│       ├── pdca/
│       │   └── 2026-01-29-UTC-1100.01-agentic-development-framework.pdca.md
│       └── usecases/
│           ├── agent-development-framework.md  # Use Case 1 (PRIMARY)
│           └── xpollination-homepage.md        # Use Case 2 (Content)
│
└── HomeAssistant/                     # INFRASTRUCTURE DOCUMENTATION
    ├── CLAUDE.md                      # Git protocol, operational patterns
    └── systems/
        └── hetzner-cx22-ubuntu/
            └── credentials.md         # Server credentials, VPN, GitHub PAT
```

---

## GIT PROTOCOL (MANDATORY)

```bash
# ALWAYS specific files, NEVER bulk
git add src/specific/file.ts       # YES
git add .                          # NEVER

# Atomic commands, no chaining
git add file.ts
git commit -m "feat: description"
git push

# Ask before destructive ops
# Never force push, reset --hard without approval
```

---

## KEY LEARNINGS INDEX

### Synology DS218 (ARM64)

- **MySQL 8.0 FAILS** - Use MariaDB 10.11 instead
- **Doctrine migrations hang** - Use `doctrine:schema:update --force`
- **/tmp has noexec** - Use `bash /tmp/script.sh`
- **Sudo automation** - `echo 'PASS' | sudo -S -i COMMAND`

### WireGuard VPN

- **Synology** - No kernel module, use `wireguard-go` + `network_mode: host`
- **TUN device** - Create at boot: `mknod /dev/net/tun c 10 200`
- **Hetzner** - Bidirectional iptables: `-i wg0` AND `-o wg0`

### Paperless-ngx

- **Gemma2:2b** - Fits in 4GB RAM for auto-titles
- **OLLAMA_KEEP_ALIVE=30s** - Unloads quickly to free RAM
- **ASN assignment** - Use as "processing complete" trigger

---

## XPOLLINATION ARCHITECTURE

### Use Case 1: Content Pipeline Flow

```
1. crawl_trends(frames) → trending_topics
2. propose_topic(trending_topics) → proposals
3. [USER GATE: select topic, add framing]
4. write_draft(approved_proposal) → draft
5. fact_check(draft) → verification_report
6. IF fail: improve_draft(draft, issues) → goto 5
7. [USER GATE: approve/reject]
8. publish_post(final_draft) → deployed
```

### Use Case 2: Software Development Pipeline (PRIMARY)

```
HUMAN TERMINAL (This Session)
      │
      ▼ define_spec + acceptance_criteria (GIVEN/WHEN/THEN)
      │
MCP SERVER (State Management)
      │
      ▼ execute_development_task
      │
ORCHESTRATOR AGENT (Claude #2)
      │
      ├──► ARCHITECT AGENT → Interfaces, contracts
      ├──► CODER AGENT → OOP implementation (small methods)
      ├──► TESTER AGENT → Execute tests against criteria
      └──► REVIEWER AGENT → Code review, OOP compliance
            │
            ▼
      QUALITY GATE
      │
      ├─ PASS → Return to Human Terminal for approval
      └─ FAIL → Loop back to Architect (max 5 iterations)
```

### Agent Roles

| Agent | Purpose | Output |
|-------|---------|--------|
| **Orchestrator** | Coordinate workflow, manage iterations | Task assignments, status |
| **Architect** | Design interfaces, contracts | Interface definitions |
| **Coder** | Implement methods (OOP, small units) | Single method implementations |
| **Tester** | Generate and run tests | Test results mapped to criteria |
| **Reviewer** | Code review, SOLID compliance | Approval/rejection with feedback |

### Key Constraint: OOP Mandatory

- Coder returns **single methods**, not entire files
- All code must follow **SOLID principles**
- Acceptance criteria use **GIVEN/WHEN/THEN** format
- Tests map 1:1 to acceptance criteria

### First Frame: Fourth Temple (Content Use Case)

**Concept:** 1st/2nd Temple (physical) → 3rd Temple (we humans) → 4th Temple (collective)

**Keywords:** Christianity, Freikirche, spiritual transformation, servant leadership, ecclesia, metanoia

---

## SKILL LOADING PROTOCOL

### When to Load Context

| Scenario | Load These Files |
|----------|------------------|
| **Agentic Framework** | `docs/pdca/2026-01-29-UTC-1100.01-agentic-development-framework.pdca.md` |
| **MCP Development** | `CLAUDE.md`, `TODO.md` |
| **Use Case Overview** | `docs/usecases/agent-development-framework.md` or `xpollination-homepage.md` |
| **Database Schema** | `src/db/schema.sql` |
| **Test Specs** | `TODO.md` |
| **Infrastructure/Credentials** | `../HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md` |

### When to Update This Index

- After completing major milestones
- When architecture changes
- When credentials change
- After significant session work

---

## SESSION NOTES

*Add session-specific notes here during long-running work*

### 2026-01-29

- Session started, context recovered from SESSION-RECOVERY file
- 8 commits in xpollination-mcp-server, 15 tests passing (FrameRepository)
- **MAJOR PIVOT:** User expanded project scope
  - Original: Content pipeline for xpollination.earth
  - Expanded: **Agentic Software Development Orchestration Framework**
  - Content pipeline becomes Use Case 1, Development pipeline becomes Use Case 2 (PRIMARY)
- Conducted research on:
  - Multi-agent systems (Gartner: 1,445% surge in inquiries)
  - MCP vs A2A protocols
  - Spec-Driven Development (GIVEN/WHEN/THEN)
  - Agentic Swarm Coding patterns
  - Claude Agent SDK patterns
- Created comprehensive PDCA: `2026-01-29-UTC-1100.01-agentic-development-framework.pdca.md`
- Key architecture decisions:
  - This terminal = Requirements + Final Approval
  - MCP Server = State management + Tool interface
  - Orchestrator Agent = Process coordination
  - Specialist Agents = Architect, Coder, Tester, Reviewer
  - OOP mandatory, single-method returns, GIVEN/WHEN/THEN acceptance criteria
- **RESTRUCTURE COMPLETED:**
  - Moved documentation from `HomeAssistant/systems/hetzner-cx22-ubuntu/pdca/xpollination-homepage/` to `xpollination-mcp-server/docs/`
  - Created proper structure: `docs/pdca/`, `docs/usecases/`
  - Committed and pushed: `c478e51`
  - **CLEANUP NEEDED (HomeAssistant repo):** Old files may exist in wrong location - leave for user/other agent to handle
- **PARALLEL AGENT NOTE:** Another agent working on other files - only touching my docs
- **Next:** User reviewing PDCA, awaiting feedback

---

**Recovery Test:** If you can read this file and understand the context, you're ready to continue work.
