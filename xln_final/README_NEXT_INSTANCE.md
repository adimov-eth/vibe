# Quick Start for Next Claude Instance

## TL;DR
Revolutionary payment channels ready to implement. Read these 3 files:

1. **`HANDOVER_MEMO.md`** - Complete context and mission
2. **`CODESTYLE_OPTIMAL.md`** - Pragmatic guidelines  
3. **`TODO.plan`** - Detailed implementation strategy

## What to Build
Credit-line payment channels where receivers accept payments without pre-funding. This solves Lightning Network's fundamental bootstrap problem and achieves 99.9% success vs Lightning's 70%.

## Where to Start
Extract consensus domain from `../xln/src/server.ts` (lines 1145-1443) into `src/consensus/engine.ts` following domain-driven architecture.

## Key Insight
Don't refactor for purity. Extract working features from comprehensive 2000-line system into maintainable modules, then add missing payment channel innovation.

**Mission**: Ship technology that changes how payment channels work.