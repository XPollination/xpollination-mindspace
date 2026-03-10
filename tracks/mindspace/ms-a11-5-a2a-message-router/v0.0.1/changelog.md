# Changelog: ms-a11-5-a2a-message-router

## v0.0.1 — Initial Design

- PDSA design for A2A message router
- POST /a2a/message with type-based dispatch
- 6 message types: HEARTBEAT, ROLE_SWITCH, DISCONNECT (implemented), CLAIM_TASK, TRANSITION, RELEASE_TASK (stub 501)
- ACK/ERROR response format with original_type tracking
- Agent validation (exists, not disconnected)
- Bond renewal on heartbeat, bond expiry on disconnect
- 2 files: a2a-message.ts (NEW), server.ts (UPDATE)
- 18 test cases
