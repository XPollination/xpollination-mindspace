# PDSA: Agent-Station Visualization Redesign (Object-Oriented)

**Date:** 2026-02-03
**Node:** viz-agent-stations-redesign (ACTIVE)
**Supersedes:** viz-agent-stations-design
**REQUIRES THOMAS REVIEW BEFORE IMPLEMENTATION**

## PLAN

### Feedback Summary
Previous design missed the key conceptual model:
- Stations are **sandboxes** where work happens
- Objects (packages) get **loaded** into stations
- Agents **log on** to stations to work on objects
- Objects get **unpacked** (executed) at the station

### Revised Conceptual Model

```
┌──────────────────────────────────────────────────────────────────┐
│                         WAREHOUSE VIEW                            │
│                                                                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐             │
│  │  STATION 1  │   │  STATION 2  │   │  STATION 3  │             │
│  │  [PDSA]     │   │  [DEV]      │   │  [QA]       │             │
│  │  logged on  │   │  logged on  │   │  idle       │             │
│  │             │   │             │   │             │             │
│  │  ┌───────┐  │   │  ┌───────┐  │   │             │             │
│  │  │ pkg-1 │  │   │  │ pkg-2 │  │   │             │             │
│  │  │unpacking│  │   │  │unpacking│  │   │             │             │
│  │  └───────┘  │   │  └───────┘  │   │             │             │
│  └─────────────┘   └─────────────┘   └─────────────┘             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ QUEUE (pending objects)                                      │ │
│  │ [pkg-3] [pkg-4] [pkg-5]                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ COMPLETED (archived objects)                                 │ │
│  │ [pkg-0] ✓                                                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Key Concepts

#### 1. Station = Sandbox
A station is a workspace where an agent operates:
- Has a **role** (pdsa, dev, qa, orchestrator, human)
- Can have **one agent logged on** at a time
- Can have **one object loaded** for processing
- Objects are "unpacked" (worked on) at the station

#### 2. Object = Work Item (Package)
An object is a mindspace_node:
- Starts in **QUEUE** (pending)
- Gets **loaded** into a station (active)
- Gets **unpacked** (worked on by logged-on agent)
- Moves to **COMPLETED** when done

#### 3. Agent Logon Flow
```
1. Agent available → logs on to station matching role
2. Station pulls next object from queue
3. Object loaded into station
4. Agent unpacks (works on) object
5. Object completed → moves to COMPLETED
6. Station pulls next object (or agent logs off)
```

### MCP Schema Changes

#### Stations Table (NEW)
```sql
CREATE TABLE stations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))),
  role TEXT NOT NULL,                    -- 'pdsa', 'dev', 'qa', 'orchestrator', 'human'
  name TEXT NOT NULL,                    -- 'PDSA Station', 'Dev Station', etc.
  agent_id TEXT,                         -- Currently logged on agent (null = idle)
  current_object_id TEXT,                -- Currently loaded object (FK to mindspace_nodes)
  status TEXT DEFAULT 'idle',            -- 'idle', 'working', 'blocked'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_object_id) REFERENCES mindspace_nodes(id)
);

-- Default stations
INSERT INTO stations (role, name) VALUES
  ('pdsa', 'PDSA Station'),
  ('dev', 'Dev Station'),
  ('qa', 'QA Station'),
  ('orchestrator', 'Orchestrator Station'),
  ('human', 'Human Station');
```

#### Agent Logon/Logoff
```sql
-- Agent logs on to station
UPDATE stations SET agent_id = 'pdsa-agent-001', status = 'working' WHERE role = 'pdsa';

-- Agent logs off
UPDATE stations SET agent_id = NULL, status = 'idle' WHERE role = 'pdsa';
```

#### Object Load/Unload
```sql
-- Load object into station
UPDATE stations SET current_object_id = '...' WHERE id = '...';
UPDATE mindspace_nodes SET status = 'active' WHERE id = '...';

-- Unload object (complete)
UPDATE stations SET current_object_id = NULL WHERE id = '...';
UPDATE mindspace_nodes SET status = 'completed' WHERE id = '...';
```

### Visualization Components

#### 1. Station Renderer
```javascript
function renderStations() {
  // Fetch stations from data.json
  stations.forEach(station => {
    // Draw station box
    // Show role label
    // Show agent badge if logged on
    // Show current object if loaded
  });
}
```

#### 2. Queue Renderer
```javascript
function renderQueue() {
  const queuedObjects = nodes.filter(n => n.status === 'pending');
  // Draw queue area
  // Show pending objects as small cards
}
```

#### 3. Completed Renderer
```javascript
function renderCompleted() {
  const completedObjects = nodes.filter(n =>
    n.status === 'completed' || n.status === 'done'
  );
  // Draw completed area
  // Show completed objects with checkmarks
}
```

### Data Export Enhancement
```json
{
  "stations": [
    {
      "id": "s1",
      "role": "pdsa",
      "name": "PDSA Station",
      "agent_id": "pdsa-001",
      "current_object_id": "node-123",
      "status": "working"
    }
  ],
  "nodes": [...],
  "queue_count": 5,
  "completed_count": 12
}
```

## Acceptance Criteria
- [ ] Stations table exists with 5 default stations (pdsa, dev, qa, orchestrator, human)
- [ ] Visualization shows stations as sandboxes
- [ ] Logged-on agents shown on their stations
- [ ] Current objects shown inside stations
- [ ] Queue area shows pending objects
- [ ] Completed area shows finished objects
- [ ] Agent logon/logoff updates station in real-time
- [ ] Object load/unload updates station in real-time

## DO

### Implementation Sequence
1. Create `stations` table with schema above
2. Update export script to include stations
3. Refactor visualization to show stations/queue/completed layout
4. Add agent logon tracking (agents call `UPDATE stations...` on start)
5. Add object load tracking (status change triggers station update)
6. Test with live agent activity

**HOLD FOR THOMAS REVIEW** - This design requires approval before implementation.

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)
