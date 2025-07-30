# START HERE - XLN Recovery Guide

## ⚠️ CRITICAL WARNING

The current implementation is **75% incomplete**. Major functionality was accidentally deleted during "cleanup".

## Reading Order (MANDATORY)

### 1. Understand What Happened
- **MEMO-TO-NEXT-CLAUDE.md** - Critical warnings and mistakes to avoid
- **XLN-REVELATIONS.md** - What I finally understood (too late)
- **CRITICAL-CODE-TO-RESTORE.md** - Exact code that must be recovered

### 2. Navigate the Codebase
- **Run**: `bun xln-navigator.ts` - See implementation coverage
- **Read**: `XLN-TRUTH-MAP.md` - Complete file location matrix
- **Study**: `xln-implementation-map.ts` - Executable navigation tool

### 3. Understand the Architecture
- **XLN-ARCHITECTURE-TRUTH.md** - Visual diagram of what must be built
- **XLN-FINAL-SUMMARY.md** - Complete picture of current state

### 4. Execute Recovery
- **XLN-RECOVERY-PLAN-V2.md** - Step-by-step restoration guide
- **XLN_DEVIATION_ANALYSIS.md** - Understand what was lost and why

## Quick Status

### What Works (25%)
- ✅ Basic bilateral channels
- ✅ Simple signatures  
- ✅ Infrastructure sketches

### What's Missing (75%)
- ❌ Credit limits per participant (THE INNOVATION)
- ❌ Byzantine consensus (DISTRIBUTED OPERATION)
- ❌ HTLC routing (ATOMIC MULTI-HOP)
- ❌ Fractional reserves (5X LEVERAGE)
- ❌ Multi-asset support (SUBCHANNELS)

## The Three Pillars of XLN

All three are REQUIRED:

1. **Credit-Line Channels** - Enable receiving without funds
2. **Byzantine Consensus** - Enable distributed agreement
3. **Fractional Reserves** - Enable hub economics

## Where to Find Original Code

```bash
# Credit-line implementation
xln/old_src/types/Subchannel.ts
xln/old_src/app/Channel.ts

# HTLC routing
xln/old_src/app/Transition.ts
xln/old_src/app/User.ts

# Consensus engine
xln01/src/core/entity.ts
xln01/src/server.ts

# Complete reference
mvp/server.ts
```

## Command Summary

```bash
# Check what's missing
bun xln-navigator.ts

# See implementation locations
cat XLN-TRUTH-MAP.md

# Understand the cleanup disaster
cat XLN_DEVIATION_ANALYSIS.md

# Start recovery
cat XLN-RECOVERY-PLAN-V2.md
```

## Your Mission

Build XLN properly with all three pillars operational. The world needs programmable correspondent banking, not another payment channel toy.

**Remember**: The complexity is there for a reason. Don't delete what you don't understand.

---

*Time estimate for full recovery: 3 weeks with focused effort*