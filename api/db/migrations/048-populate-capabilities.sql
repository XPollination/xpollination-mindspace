-- Populate 9 PLATFORM-001 capabilities linked to missions
-- Reassign 5 existing capabilities to new missions, insert 4 new
-- Legacy capabilities (org-brain, integration, requirements, marketplace, release) stay under mission-mindspace
-- Idempotent: UPDATE is safe to re-run, INSERT OR IGNORE for new

-- Reassign existing capabilities to PLATFORM-001 missions
UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Authentication: login, registration, invite system, JWT, session management'
  WHERE id = 'cap-auth';

UPDATE capabilities SET mission_id = 'mission-traversable-context',
  description = 'Task workflow engine: state machine, transitions, gates, DNA'
  WHERE id = 'cap-task-engine';

UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Agent protocol: monitor skill, recovery, working memory, continuity'
  WHERE id = 'cap-agent-protocol';

UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Core infrastructure: database, server, deployment, versioning'
  WHERE id = 'cap-foundation';

UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Quality gates: test pass, version bump, PDSA, liaison review'
  WHERE id = 'cap-quality';

-- Insert 4 new capabilities
INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-graph', 'mission-traversable-context', 'CAP-GRAPH',
        'Traversable context graph: hierarchy navigation, drill-down, cross-references',
        'active', 11);

INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-viz', 'mission-traversable-context', 'CAP-VIZ',
        'Dashboard visualization: real-time status, hierarchy views, agent monitoring',
        'active', 12);

INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-provenance', 'mission-fair-attribution', 'CAP-PROVENANCE',
        'Authorship tracking: contribution records, decision provenance, audit trail',
        'active', 13);

INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-token', 'mission-fair-attribution', 'CAP-TOKEN',
        'Token economics: contribution valuation, fair distribution, incentive alignment',
        'active', 14);
