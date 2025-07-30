# Cleanup List - What to Delete

## Meta Documentation (All the navel-gazing)
- CLONE-AGENT-INSTRUCTIONS.md
- COMPLETION-STATUS.md
- FINAL-STATUS.md
- MEMO-TO-MYSELF.md
- MEMO-TO-NEXT-CLAUDE.md
- MEMO-TO-NEXT-INSTANCE.md
- MEMO-TO-NEXT-SELF.md
- NEXT-INSTANCE-OPTIMAL-PATH.md
- SAFE-COMPLETION-TASKS.md
- START-HERE.md
- XLN-100-PERCENT-COMPLETE.md
- XLN-COMPLETE-RESTORATION.md
- XLN-DEMO-APP-COMPLETE.md
- XLN-FINAL-SUMMARY.md
- XLN-INVESTIGATION-SYNTHESIS.md
- XLN-RESTORATION-SUMMARY.md
- XLN-REVELATIONS.md
- XLN-STATUS-JULY-30.md
- XLN_VERIFICATION_REPORT.md

## Overcomplicated Demos
- src/demo-collateral.ts
- src/demo-consensus.ts
- src/demo-dispute.ts
- src/demo-economics.ts
- src/demo-entities.ts
- src/demo-multi-asset.ts
- src/demo-multi-chain.ts
- src/demo-onion-simple.ts
- src/demo-persistence.ts
- src/demo-routing.ts
- src/demo-unified.ts

## Over-engineered Features (for MVP)
- src/consensus/ (entire directory)
- src/entities/ (entire directory)
- src/persistence/ (entire directory)
- src/core/dispute.ts
- src/core/multi-asset-channels.ts
- src/core/multi-asset-routing.ts
- src/core/multi-chain.ts
- src/core/onion.ts
- src/core/collateral.ts

## What to Keep
- xln-mvp/ (our new clean implementation)
- src/core/crypto.ts (basic signatures)
- src/economics/fractional-reserve.ts (5x leverage math)
- simple-demo.ts (reference)
- SHIP-IT.md (the manifesto)
- validate-xln.ts (to verify we didn't break anything)

## The Test

After cleanup, the entire MVP should be <500 lines of code:
- channel.ts: 100 lines
- hub/server.ts: 200 lines
- merchant/app.html: 100 lines
- database.sql: 50 lines

That's it. That's XLN.