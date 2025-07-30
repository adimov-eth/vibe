# Safe XLN Completion Tasks

## Context
XLN is 66.7% complete with all 6 core features working. We need to increase completeness WITHOUT breaking what works.

## Critical Rules
1. **Run `bun validate-xln.ts` after ANY change**
2. **Each layer works independently** - Don't entangle them
3. **"The mess contains the innovation"** - Don't simplify
4. **Add new modules, don't modify core**

## Parallel Tasks for Clone Agents

### Task 1: Complete On-Chain/Off-Chain Split
**Goal**: Make ondelta/offdelta tracking actually work

**Files**:
- Started: `src/core/collateral.ts` (deposit/withdraw functions created)
- Modified: `src/core/multi-asset-channels.ts` (canPayAsset now considers collateral)

**TODO**:
1. Create `src/demo-collateral.ts` showing:
   - Deposit collateral → increases ondelta
   - Make payments → affects offdelta only
   - Withdraw collateral → checks safety
   - Settlement → moves offdelta to ondelta
2. Update validation script to include collateral demo
3. Run full validation

### Task 2: Add Entity Management System
**Goal**: Track participants without touching channels

**Approach**: Create `src/entities/manager.ts` as SEPARATE module

**Requirements**:
- Track entities (addresses, names, metadata)
- Track which channels each entity participates in
- Calculate reputation scores based on channel activity
- NO modifications to existing channel code
- Optional integration points only

**Demo**: `src/demo-entities.ts` showing entity tracking

### Task 3: Add State Persistence
**Goal**: Save/load channel state

**Approach**: Create `src/persistence/` module

**Requirements**:
- Save channel state to JSON files
- Load state on startup
- Write-ahead logging for crash recovery
- NO modifications to channel logic
- Pure functions: serialize/deserialize only

**Demo**: `src/demo-persistence.ts` showing save/load

## Success Criteria
- All existing demos still pass
- `bun validate-xln.ts` shows ALL GREEN
- Implementation coverage increases from 66.7%
- No core functionality modified

## Remember
From MEMO-TO-MYSELF.md:
- "Don't break it chasing completeness"
- "Each layer works independently"
- "The moment you think you fully understand XLN is the moment you'll break it again"

Focus on COMPLETING what's started, not reimagining what works.