# PDSA: runner-auth-identity

## Plan

Implement the authentication and identity layer in `src/xp0/auth/`. This is the trust foundation — without it, any process can impersonate a runner.

### Key Decisions

1. **Ed25519 for signing, did:key for identity** — industry standard, already used in twin kernel. `@noble/ed25519` + `@noble/hashes` already installed.

2. **did:key encoding** — `did:key:z6Mk{base58btc(0xed01 + publicKey)}`. The `0xed01` prefix identifies Ed25519 keys per the did:key spec. Use `multiformats` for base58btc encoding.

3. **Delegation VC = a signed twin** — not a separate data structure. A delegation VC is an object-twin with schema `xp0/delegation-vc/v0.0.1`, signed by the owner. The twin kernel's `create()` + `sign()` produce it.

4. **Revocation = twin evolution** — tombstone a delegation VC by evolving it with `{state: "revoked", revokedAt: ISO8601}`. The new twin is signed by the owner.

5. **Challenge-response for session authentication** — nonce + timestamp, signed by runner, verified by owner's DID.

### File Layout

```
src/xp0/auth/
  index.ts           — re-exports
  types.ts           — DelegationVC, ChallengeResponse, AuthScope interfaces
  identity.ts        — generateKeyPair, deriveDID, didToPublicKey
  delegation.ts      — createDelegationVC, verifyDelegation, revokeDelegation, isDelegationRevoked
  challenge.ts       — createChallenge, signChallenge, verifyChallenge
  identity.test.ts   — keygen + DID tests
  delegation.test.ts — VC lifecycle tests
  challenge.test.ts  — challenge-response tests
```

### Types

```typescript
// src/xp0/auth/types.ts

interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

interface AuthScope {
  operations: string[];    // e.g., ["claim-tasks", "evolve-tasks", "create-result-twins"]
  roles: string[];         // e.g., ["dev", "pdsa"]
  projects: string[];      // e.g., ["mindspace"]
}

interface DelegationVCContent {
  issuer: string;          // did:key of owner
  subject: string;         // did:key of runner/delegate
  scope: AuthScope;
  validFrom: string;       // ISO 8601
  validUntil: string;      // ISO 8601
}

interface ChallengePayload {
  nonce: string;           // random hex string
  timestamp: string;       // ISO 8601
  did: string;             // challenger's DID
}
```

### Functions

```typescript
// identity.ts
generateKeyPair(): Promise<KeyPair>
  — ed25519.utils.randomPrivateKey() → derive public key

deriveDID(publicKey: Uint8Array): string
  — did:key:z6Mk{base58btc(multicodec_prefix + publicKey)}

didToPublicKey(did: string): Uint8Array
  — reverse of deriveDID, extract raw public key bytes

// delegation.ts
createDelegationVC(issuerKeyPair, subjectDID, scope, validUntil): Promise<SignedTwin>
  — create twin with kind='object', schema='xp0/delegation-vc/v0.0.1'
  — sign with issuer's private key
  — returns signed twin

verifyDelegation(vcTwin, operation, role, project): Promise<{valid, reason?}>
  — verify twin signature (using twin kernel's verify())
  — check operation in scope.operations
  — check role in scope.roles
  — check project in scope.projects
  — check now >= validFrom && now <= validUntil
  — check state !== 'revoked'

revokeDelegation(vcTwin, ownerKeyPair): Promise<SignedTwin>
  — evolve the VC twin with state='revoked', revokedAt=now
  — sign with owner's key
  — returns new evolved twin (old VC unchanged, immutable)

isDelegationRevoked(vcTwin): boolean
  — check vcTwin.state === 'revoked'

// challenge.ts
createChallenge(did: string): ChallengePayload
  — generate random nonce, current timestamp

signChallenge(challenge: ChallengePayload, privateKey: Uint8Array): string
  — JSON.stringify(challenge) → SHA-256 → Ed25519 sign → hex

verifyChallenge(challenge, signature, did): boolean
  — extract public key from DID → verify signature
  — check timestamp within 5 minutes (replay protection)
```

### DID:Key Encoding Details

```
did:key format: did:key:z{multibase_base58btc(multicodec_prefix + raw_key)}

Ed25519 multicodec prefix: 0xed01 (2 bytes)
Base58btc multibase prefix: 'z'

Encode: did:key:z + base58btc(Buffer.from([0xed, 0x01, ...publicKey]))
Decode: strip "did:key:z", base58btc decode, strip first 2 bytes → raw public key
```

### Dependencies on Twin Kernel

- `create()` — to create delegation VC twins
- `sign()` — to sign delegation VCs
- `verify()` — to verify delegation VC signatures
- `evolve()` — to revoke delegation VCs
- `@noble/ed25519` — for key generation (already used by kernel)
- `multiformats` — for base58btc encoding in DID

### New Dependency

- Need `@noble/curves` or `@noble/ed25519` X25519 conversion for future secret encryption. **For this task, skip X25519** — it's needed by runner-secret-bootstrap, not here. Only do Ed25519 + DID + delegation VC.

### Acceptance Criteria Mapping

| Criterion | Function | Test |
|-----------|----------|------|
| Valid Ed25519 pair | generateKeyPair() | Generate, sign, verify roundtrip |
| Valid did:key URI | deriveDID() | Generate key, derive DID, verify format |
| DID roundtrip | deriveDID() + didToPublicKey() | DID → pubkey → DID matches |
| Signed delegation VC | createDelegationVC() | Create VC, verify twin signature |
| Verify scope/expiry | verifyDelegation() | Pass matching scope → valid, wrong scope → invalid |
| Expired VC rejected | verifyDelegation() | Set validUntil to past → invalid |
| Challenge roundtrip | create/sign/verifyChallenge() | Full roundtrip succeeds |
| Revocation works | revokeDelegation() | Revoke → isDelegationRevoked returns true |
| T-SEC-1: rogue runner | verifyDelegation() | Wrong signer → invalid |
| T-SEC-2: impersonation | verifyChallenge() | Wrong key → false |

### Dev Instructions

1. Create `src/xp0/auth/types.ts` with interfaces
2. Create `src/xp0/auth/identity.ts` — generateKeyPair, deriveDID, didToPublicKey
3. Create `src/xp0/auth/delegation.ts` — VC lifecycle (uses twin kernel)
4. Create `src/xp0/auth/challenge.ts` — challenge-response
5. Create test files for each module
6. Update `src/xp0/auth/index.ts` barrel export
7. Run `npx tsc --noEmit` to verify compilation
8. Run `npx vitest run src/xp0/auth/` to verify all tests pass
9. Git add, commit, push each file

### What NOT To Do

- Do NOT implement X25519 key derivation (that's runner-secret-bootstrap)
- Do NOT implement storage for VCs (that's FileStorageAdapter concern)
- Do NOT implement DID resolution beyond did:key (no did:web, no DID registry)
- Do NOT implement key rotation (future concern)
- Do NOT add HSM or hardware key support (Phase 4)

## Study / Act

(Populated after implementation)
