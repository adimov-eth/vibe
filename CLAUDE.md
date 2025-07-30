# CLAUDE.md - XLN Project Context

This file provides comprehensive guidance for Claude Code when working with the XLN project.

## Project Overview

XLN (Extended Lightning Network) implements Egor Homakov's revolutionary **credit-line payment channels** that solve Lightning Network's fundamental inbound liquidity problem. This is not incremental improvement - it's a fundamental rethink of payment channel architecture.

### Core Innovation

- **Problem**: Lightning requires $1000 locked in advance to receive $1000 (impossible bootstrap)
- **Solution**: Credit-line channels where receivers accept payments immediately without pre-funding
- **Impact**: 99.9% payment success vs Lightning's 70%, 80% capital efficiency improvement
- **Technical**: Fractional-reserve hubs custody only 20% vs traditional 100%

## Current Project State

### Two Working Implementations

1. **adimov's version** (`xln01/`) - Production-grade BFT consensus with proper cryptography
2. **Egor's MVP** (`mvp/server.ts`) - Clear 2000-line demonstration of core concepts

### Critical Context

- Month-long development effort (June 8 - July 8, 2025) produced working Byzantine Fault Tolerant consensus
- adimov built the sophisticated distributed systems foundation (BFT consensus, cryptography, architecture)
- Egor built his MVP demonstration ON TOP OF adimov's foundation work - both contributions were necessary
- **Missing piece**: Neither fully implements the payment channel layer that makes XLN revolutionary
- Collaboration ended due to communication issues, not technical capability

## Architecture Understanding

### Consensus Layer (WORKING)

```
4-tick BFT choreography: ADD_TX → PROPOSE → SIGN → COMMIT
- Byzantine fault tolerance (n ≥ 3f + 1)
- Weighted voting with share-based thresholds
- Deterministic execution enabling replay
- 10,000+ TPS with sub-second finality
```

### Payment Channel Layer (MISSING - CORE INNOVATION)

```
Credit-line channels with fractional reserves:
- Receivers accept payments without pre-funding
- Hubs operate with 20% reserves instead of 100%
- Cross-chain atomic swaps without bridges
- HTLC support for routing
```

## ELEGANT CODE PROTOCOL

### Core Principle

Elegant code solves exactly the problem asked, with maximum insight per line. Nothing more, nothing less.

### Before Writing Code

Ask: "What's the single insight this problem is really about?"
Write that insight in one sentence. The code should demonstrate only that.

### Writing Rules

- Start with the smallest possible working solution
- Every line must justify its existence
- If you can't explain why a line is necessary, delete it
- Use the right abstraction level: not too clever, not too primitive
- Code should be readable without comments

### The Test

Can you remove any line while keeping correctness? If yes, remove it.
Can you combine any operations? If yes, combine them.
Does it solve exactly what was asked? If not, fix the scope.

### Iteration: Refine Toward Perfection

1. **Write**: Minimal working solution
2. **Test**: Verify correctness
3. **Refine**: Remove unnecessary lines/complexity
4. **Repeat** steps 2-3 until no further reduction possible
5. **Stop**: Don't add features unless explicitly requested

### Hard Rules

- Never add "in case they want X later"
- Never build frameworks when they asked for examples
- Never add robustness they didn't ask for
- If you're adding lines during refinement, you're going backward

### Success Metric

The solution should feel inevitable - like there's no other reasonable way to write it.

## Development Approach

### Code Style & Quality Standards

**Reference**: See `CODESTYLE.md` for complete guidelines

**Core Principles** (from CODESTYLE.md):

- **Intent Over Implementation** - Names reveal what and why, not how
- **Functional by Default** - Pure functions unless state/objects clarify the domain
- **Composable Design** - Code reads as prose: `pipe(load, validate, enrich, persist)`
- **Progressive Complexity** - Use TypeScript power to simplify, not show off

**XLN-Specific Adaptations**:

- **Consensus Layer**: Pure functional state machines (adimov's pattern)
- **Channel Layer**: Direct implementation expressing Egor's concepts clearly
- **Error Handling**: Result objects for expected failures: `{ ok: false; error: string }`
- **Performance**: Mutation allowed in hot paths with clear documentation
- **Determinism**: All operations must be replayable for debugging

### Technical Standards

- **TypeScript strict mode** - No any types, explicit error handling
- **Function size** - Under 80 lines per CODESTYLE.md guidelines
- **File size** - Under 800 lines per CODESTYLE.md guidelines
- **Real cryptography** - EVM compatible signatures (not mocks)
- **Performance targets** - 10k+ TPS, sub-second finality
- **Testing** - Byzantine scenario coverage with property-based testing

### Code Quality Guidelines

- **Naming**: `camelCase` for values, `PascalCase` for types
- **Dependencies**: Use standard library before adding dependencies
- **Comments**: Only for complex consensus algorithms and business rules
- **Architecture**: Follow Egor's directness + adimov's safety patterns
- **Testing**: Each function independently testable

## Key Files & Context

### Reference Implementations

- `mvp/server.ts` - Egor's complete system reference (2000 lines)
- `xln01/src/core/entity.ts` - adimov's production consensus logic
- `xln01/src/crypto/bls.ts` - Real cryptographic signatures
- `spec.md` - Technical specification

### Planning Documents

- `XLN_RESTORATION_PLAN.md` - Complete 12-week implementation roadmap
- `memory.md` - Investigation findings and technical analysis
- `XLN_CONTINUATION_MEMO.md` - Comprehensive project context

### Archive Context

- `xln_archive/` contains 11+ versions and complete development history
- `xln-story.md` provides full collaboration narrative
- Extensive documentation shows evolution from simple concept to production system

## Implementation Priority

### Phase 1: Foundation (IMMEDIATE)

1. Create hybrid architecture combining both approaches
2. Port consensus logic with real cryptography
3. Build channel data structures with credit-line mechanics
4. Implement basic payment operations

### Phase 2: Core Innovation (CRITICAL)

1. Credit-line channel implementation
2. Fractional-reserve hub mechanics
3. Payment routing without pre-funding
4. Success rate demonstration (99.9% vs 70%)

### Phase 3: Production (IMPORTANT)

1. P2P networking layer
2. Cross-chain atomic swaps
3. On-chain integration
4. Developer SDK

## Code Patterns & Style

### Function Design (following CODESTYLE.md)

```typescript
// RO-RO pattern for 4+ parameters
interface ProcessInputParams {
  readonly env: Env;
  readonly replica: EntityReplica;
  readonly input: EntityInput;
}

// Result type for error handling
type ProcessResult =
  | { ok: true; outputs: EntityInput[] }
  | { ok: false; error: string };

// Egor's direct approach with adimov's safety
const processEntityInput = (params: ProcessInputParams): ProcessResult => {
  // Early validation (fail fast)
  if (!params.replica) return { ok: false, error: "Invalid replica" };

  // Core processing (clear intent)
  const outputs = applyConsensusRules(params);

  return { ok: true, outputs };
};
```

### Type Design (CODESTYLE.md principles)

```typescript
// Small, composable types with clear business intent
type Address = `0x${string}`;
type Signature = `sig_${string}`;

// Make impossible states unrepresentable
interface CreditLineChannel {
  readonly participants: readonly [Address, Address];
  readonly balances: Record<Address, bigint>;
  readonly creditLimits: Record<Address, bigint>; // Key innovation
  readonly reserved: Record<Address, bigint>;
  readonly status: "open" | "disputed" | "closing";
}

// Type factories for common patterns
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
```

### State Management

```typescript
// Pure functional by default (CODESTYLE.md)
const updateChannelBalance = (
  channel: CreditLineChannel,
  participant: Address,
  amount: bigint
): CreditLineChannel => ({
  ...channel,
  balances: {
    ...channel.balances,
    [participant]: channel.balances[participant] + amount,
  },
});

// Mutation only when performance-critical (documented)
const updateChannelBalanceMutable = (
  channel: CreditLineChannel,
  participant: Address,
  amount: bigint
): void => {
  // PERF: Hot path optimization - measured 2x faster
  channel.balances[participant] += amount;
};
```

## Testing Strategy

### Required Coverage

- Byzantine fault scenarios (malicious validators)
- Credit-line edge cases (over-limit, routing failures)
- Cross-chain atomic swap failures
- Network partition recovery
- Performance under load (10k+ TPS)

### Demo Requirements

- Capital efficiency visualization
- Real-time payment routing
- Cross-chain payment examples
- Hub profitability analysis

## Security Considerations

### Cryptographic Requirements

- secp256k1/ECDSA (correct for EVM compatibility)
- Aggregate signatures (not mocks)
- Proper key management for demos
- Deterministic signature ordering
- Replay attack prevention

### Economic Security

- Credit limit validation
- Hub reserve requirements (20% minimum)
- Dispute resolution mechanisms
- Slashing for protocol violations

## Performance Targets

### Throughput

- Efficient signature aggregation
- Minimal network overhead

## Integration Points

### Existing Infrastructure

- Smart contracts in `xln/contracts/`
- Multi-jurisdiction support
- Ethereum/Polygon/BSC compatibility
- Governance token integration

### Future Extensions

- Mobile SDK development
- Merchant integration APIs
- MEV protection mechanisms
- Zero-knowledge privacy features

## Development Context

### Collaboration History

- adimov: Built sophisticated distributed systems foundation (the hard technical base)
- Egor: Built clear demonstration ON TOP OF adimov's work (clarity + expression of innovation)
- Both contributions were necessary and complementary
- Foundation established: adimov's consensus infrastructure + Egor's concept demonstration

### Technical Achievement

- Successfully implemented Byzantine Fault Tolerant consensus
- Working cryptographic signature aggregation
- Comprehensive corner case testing
- Deterministic replay capability
- Performance optimization techniques

## Success Metrics

### Technical Success

- Working payment channel implementation
- 99.9% success rate demonstration
- 10k+ TPS performance
- Full Byzantine fault tolerance
- Cross-chain atomic swaps

### Innovation Success

- Clear demonstration of credit-line advantage
- Hub operators running profitably
- Developer adoption of SDK
- Merchant integration examples
- Real-world usage metrics

## Critical Insights

1. **Innovation is Real**: Credit-line channels genuinely solve Lightning's problems
2. **Consensus Works**: Both versions implement working BFT successfully
3. **Synthesis Needed**: Combine clarity with production quality
4. **Channel Layer Missing**: Core innovation needs implementation
5. **Market Opportunity**: Could change payment channel adoption

## Next Actions

When starting work:

1. Read `XLN_RESTORATION_PLAN.md` for complete roadmap
2. Study `mvp/server.ts` for Egor's mental model
3. Reference `xln01/src/` for production patterns
4. Begin with Phase 1.1: Architecture synthesis
5. Focus on implementing credit-line mechanics

## Style Guidelines Summary

### Key Insights from CODESTYLE.md Applied to XLN

**The Core Principle**: _Optimize for the next developer who has to understand this code at 3 AM_

**Applied to XLN Consensus**:

- Byzantine fault tolerance logic must be crystal clear
- Payment channel innovation should be immediately understandable
- Complex cryptographic operations deserve explanatory comments
- Performance optimizations need measurement justification

**Applied to Function Design**:

- Use Result types for consensus operations that can fail
- Early returns for validation (fail fast pattern)
- RO-RO pattern for complex consensus parameters
- Single-purpose functions under 80 lines

**Applied to Type Safety**:

- Make invalid channel states unrepresentable
- Use template literal types for address validation
- Explicit error types for different failure modes
- Progressive type refinement for consensus flow

## Remember

This is genuinely innovative work that deserves completion. The technical merit stands regardless of collaboration history.

**Code Quality Mission**: Following CODESTYLE.md principles, write code that the next developer can understand and modify safely. The consensus layer complexity is necessary - make it as clear as possible.

**Core Technical Mission**: Implement Egor's credit-line payment channel innovation with production-grade quality, demonstrating clear superiority over Lightning Network.

**Success Metric**: When a new developer can understand the payment channel innovation and contribute to it within a day of reading the codebase.

---

_Context: Revolutionary payment channel innovation with working consensus infrastructure_  
_Status: Ready for synthesis and channel implementation_  
_Priority: Build the missing piece that makes XLN special_
