# Changelog: t2-1-attestation-message

## v0.0.1 — Initial Design

- PDSA design for ATTESTATION_REQUIRED + ATTESTATION_SUBMITTED A2A message types
- Migration 017: attestations table with status CHECK, 3 indexes
- ATTESTATION_REQUIRED: SSE push from server when transition needs attestation
- ATTESTATION_SUBMITTED: agent→server message handler with check coverage validation
- requestAttestation() helper creates record + pushes SSE
- 3 files: 017-attestations.sql (NEW), attestation.ts (NEW), a2a-message.ts (UPDATE)
- 16 test cases
