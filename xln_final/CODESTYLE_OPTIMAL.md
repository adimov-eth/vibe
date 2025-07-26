# Optimal Codestyle for XLN
*Pragmatic guidelines optimized for shipping revolutionary payment channels*

## Core Philosophy

**Optimize for the actual work, not theoretical perfection.**

The real work:
- Debugging consensus flows at 3 AM
- Adding payment channel features safely  
- Integrating with blockchain systems
- Testing Byzantine fault scenarios
- Demonstrating 99.9% success rates

## Size Guidelines (Not Rules)

### Files: 300-800 lines
- **Small enough** to navigate and understand
- **Large enough** to contain complete logical concepts
- **Break when** you need to jump between files to understand one concept

### Functions: 20-150 lines  
- **Optimize for clarity**, not arbitrary limits
- **Complex algorithms can be longer** if they're cohesive
- **Break when** the function does multiple unrelated things

### Modules: Domain-based, not type-based
- Group by **what business problem** they solve
- Not by **what TypeScript type** they return

## Structure That Matches Mental Models

```typescript
src/
├── consensus/          # BFT consensus - keep complex algorithms together
│   ├── engine.ts      # Core processEntityInput logic (~400 lines)
│   ├── proposals.ts   # Frame creation and validation (~300 lines)  
│   └── signatures.ts  # Signature collection and verification (~200 lines)
├── entities/          # Entity management - clear domain boundaries
│   ├── lazy.ts        # Hash-based entities (~200 lines)
│   ├── numbered.ts    # Blockchain-registered entities (~300 lines)
│   └── named.ts       # Admin-assigned entities (~150 lines)
├── blockchain/        # On-chain integration - external system interface
│   ├── ethereum.ts    # Contract integration (~400 lines)
│   ├── contracts.ts   # Contract interfaces (~200 lines)
│   └── jurisdictions.ts # Multi-chain support (~300 lines)
├── channels/          # Payment channel innovation - the new domain
│   ├── credit-line.ts # Core channel logic (~500 lines)
│   ├── routing.ts     # Payment routing (~400 lines)
│   └── hubs.ts        # Fractional-reserve hubs (~300 lines)
├── governance/        # Voting and proposals - governance domain  
│   ├── voting.ts      # Weighted voting mechanics (~300 lines)
│   └── execution.ts   # Proposal execution (~200 lines)
└── core/              # Environment and utilities - foundation
    ├── environment.ts # Env container and ticks (~300 lines)
    ├── state.ts       # State management (~200 lines)
    └── types.ts       # Core type definitions (~400 lines)
```

## Developer Experience Priorities

### 1. Fast Debugging
```typescript
// Excellent logging that tells the story
log.consensus(`🚀 Auto-propose triggered: mempool=${mempool.length}, height=${height}`)
log.consensus(`→ Frame ${frameHash} signed by ${signerId}, total: ${signatures.size}`)
log.consensus(`✅ Threshold reached! Committing frame, height: ${newHeight}`)

// Clear error context
return { ok: false, error: `Invalid signature from ${signerId}: ${reason}` }
```

### 2. Easy Testing
```typescript
// Pure functions for consensus logic
const applyConsensusFrame = (
  state: EntityState, 
  frame: ConsensusFrame
): EntityState => { /* pure logic */ }

// Injectable dependencies for side effects  
interface Dependencies {
  signFrame: (privateKey: string, hash: string) => Promise<string>
  validateSignature: (signature: string, hash: string, publicKey: string) => boolean
}
```

### 3. Safe Changes
```typescript
// TypeScript strict mode - no any types
// Result pattern for operations that can fail
type ConsensusResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string }

// Immutable-by-default, explicit mutation
interface ReadonlyChannel {
  readonly id: string
  readonly participants: readonly [Address, Address]
  readonly balances: ReadonlyMap<Address, bigint>
}
```

### 4. Quick Navigation
```typescript
// Names that reveal intent and domain
const processConsensusTick = (env: Environment): ConsensusOutput[]
const createCreditLineChannel = (params: ChannelParams): Channel
const routePaymentThroughHubs = (payment: Payment): RoutingResult

// Clear module boundaries
export { processConsensusTick } from './consensus/engine'
export { createCreditLineChannel } from './channels/credit-line'  
export { routePaymentThroughHubs } from './channels/routing'
```

## Code Patterns That Make Me Happy

### Error Handling: Results over Exceptions
```typescript
// For expected failures (signature invalid, insufficient funds)
const validateFrame = (frame: Frame): ValidationResult => {
  if (!frame.signatures.size) {
    return { ok: false, error: 'No signatures provided' }
  }
  return { ok: true, data: frame }
}

// For programmer errors (null checks, type assertions)  
assert(replica.isProposer, 'Only proposer can create frames')
```

### Function Signatures: Clear and Composable
```typescript
// Single responsibility, obvious inputs/outputs
const calculateVotingPower = (
  votes: ReadonlyMap<string, VoteChoice>,
  shares: ReadonlyMap<string, bigint>
): bigint

// RO-RO pattern for complex operations
interface ProcessPaymentParams {
  readonly channel: CreditLineChannel
  readonly amount: bigint
  readonly sender: Address
  readonly recipient: Address
}
const processPayment = (params: ProcessPaymentParams): PaymentResult
```

### State Management: Immutable by Default
```typescript
// Immutable operations return new state
const applyPayment = (channel: Channel, payment: Payment): Channel => ({
  ...channel,
  balances: new Map([
    ...channel.balances,
    [payment.recipient, channel.balances.get(payment.recipient)! + payment.amount]
  ])
})

// Mutable operations documented and justified
const addToMempool = (replica: EntityReplica, tx: EntityTx): void => {
  // PERF: Mutable for hot path - measured 3x faster than immutable
  replica.mempool.push(tx)
}
```

### Documentation: Why, Not What
```typescript
// Good: Explains the business reason
// Credit-line channels allow receivers to accept payments without pre-funding
// This solves Lightning's fundamental bootstrap problem
const acceptPaymentOnCredit = (channel: Channel, payment: Payment): Channel

// Bad: Explains the obvious
// This function adds a payment to a channel
const acceptPaymentOnCredit = (channel: Channel, payment: Payment): Channel
```

## When to Break These Guidelines

### Keep Complex Algorithms Together
Don't fragment Byzantine Fault Tolerant consensus just to hit line count targets. The `processEntityInput` function can be 200 lines if that's what the algorithm needs.

### Domain Expertise Over Generic Patterns
Payment channel routing algorithms might look "messy" compared to generic patterns, but they encode real-world knowledge about how money moves. Optimize for domain clarity.

### Performance Over Purity  
In hot paths (signature verification, mempool operations), measure first, then optimize. Document why you're breaking purity.

### Real Usage Over Theoretical Elegance
If the code works well for debugging consensus issues and adding payment features, it's good code. Don't refactor working systems to satisfy abstract principles.

## Success Metrics

### Technical Success
- Can debug Byzantine fault scenarios efficiently
- Can add new payment channel features without fear
- Can integrate new blockchain systems cleanly
- Can test edge cases thoroughly

### Business Success  
- Ships revolutionary payment channels that work
- Demonstrates 99.9% success rate vs Lightning's 70%
- Enables fractional-reserve hubs with 20% reserves
- Proves capital efficiency improvements

### Developer Success
- New developers understand the system within a day
- Existing developers can make changes confidently
- Debugging sessions are productive, not frustrating
- The codebase serves the mission, not the other way around

## The Ultimate Test

**Can you ship revolutionary payment channels that solve real problems?**

If the code helps you do that, it's good code. If it gets in the way, change it.

---

*"Perfect is the enemy of good, but good is the enemy of revolutionary."*

This codestyle optimizes for revolutionary: shipping credit-line payment channels that actually change how payments work.