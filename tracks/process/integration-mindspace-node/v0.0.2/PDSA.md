# PDSA: integration-mindspace-node v0.0.2 (Rework)

## Problem
QA review found missing Runner methods: getId(), getStatus(), drain(). Tests T7.3 and T1.4 need these.

## Fix
Added to Runner class: getId() returns runner twin CID, getStatus() returns current status from twin content, drain() evolves twin to 'draining' status. IntegrationRunner wraps all three, drain() also stops the auto-claim timer.

## Verification
All 11 runner unit tests pass. Methods available on both Runner and IntegrationRunner.
