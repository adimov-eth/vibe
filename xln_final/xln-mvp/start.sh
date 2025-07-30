#!/bin/bash

echo "🚀 Starting XLN MVP - Maria's Taco Truck"
echo ""

# Install dependencies
bun install

# Start hub
echo "Starting hub..."
bun run hub/server.ts &

# Wait a bit
sleep 2

# Open merchant app
echo "Opening merchant app..."
open merchant/index.html

echo ""
echo "✅ Ready! Register a merchant and start accepting payments with $0 deposit!"
echo ""
echo "To test payments:"
echo "1. Register merchant in the app"
echo "2. Copy the merchant address"
echo "3. Open: customer/pay.html"
echo "4. Add #MERCHANT_ADDRESS to the URL"