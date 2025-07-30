# XLN - What You Need to Know

## The 30-Second Version

XLN enables receiving payments without having funds, using asymmetric credit relationships. Think digital hawala with cryptographic guarantees.

**Current State**: Core payment innovations work. Needs consensus for distributed operation.

## Quick Demo

```bash
# See everything working together
bun src/demo-unified.ts

# Check what's implemented
bun xln-navigator.ts
```

## What Works Now

1. **Credit-Line Channels** - Alice can pay Bob even with $0 balance
2. **HTLC Routing** - Atomic multi-hop payments 
3. **Fractional Reserves** - Hubs need only 20% collateral (5x efficiency)

## What's Missing

1. **Consensus** - Can't run multiple nodes (single point of failure)
2. **Multi-Asset** - Only one token per channel
3. **Privacy** - Payment routes visible to all

## The Code That Matters

```typescript
// The innovation: asymmetric credit
channel(alice, bob, 
  5000n,  // Alice can owe Bob up to 5000
  100n    // Bob can owe Alice only 100
)

// This is why it's not Lightning
```

## Architecture

```
src/
├── core/
│   ├── channels.ts   # Credit-line channels
│   ├── htlc.ts       # Atomic routing
│   └── routing.ts    # Multi-hop payments
├── economics/
│   └── fractional-reserve.ts  # 5x leverage math
└── demo-*.ts         # Working examples
```

## Next Priority

Port consensus from `mvp/server.ts` (the xln01 version is broken).

## Why This Matters

Lightning requires pre-funding. XLN doesn't. That changes everything for:
- Unbanked users (no capital to lock)
- Cross-border payments (leverage local trust)
- Merchant adoption (receive without liquidity)

---

*For the full story, read `XLN-RESTORATION-SUMMARY.md`*