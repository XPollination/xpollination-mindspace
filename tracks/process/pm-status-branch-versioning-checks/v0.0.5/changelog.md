# Changelog: pm-status-branch-versioning-checks v0.0.5

## Changes from v0.0.4

- **Deployment action guidance**: Added DEPLOYMENT ACTION section — when deployment gap detected, present options (Deploy TEST, Deploy PROD, Skip) via AskUserQuestion. Documents symlink update, service restart via thomas SSH, and verification curl.
- **Performance reflection**: PDSA contains analysis of PM status skill performance (~10s, ~1000 tokens). Identifies 4 optimization opportunities: skill split (scan vs drill), brain health caching, lazy DNA loading, template compression. No implementation — findings only.
- **Preserved**: All v0.0.1-v0.0.4 changes.
