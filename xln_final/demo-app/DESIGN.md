# XLN Demo App Design

## The Core Story We're Telling

**"Accept payments with zero capital lockup"**

Traditional payment channels (Lightning): Need $1000 locked to receive $1000  
XLN: Need $0 locked to receive $1000

## Three Perspectives That Matter

### 1. Merchant (Maria's Coffee Shop)
- Opens shop with $0 in crypto
- Immediately can accept up to $1000 USDT in payments
- Sees real-time balance and available credit
- Can withdraw accumulated payments anytime

### 2. Customer (Tourist with crypto)
- Scans QR code
- Pays instantly
- Gets receipt
- Payment always succeeds (99.9% success rate)

### 3. Hub Operator (Local liquidity provider)
- Provides credit lines to 50 merchants
- Only needs $10,000 locked to enable $50,000 in payment capacity
- Earns fees on payment flow
- Sees real-time capital efficiency metrics

## Key Demos to Build

### Demo 1: Bootstrap Problem Comparison
Side-by-side comparison:
- Lightning: "Sorry, can't accept payment - no inbound liquidity"
- XLN: "Payment accepted! Thanks!"

### Demo 2: Capital Efficiency Dashboard
- Hub reserves: $10,000
- Payment capacity enabled: $50,000
- Active merchants: 50
- Capital efficiency: 5x

### Demo 3: Multi-Asset Merchant
- Coffee shop accepts USDT, BTC, local stablecoin
- Different credit limits per asset
- Single channel, multiple currencies

### Demo 4: Cross-Border Payment
- Customer in USA pays with Ethereum USDT
- Merchant in Argentina receives Polygon USDT
- Atomic swap happens transparently

## What We're NOT Building

- Complex technical dashboards
- Consensus visualizations
- Byzantine fault scenarios
- Academic proofs

This is about making the merchant experience undeniably better.

## Technical Architecture

### Backend (Bun + TypeScript)
```
/api
  /merchant
    POST   /register          # Get credit line with zero deposit
    GET    /balance          # Current balance and credit
    POST   /withdraw         # Move earnings on-chain
  /customer  
    POST   /pay              # Make payment
    GET    /receipt/:id      # Payment confirmation
  /hub
    GET    /stats            # Capital efficiency metrics
    POST   /provide-credit   # Add credit line to merchant
```

### Frontend (Simple, fast, clear)
- React or vanilla JS - whatever's fastest to build
- Mobile-first (merchants use phones)
- QR codes for payment
- Real-time balance updates
- Clear success/error states

### Data Flow
1. Merchant registers → Hub assigns credit line → Can immediately receive
2. Customer scans QR → Payment routes through channels → Merchant credited
3. Hub monitors capital efficiency → Adjusts credit lines → Optimizes network

## Success Metrics to Show

1. **Time to First Payment**
   - Lightning: Days/weeks (need to acquire inbound liquidity)
   - XLN: Instant (credit line assigned on registration)

2. **Payment Success Rate**
   - Lightning: ~70% (routing failures)
   - XLN: 99.9% (credit-based routing)

3. **Capital Required**
   - Lightning: 1:1 (need $1000 to receive $1000)
   - XLN: 0:1 (need $0 to receive $1000)

4. **Hub Efficiency**
   - Lightning: $50k locked enables $50k payments
   - XLN: $10k locked enables $50k payments

## The "Aha!" Moment

When a merchant realizes they can accept their first payment with ZERO capital locked up. That's when they understand why XLN matters.

Everything else - the consensus, the HTLCs, the multi-chain support - exists to make that moment possible, reliable, and scalable.