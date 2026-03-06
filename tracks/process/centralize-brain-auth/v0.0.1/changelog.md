# Changelog: centralize-brain-auth v0.0.1

## Summary
Centralized brain API auth into single brain-curl.sh wrapper, removing scattered headers from 5 skill files.

## Changes
- Created `xpollination-best-practices/scripts/brain-curl.sh` — exec curl with Content-Type + Authorization headers, fails on missing BRAIN_API_KEY
- Updated 5 skill files (monitor, brain, clear, reflect, garden) to use brain-curl.sh
- Removed AUTH_HDR variable from monitor skill
- Updated claude-session.sh PATH to include scripts directory

## Commits
- xpollination-best-practices: 64e59e6
- HomeAssistant: bf3c98c

## Verification
- 19/19 tests pass
- QA: PASS
- PDSA: PASS
