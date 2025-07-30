# XLN Roadmap - From Taco Trucks to Global Payments

## The Vision

Replace Western Union's $30B remittance market with credit-based instant payments. Start with taco trucks, end with global financial inclusion.

## Phase 0: Right Now (Week 1)

### Deploy First Hub

```bash
# Get a $5/month VPS (Hetzner/Vultr)
ssh root@your-server
git clone https://github.com/yourusername/xln
cd xln/xln-mvp
bun install
bun run hub/server.ts
```

### Find 10 Real Merchants

Target:

- Food trucks near tech offices
- Coffee shops with Square/Toast pain
- Immigrant-owned shops with remittance needs
- Anyone paying 2.9% + 30¢ per transaction

Pitch: "Accept payments instantly. No equipment. No deposit. No fees for 6 months."

### Make It Work

1. Help them create QR code stickers
2. Put your personal phone number on the sticker
3. When something breaks, fix it immediately
4. When they complain, listen and iterate

Success metric: One merchant saying "This is better than Square"

## Phase 1: Product-Market Fit (Month 1-3)

### The 100 Merchant Sprint

**Week 1-2: Onboarding Flow**

- Replace manual setup with self-serve
- SMS verification (Twilio)
- Automatic QR code generation
- Print-ready sticker templates

**Week 3-4: Merchant Dashboard**

```typescript
// What merchants actually need
interface MerchantDashboard {
  todaysSales: number;
  weeklyTrend: "up" | "down" | "flat";
  instantPayout: () => Promise<void>; // Via local P2P trader
  simpleReceipts: Receipt[];
}
```

**Week 5-8: Kill the Friction**

- 2-tap refunds
- Daily auto-settlement to bank
- Spanish/Vietnamese/Mandarin UI
- WhatsApp receipts

**Week 9-12: Prove Economics**
Track:

- Payment volume per merchant
- Churn rate
- Credit utilization
- Default rate (will be ~0 initially)

### The Hub Economics

Your first hub needs $10k collateral:

- Supports 50 merchants @ $1k credit each (5x leverage)
- Expected revenue: 0.5% of volume = $500/month at $100k volume
- Break-even: ~20 active merchants

## Phase 2: Network Effects (Month 4-6)

### Add P2P Traders

Find people already doing informal remittance:

- Western Union agents
- Hawala operators
- Crypto P2P traders
- Check cashing stores

Pitch: "Your customers can pay any XLN merchant. You get 0.5% of volume."

### Enable Merchant-to-Merchant

```typescript
// The killer feature
const paySupplier = async (
  fromMerchant: Address,
  toSupplier: Address,
  amount: bigint
) => {
  // Merchant uses their received funds to pay suppliers
  // No bank involved, instant settlement
};
```

### Launch Second City

Pick based on:

1. Existing P2P trader relationships
2. High immigrant population
3. Expensive banking

Good targets: LA, Houston, Miami

## Phase 3: Cross-Border (Month 7-12)

### The Remittance Play

UK → Nigeria flow:

1. Nigerian merchants get credit lines
2. UK senders pay UK hub
3. UK hub owes Nigerian hub
4. Nigerian hub pays merchants
5. Hubs settle weekly via USDT

### Required Infrastructure

**Legal Structure**

- Not money transmission (credit extension)
- Partner with licensed P2P traders
- Terms of Service that work

**Hub Network**

```typescript
interface HubNetwork {
  hubs: Map<Country, Hub[]>;
  liquidityPools: Map<Pair, LiquidityPool>;
  settlementSchedule: "daily" | "weekly";
  collateralRequirements: bigint;
}
```

**Risk Management**

- Geographic exposure limits
- FX hedging via stablecoin pools
- Hub credit scoring
- Fraud detection (velocity, amounts)

## Phase 4: Scale (Year 2)

### Open Source Hub Software

Let anyone run a hub:

```bash
# One-click hub deployment
curl -sSL https://xln.network/install.sh | bash
```

Requirements:

- $10k collateral (on-chain)
- KYC/AML capability
- Local banking relationship

### Developer Ecosystem

**Merchant SDK**

```javascript
// Shopify/WooCommerce/Square plugins
const xln = require("@xln/merchant-sdk");

xln.acceptPayment({
  amount: 50.0,
  currency: "USD",
  description: "Two tacos",
});
```

**Mobile Apps**

- React Native merchant app
- Flutter customer wallet
- Hub operator dashboard

### Economics at Scale

1000 hubs × $100k each = $100M collateral
× 5x leverage = $500M payment capacity
× 12 turnovers/year = $6B annual volume
× 0.5% fees = $30M network revenue

## Phase 5: Beyond Payments (Year 3+)

### Merchant Working Capital

- Auto-approve loans based on payment history
- Daily repayment from sales
- No paperwork, instant funding

### Supply Chain Finance

- Suppliers extend credit to buyers
- Buyers pay from future sales
- No banks, no factoring companies

### The Full Stack

```
Traditional Banking          →    XLN Network
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Central Banks                →    Blockchain settlement
Commercial Banks             →    Hub operators
Credit Cards                 →    Direct merchant credit
Wire Transfers              →    Instant routing
Letters of Credit           →    Smart contract escrow
```

## Critical Success Factors

### What Makes This Work

1. **Start Small**: 10 taco trucks > 10,000 lines of code
2. **Solve Real Problems**: 2.9% fees hurt. Zero deposit helps.
3. **Network Effects**: Each merchant adds value for others
4. **Capital Efficiency**: 5x leverage makes hubs profitable
5. **Regulatory Arbitrage**: Credit not money transmission

### What Kills This

1. **Over-Engineering**: Byzantine consensus before product-market fit
2. **Wrong Market**: Crypto bros instead of taco trucks
3. **Premature Scaling**: 10 countries before 10 merchants work
4. **Complexity**: If merchants need training, you've failed
5. **Ignoring Unit Economics**: Must be profitable per hub

## Metrics That Matter

### Phase 0-1 (Prove It Works)

- Merchants onboarded
- Weekly payment volume
- Merchant retention (>90%)
- Time to onboard (<3 minutes)

### Phase 2-3 (Prove It Scales)

- Payment success rate (>99.9%)
- Hub utilization rate
- Cross-border volume
- Settlement efficiency

### Phase 4-5 (Prove It Wins)

- Cost per transaction (<$0.01)
- Global transfer time (<10 seconds)
- Network transaction volume
- Market share vs Western Union

## The Team You Need

### Now (1-3 people)

- Builder who can code and talk to merchants
- Ops person who knows payments/compliance
- Maybe a designer who gets simplicity

### At 100 Merchants (5-10 people)

- Mobile developers
- Customer support (Spanish speaking)
- Hub operations manager
- Compliance officer

### At Scale (50+ people)

- Hub partnership team
- Risk/fraud team
- Multiple regional teams
- Legal counsel per jurisdiction

## Go-to-Market Playbook

### Week 1: First Merchant

1. Walk into Maria's Taco Truck
2. "Want to accept card payments with no equipment?"
3. Set up in 3 minutes
4. Give her your cell number
5. Check in daily

### Month 1: First Ten

1. All within walking distance
2. Visit every day
3. Fix problems immediately
4. Get video testimonials
5. Ask for referrals

### Month 3: First Hundred

1. Hire Spanish-speaking support
2. Create WhatsApp group for merchants
3. Weekly webinars on maximizing sales
4. Referral bonuses ($50 per merchant)
5. Local Facebook ads

### Month 6: First Thousand

1. Partner with merchant associations
2. Sponsor local events
3. Radio ads on Spanish stations
4. Merchant success stories
5. "Powered by XLN" stickers

## The Moat

### Why This Wins

1. **Network Effects**: More merchants → more valuable
2. **Capital Efficiency**: We need 80% less capital than banks
3. **Trust Relationships**: Built over time, hard to replicate
4. **Regulatory Complexity**: Each jurisdiction is a barrier
5. **Brand**: "The payment network that believed in you"

### Why Lightning Failed

1. **Bootstrap Problem**: Need money to receive money
2. **No Credit**: Pure collateral system
3. **Complex UX**: Channel management
4. **No Fiat Rails**: Crypto-only
5. **Tech-First**: Built for nerds, not merchants

## The End Game

### 5 Years Out

- 1M merchants globally
- $100B annual volume
- 1% of global remittances
- IPO or acquisition by Visa/Block
- You're worth $100M+

### 10 Years Out

- Primary payment network in emerging markets
- Banks use XLN for correspondent banking
- Central banks issue CBDCs on XLN
- Credit is programmable and universal
- Financial inclusion achieved

## Start Today

1. Deploy hub on cheapest VPS
2. Print 10 QR code stickers
3. Walk to nearest food truck
4. Onboard them in 3 minutes
5. Post their success on Twitter

The code is done. The innovation is real. Now go find Maria and change how money moves.

---

_Remember: Western Union moves $150B annually at 7% fees. We need 1% of that at 0.5% fees to build a unicorn. The market is there. The solution works. You just need to ship._
