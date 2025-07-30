# XLN MVP - Maria's Taco Truck

## What This Is

The minimal viable implementation of XLN's credit-line payment channels.

## The Innovation

```typescript
// Lightning Network (broken)
merchant.deposit($1000) → can receive $1000

// XLN Credit Lines (works)  
merchant.deposit($0) → can receive $1000
```

## Project Structure

```
xln-mvp/
├── src/
│   ├── channel.ts    # Core credit-line logic (100 lines)
│   └── crypto.ts     # Basic signatures (50 lines)
├── hub/              # Single hub server (coming)
├── merchant/         # Merchant web app (coming)
└── README.md
```

## Quick Start

```bash
# See the innovation
bun run src/channel.ts

# Run the hub (coming)
bun run hub/server.ts

# Open merchant app (coming)
open merchant/index.html
```

## The Plan

1. ✅ Core channel logic with asymmetric credit
2. ⏳ PostgreSQL hub that manages channels
3. ⏳ HTML merchant app with QR codes
4. ⏳ Deploy to 10 taco trucks
5. ⏳ Watch Western Union panic

## What We're NOT Building

- Byzantine consensus
- Multi-chain support
- Entity abstraction layers
- Perfect architecture
- 15 different demos

## Success Metrics

- Merchant onboarding: <3 minutes
- Payment confirmation: <2 seconds
- Weekly volume: $10k
- Merchant quote: "This is better than Square"