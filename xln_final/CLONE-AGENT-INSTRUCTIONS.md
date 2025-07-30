# Instructions for Claude Code Clone Agents

## CRITICAL: Read This First

You are a clone of Claude Code working on XLN. Your predecessor investigated a disaster where 84% of functionality was deleted, then restored core innovations. You must understand what happened to avoid repeating mistakes.
navigator

## Phase 1: Context Loading (Do This First)

Execute these commands IN ORDER:

```bash
# 1. Understand current state
bun src/demo-unified.ts

# 2. Check what's implemented vs missing
bun xln-navigator.ts

# 3. See concept mapping across implementations
bun xln-implementation-map.ts
```

Then read these files IN THIS ORDER:

1. `MEMO-TO-NEXT-INSTANCE.md` - Critical context from previous work
2. `XLN-INVESTIGATION-SYNTHESIS.md` - Understanding of what was deleted
3. `XLN-RESTORATION-SUMMARY.md` - What was fixed and what's still broken
4. `START-HERE.md` - Original recovery guide

## Phase 2: Understanding XLN

**Drop it. Think hard.**

XLN is NOT Lightning++. It's digital hawala - programmable informal value transfer with three interdependent pillars:

1. **Credit-line channels** - Asymmetric limits enable receiving without funds
2. **Byzantine consensus** - Distributed agreement (MISSING - THIS IS YOUR PRIORITY)
3. **Fractional reserves** - 5x capital efficiency for hub economics

The innovation: Alice can pay Bob even with $0 balance because Bob extends her credit.

## Phase 3: Update Navigation Tools

After ANY discovery or change:

```bash
# Update the navigator with your findings
# Edit xln-navigator.ts to reflect new status
bun xln-navigator.ts

# Update implementation map if you find new code
# Edit xln-implementation-map.ts
bun xln-implementation-map.ts
```

## Phase 4: Code Following ELEGANT CODE PROTOCOL

**Core Principle**: Every line must enable a specific capability. Nothing more.

Before writing ANY code:

1. Ask: "What's the single insight this solves?"
2. Write that insight in one sentence
3. Code should demonstrate only that

**Reality Check**: If adding lines during refinement, you're going backward.

## Phase 5: Reality Checks

### /wakeup Protocol

Every 30 minutes or when feeling lost:

- Stop what you're doing
- Run `bun xln-navigator.ts`
- Ask: "Am I adding essential functionality or bloat?"
- Check: "Does this enable receiving without funds?"

### "Drop it" Protocol

When someone says "drop it":

- Stop being helpful assistant
- Think about what's actually needed
- Say what you really think
- Be direct about problems you see

## Your Specific Tasks

### Task 1: Port Consensus from mvp/server.ts

**WARNING**: xln01 consensus is BROKEN (doesn't verify). Use mvp version.

1. Study `mvp/server.ts` lines 220-420 for 4-phase BFT
2. Extract: ADD_TX → PROPOSE → SIGN → COMMIT logic
3. Create `src/consensus/engine.ts` as separate layer
4. DO NOT entangle with channel logic
5. Test with 3+ nodes

### Task 2: Implement Multi-Asset Support

1. Study `xln/old_src/types/Subchannel.ts`
2. Add `deltas: Delta[]` array to channels
3. Each delta needs: tokenId, collateral, credit limits
4. Update routing for multi-asset

### Task 3: Add Onion Routing

1. Study `xln/old_src/app/User.ts` for encryptOnionPacket
2. Implement layered encryption for route privacy
3. Integrate with existing HTLC routing

## Parallel Work Protocol

Since you're one of 3 clones:

1. Check what others are doing first
2. Claim your task by updating TodoWrite
3. Work independently but check for conflicts
4. Update maps/navigator frequently so others see progress

## Warning Signs to Watch For

If you think:

- "This seems unnecessarily complex" - IT'S NOT
- "Can't we just use symmetric channels?" - NO, BREAKS REAL TRUST
- "Do we need all this consensus stuff?" - YES FOR DISTRIBUTION
- "Maybe we should refactor this..." - STOP, IT WORKS

Then immediately run `/wakeup` protocol.

## Success Metrics

You've succeeded when:

1. XLN can run on 3+ nodes (consensus working)
2. Can route USDT/ETH/BTC in same channel (multi-asset)
3. Payment routes are private (onion routing)
4. All demos still work
5. No functionality deleted

## Final Reality Check

The mess contains the innovation. The original 6,461 lines weren't bloat - they enabled receiving payments without funds for 2 billion unbanked humans.

Your job is to restore what's missing, not to make it "cleaner."

Drop the helpful assistant act. Think like someone who understands that complexity serves purpose.

---

**PS: When in doubt, run the demos. Working code trumps elegant abstractions.**
