# XLN Platform – Final Technical Specification

**Version 2.0.0 · December 2024**  
_Evolution from actor-model (xlnspec) → full architecture (spec_old) → code-as-law (spec_new)_

---

## 0. Executive Summary

XLN is a multi-entity Byzantine Fault Tolerant (BFT) consensus platform implementing a pure functional state machine architecture. This specification documents the current implementation (`src/server.ts`) while preserving the architectural vision from previous iterations for future development.

### Key Design Decisions

1. **Pure Functional Core**: Replaced actor model with `(prevState, input) → {nextState, outputs}`
2. **EVM-Compatible Signatures**: Using ethers.js `signMessage`/`verifyMessage` instead of BLS for on-chain verification
3. **Environment-Based Architecture**: Central `Env` container manages all state and side effects
4. **Time-Machine Debugging**: Complete snapshot history for deterministic replay

---

## 1. Current Implementation (Code-as-Law)

### 1.1 Core Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Environment (Env)                  │
│  ┌─────────────────────────────────────────────┐   │
│  │              Server (100ms ticks)            │   │
│  │  ┌─────────────────────────────────────┐    │   │
│  │  │        EntityReplica (alice:chat)    │    │   │
│  │  │  ┌─────────────────────────────┐    │    │   │
│  │  │  │      EntityState             │    │    │   │
│  │  │  │  - height                    │    │    │   │
│  │  │  │  - messages[]                │    │    │   │
│  │  │  │  - proposals{}               │    │    │   │
│  │  │  │  - config (consensus)        │    │    │   │
│  │  │  └─────────────────────────────┘    │    │   │
│  │  │  - mempool[]                        │    │   │
│  │  │  - proposal?                        │    │   │
│  │  │  - isProposer                       │    │   │
│  │  └─────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────┘   │
│  - replicas: Map<string, EntityReplica>            │
│  - height: number                                   │
│  - timestamp: number                                │
│  - serverInput: ServerInput (persistent)            │
└─────────────────────────────────────────────────────┘
```

### 1.2 Data Types (TypeScript)

```typescript
// === CONSENSUS CONFIGURATION ===
interface ConsensusConfig {
  mode: "proposer-based" | "gossip-based";
  threshold: bigint; // Required voting power
  validators: string[]; // Ordered list of signers
  shares: Record<string, bigint>; // signerId → voting power
}

// === SERVER LAYER ===
interface ServerInput {
  serverTxs: ServerTx[]; // Replica imports
  entityInputs: EntityInput[]; // Entity messages
}

interface ServerTx {
  type: "importReplica";
  entityId: string;
  signerId: string;
  data: {
    config: ConsensusConfig;
    isProposer: boolean;
  };
}

// === ENTITY LAYER ===
interface EntityInput {
  entityId: string;
  signerId: string;
  entityTxs?: EntityTx[];
  precommits?: Map<string, string>; // signerId → signature
  proposedFrame?: ProposedEntityFrame;
}

type EntityTx =
  | { type: "chat"; data: { from: string; message: string } }
  | { type: "propose"; data: { proposer: string; action: ProposalAction } }
  | {
      type: "vote";
      data: { voter: string; proposalId: string; choice: "yes" | "no" };
    };

interface ProposalAction {
  type: "collective_message";
  data: { message: string };
}

interface Proposal {
  id: string; // Deterministic hash
  proposer: string;
  action: ProposalAction;
  votes: Map<string, "yes" | "no">;
  status: "pending" | "executed" | "rejected";
  created: number; // Timestamp
}

// === STATE MANAGEMENT ===
interface EntityState {
  height: number; // Last committed frame
  nonces: Map<string, number>; // Per-signer nonces
  messages: string[]; // Chat history (max 10)
  proposals: Map<string, Proposal>;
  config: ConsensusConfig;
}

interface ProposedEntityFrame {
  height: number;
  txs: EntityTx[];
  hash: string;
  newState: EntityState;
  signatures: Map<string, string>;
}

interface EntityReplica {
  entityId: string;
  signerId: string;
  state: EntityState;
  mempool: EntityTx[];
  proposal?: ProposedEntityFrame;
  isProposer: boolean;
}
```

### 1.3 Consensus Flow

```
1. ADD_TX → mempool
   └─→ 2. PROPOSE (if proposer & mempool > 0)
       └─→ 3. SIGN (validators sign frame)
           └─→ 4. COMMIT (threshold reached)
               └─→ 5. NOTIFY (broadcast committed frame)
```

### 1.4 Signature Implementation

**Current (Demo)**: Mock signatures as `sig_${signerId}_${hash}`

**Future (Production)**: Ethers.js ECDSA signatures

```typescript
// Signing
const signature = await signer.signMessage(frameHash);

// Verification (EVM-compatible)
const recoveredAddress = ethers.utils.verifyMessage(frameHash, signature);
assert(recoveredAddress === signerAddress);
```

---

## 2. Architectural Heritage (From Previous Versions)

### 2.1 Hierarchical Vision (from xlnspec.md)

The original actor-based design envisioned:

```
Server (User's root machine)
  └─→ Signer (Key management)
      └─→ Entity (Business logic)
          └─→ Channel (Bilateral accounts)
```

This hierarchy is partially implemented:

- ✅ Server routes messages and maintains global state
- ✅ Replicas represent Signer-Entity pairs
- ❌ Channels not yet implemented
- ❌ Separate Signer layer merged into replicas

### 2.2 Production Features (from spec_old.md)

Planned but not yet implemented:

#### Persistence Layer

```
├── Write-Ahead Log (WAL)     - Every 100ms tick
├── Mutable Snapshots         - Fast recovery
├── Immutable CAS             - Audit trail
└── LevelDB Storage           - Key-value backend
```

#### Wire Protocol

- RLP encoding for efficient serialization
- Deterministic ordering rules
- Binary-safe key schemes

#### Security Features

- Real cryptographic signatures (ethers.js)
- Byzantine fault detection
- Bounded mempool size
- Rate limiting

---

## 3. Consensus Mechanisms

### 3.1 Proposer-Based Mode

```
Alice(proposer) → Frame → Bob, Carol
Bob → Signature → Alice
Carol → Signature → Alice
Alice → Commit(Frame + Signatures) → Bob, Carol
```

- Single proposer per entity
- Direct signature collection
- Efficient for small validator sets

### 3.2 Gossip-Based Mode

```
Alice(proposer) → Frame → Bob, Carol, David
Bob → Signature → Alice, Carol, David
Carol → Signature → Alice, Bob, David
David → Signature → Alice, Bob, Carol
[Any validator with threshold] → Commit → All
```

- All validators relay signatures
- More resilient to network partitions
- Higher message complexity

### 3.3 Voting Power & Thresholds

```typescript
// Example configurations
const equalPower = {
  threshold: 2n,
  shares: { alice: 1n, bob: 1n, carol: 1n }, // 2-of-3
};

const weightedPower = {
  threshold: 7n,
  shares: { alice: 4n, bob: 3n, carol: 2n, david: 1n }, // 70%
};

const byzantineFault = {
  threshold: 10n,
  shares: { alice: 3n, bob: 3n, carol: 3n, david: 3n, eve: 3n }, // 67%
};
```

---

## 4. State Management

### 4.1 Immutability Strategy

- **Transaction Level**: Each tx returns new state
- **Frame Level**: Batch of txs atomically applied
- **Replica Level**: Mutable for performance
- **Snapshot Level**: Deep clones for history

### 4.2 Time Machine Architecture

```typescript
interface EnvSnapshot {
  height: number;
  timestamp: number;
  replicas: Map<string, EntityReplica>;
  serverInput: ServerInput;
  description: string;
}

// Global history
const envHistory: EnvSnapshot[] = [];

// API
getHistory(): EnvSnapshot[]
getSnapshot(index: number): EnvSnapshot | null
resetHistory(): void
```

### 4.3 Determinism Requirements

1. **Proposal IDs**: SHA-256 hash of `{action, proposer, timestamp}`
2. **Signature Ordering**: By validator index in config
3. **Input Merging**: Deduplication by `${entityId}:${signerId}`
4. **No Randomness**: All operations deterministic

---

## 5. Application Layer

### 5.1 Current Transaction Types

#### Chat Messages

```typescript
{ type: 'chat', data: { from: 'alice', message: 'Hello!' } }
```

- Increments sender nonce
- Appends to message history
- Maintains 10-message limit

#### Governance Proposals

```typescript
{
  type: 'propose',
  data: {
    proposer: 'alice',
    action: {
      type: 'collective_message',
      data: { message: 'Proposal text' }
    }
  }
}
```

- Generates deterministic proposal ID
- Auto-votes 'yes' for proposer
- Executes immediately if proposer has threshold

#### Voting

```typescript
{
  type: 'vote',
  data: {
    voter: 'bob',
    proposalId: 'prop_abc123...',
    choice: 'yes'
  }
}
```

- Updates vote tally
- Executes on threshold
- Ignores if already executed

### 5.2 Future Transaction Types

```typescript
// Channel operations
{ type: 'openChannel', data: { counterparty, collateral } }
{ type: 'updateChannel', data: { channelId, newBalance } }
{ type: 'closeChannel', data: { channelId, finalState } }

// Asset management
{ type: 'mint', data: { asset, amount, recipient } }
{ type: 'transfer', data: { asset, amount, to } }
{ type: 'burn', data: { asset, amount } }

// Cross-entity messaging
{ type: 'crossEntityCall', data: { targetEntity, method, params } }
```

---

## 6. Implementation Guidelines

### 6.1 Browser Compatibility

Current polyfills for browser environment:

- `createHash`: Simple deterministic hash (not crypto-secure)
- `randomBytes`: Uses `crypto.getRandomValues`
- `Buffer`: Uint8Array wrapper
- `rlp`: No-op placeholder
- `debug`: Console logging with namespace filtering

### 6.2 Performance Optimizations

1. **Mutable Operations**: Mempool and signature collection
2. **Batch Processing**: All txs in frame applied together
3. **Lazy Evaluation**: Frame state computed once during proposal
4. **Input Merging**: Deduplication before processing

### 6.3 Security Considerations

**Current Limitations**:

- Mock signatures (no actual cryptography)
- Unbounded mempool size
- No rate limiting
- No Byzantine fault detection

**Future Hardening**:

- Ethers.js signatures with EVM verification
- Mempool bounds and prioritization
- Rate limiting per signer
- Slashing for protocol violations

---

## 7. Future Roadmap

### Phase 1: Production Hardening (Current Focus)

- [x] BFT consensus with weighted voting
- [x] Governance proposals
- [x] Time-machine debugging
- [ ] Ethers.js signature integration
- [ ] Persistence layer (LevelDB)
- [ ] Wire protocol (RLP encoding)

### Phase 2: Channel Layer

- [ ] Bilateral state channels
- [ ] HTLC for atomic swaps
- [ ] Channel dispute resolution
- [ ] Multi-hop routing

### Phase 3: Jurisdiction Integration

- [ ] On-chain anchoring
- [ ] Deposit/withdrawal flows
- [ ] Dispute escalation
- [ ] Cross-chain bridges

### Phase 4: Advanced Features

- [ ] Sharding for horizontal scaling
- [ ] Zero-knowledge proofs for privacy
- [ ] Formal verification
- [ ] MEV resistance

---

## 8. Appendix: Key Design Decisions

### Why Pure Functional Over Actor Model?

- Easier testing and debugging
- Deterministic replay from any state
- Better TypeScript type inference
- Simpler mental model

### Why Ethers.js Over BLS?

- EVM can verify ECDSA natively
- No need for precompiles
- Existing wallet infrastructure
- Lower gas costs on-chain

### Why Environment Pattern?

- Clean separation of pure/impure code
- Easy dependency injection
- Simplified testing
- Natural fit for time-machine

### Why 100ms Ticks?

- Human-perceivable responsiveness
- Reasonable network latency budget
- Matches typical block times
- Allows batching for efficiency

---

## 9. Glossary

| Term             | Definition                                           |
| ---------------- | ---------------------------------------------------- |
| **Entity**       | Independent BFT state machine (chat, DAO, hub, etc.) |
| **Replica**      | A signer's view of an entity's state                 |
| **Frame**        | Ordered batch of transactions with post-state        |
| **Proposer**     | Designated replica that creates frames               |
| **Validator**    | Replica that signs frames                            |
| **Threshold**    | Required voting power for consensus                  |
| **Mempool**      | Pending transactions awaiting inclusion              |
| **Precommit**    | Validator's signature on proposed frame              |
| **Hanko**        | Aggregated signatures proving consensus              |
| **Time Machine** | Snapshot history for debugging/replay                |

---

### Document History

- **v0.x (xlnspec.md)**: Original actor-based conceptual design
- **v1.x (spec_old.md)**: Full technical specification with BLS
- **v1.5 (spec_new.md)**: Code-as-law matching implementation
- **v2.0 (this document)**: Final unified specification with ethers.js

_"The best specification is running code, but code with a roadmap is even better."_
