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
- Both versions successfully implement sophisticated distributed consensus supporting the innovation
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

## Development Approach

### Code Style & Quality Standards
**Reference**: See `CODESTYLE.md` for complete guidelines

**Core Principles** (from CODESTYLE.md):
- **Optimize for the Next Developer** - Every decision should make code easier to understand 6 months from now
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
- **Real cryptography** - BLS12-381 signatures (not mocks)
- **Performance targets** - 10k+ TPS, sub-second finality
- **Testing** - Byzantine scenario coverage with property-based testing

### Decision Framework (from CODESTYLE.md)
When principles conflict, optimize in this order:
1. **Correctness** - Byzantine fault tolerance must work reliably
2. **Clarity** - Payment channel innovation must be understandable  
3. **Maintainability** - Code can be safely extended for new features
4. **Performance** - Meets 10k+ TPS targets
5. **Consistency** - Follows established patterns

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

## Common Patterns

### Consensus Processing
```typescript
// Egor's direct approach with adimov's safety
const processEntityInput = (
  env: Env, 
  replica: EntityReplica, 
  input: EntityInput
): EntityInput[] => {
  // Validate cryptographically (adimov's pattern)
  // Process directly (Egor's pattern)
  // Return deterministic outputs
}
```

### Channel Operations
```typescript
// Core innovation - credit-line payments
interface CreditLineChannel {
  participants: [Address, Address]
  balances: Record<Address, bigint>
  creditLimits: Record<Address, bigint>  // Key innovation
  reserved: Record<Address, bigint>
}
```

## Testing Strategy

### Required Coverage
- Byzantine fault scenarios (malicious validators)
- Credit-line edge cases (over-limit, routing failures)
- Cross-chain atomic swap failures
- Network partition recovery
- Performance under load (10k+ TPS)

### Demo Requirements
- Success rate comparison: XLN 99.9% vs Lightning 70%
- Capital efficiency visualization
- Real-time payment routing
- Cross-chain payment examples
- Hub profitability analysis

## Security Considerations

### Cryptographic Requirements
- BLS12-381 for aggregate signatures (not mocks)
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
- 10,000+ TPS sustained
- Sub-second payment finality
- Efficient signature aggregation
- Minimal network overhead

### Capital Efficiency
- 80% improvement over Lightning
- 20% hub reserves vs 100% traditional
- Zero receiver pre-funding required
- Optimal routing through credit networks

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
- adimov: Built sophisticated distributed systems (enterprise approach)
- Egor: Wanted simple, hand-written demonstration (clarity approach)
- Both approaches have technical merit for different purposes
- Synthesis needed: Egor's clarity + adimov's production quality

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

## Remember

This is genuinely innovative work that deserves completion. The technical merit stands regardless of collaboration history. Focus on building the missing payment channel layer that makes XLN revolutionary.

**Core Mission**: Implement Egor's credit-line payment channel innovation with production-grade quality, demonstrating clear superiority over Lightning Network.

---

*Context: Revolutionary payment channel innovation with working consensus infrastructure*  
*Status: Ready for synthesis and channel implementation*  
*Priority: Build the missing piece that makes XLN special*