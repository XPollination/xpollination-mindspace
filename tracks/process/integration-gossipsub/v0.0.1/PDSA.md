# PDSA: integration-gossipsub

## Plan

Evaluate and decide: keep custom flood protocol or replace with GossipSub.

### Context

DEV built custom `/xp0/pubsub/1.0.0` flood protocol because `@chainsafe/libp2p-gossipsub` v14 had subscription exchange issues with libp2p v3. The flood protocol works but sends every message to ALL peers (O(n) per message).

### Decision: KEEP FLOOD PROTOCOL FOR NOW

**Rationale:**
1. Current network is small (2-10 peers). O(n) flood is acceptable.
2. GossipSub adds complexity for mesh management with little benefit at this scale.
3. The flood protocol passes all 10 transport tests.
4. When scale matters (50+ peers), revisit GossipSub or switch to libp2p v4.

**What to do instead:**
1. Document the flood protocol as intentional (not a hack)
2. Add message deduplication (seen-message cache) to prevent loops
3. Add TTL to messages (max 5 hops) as safeguard
4. Add a TODO comment with the threshold: "Revisit when >20 peers"

### Acceptance Criteria
1. Flood protocol documented as design choice
2. Message deduplication prevents loops
3. TTL prevents unbounded propagation
4. All existing transport tests pass

### Dev Instructions
1. Add `seenMessages: Set<string>` (CID-based) to transport
2. Skip messages already in seen set
3. Add TTL field to published messages, decrement on relay
4. Add doc comment explaining flood vs GossipSub decision
