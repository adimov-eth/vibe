# XLN Demo Frontend

A clean, mobile-first interface that makes XLN's zero-capital innovation visceral and immediate.

## The Innovation Story

**Lightning Network Problem**: Merchants need $1,000 locked up to receive $1,000
**XLN Solution**: Merchants need $0 to receive $10,000+

This frontend makes that story impossible to miss.

## Running the Demo

1. **Start the backend** (in `/demo-app/backend`):
   ```bash
   bun run src/server.ts
   ```
   Backend runs on http://localhost:3001

2. **Start the frontend** (in `/demo-app/frontend`):
   ```bash
   bun serve.js
   ```
   Frontend runs on http://localhost:8080

3. **Open your browser** to http://localhost:8080

## Demo Flow

### As a Merchant:
1. Click "Merchant" tab
2. Enter business name
3. Select credit limit ($5,000 default)
4. Click "Register & Start Accepting"
5. **See the magic**: You can immediately accept up to $5,000 with $0 deposit!

### As a Customer:
1. Click "Customer" tab
2. Register with a deposit (e.g., $100)
3. Enter merchant ID or scan QR
4. Send payment
5. See instant settlement

### As a Hub Operator:
1. Click "Hub" tab
2. See 5x capital efficiency vs Lightning
3. View all merchants operating with zero capital
4. Understand the fractional reserve model (20% vs 100%)

## Key Features

- **Mobile-first design**: Merchants use phones in the real world
- **Zero capital messaging**: Front and center on every screen
- **Live metrics**: See capital efficiency in real-time
- **QR codes**: Simple merchant payment acceptance
- **Instant feedback**: Every action shows the innovation

## The Visceral Moment

When a merchant sees:
- Credit Line: $5,000
- Required Deposit: $0
- Status: "Ready to accept payments!"

They immediately understand why XLN changes everything.

## Technical Stack

- Vanilla JavaScript (no framework overhead)
- Mobile-first CSS
- Real-time API integration
- Clean, focused UX

The goal: Make the innovation so clear that a coffee shop owner gets it in 10 seconds.