# Changelog: viz-prod-port-migration v0.0.2

## Changes from v0.0.1

- **Added Change I: Version deployment** — explicit symlink updates after infrastructure migration. PROD viz/active → v0.0.9 (current stable), TEST viz/active → v0.0.10 (latest develop).
- **Updated execution order** — version deployment as step 6, between service setup and reference updates.
- **5 new test criteria** — symlink targets, version API responses, service stability after deployment.
- **Preserved** all v0.0.1 changes (A-H).
