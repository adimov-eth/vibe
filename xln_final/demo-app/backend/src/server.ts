// XLN Demo Backend - Zero Capital Payment Acceptance
// This API demonstrates the revolutionary credit-line payment channels

import { hub } from './services/hub.js'
import type { ApiResponse, RegisterMerchantRequest, RegisterCustomerRequest, PaymentRequest, MerchantInfo } from './types/index.js'

const PORT = 3000

// Helper to convert bigint for JSON
const serializeBigInt = (obj: any): any => {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  )
}

// Create Bun server
Bun.serve({
  port: PORT,
  
  async fetch(req) {
    const url = new URL(req.url)
    const method = req.method
    
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    }
    
    // Handle preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers, status: 204 })
    }
    
    try {
      // Route: Register merchant with instant credit line
      if (method === 'POST' && url.pathname === '/api/merchants/register') {
        const body: RegisterMerchantRequest = await req.json()
        
        const creditLimit = body.requestedCreditLimit 
          ? BigInt(body.requestedCreditLimit)
          : 10_000n  // Default $10k credit line
        
        const merchant = await hub.registerMerchant(body.name, creditLimit)
        
        const response: ApiResponse<MerchantInfo> = {
          ok: true,
          data: {
            id: merchant.id,
            name: merchant.name,
            address: merchant.address.toString(),
            creditLimit: merchant.creditLimit.toString(),
            balance: merchant.balance.toString(),
            availableToReceive: (merchant.creditLimit - merchant.balance).toString(),
            totalReceived: merchant.totalReceived.toString(),
            canReceiveWithoutFunding: true  // THE KEY INNOVATION!
          }
        }
        
        return Response.json(serializeBigInt(response), { headers })
      }
      
      // Route: Get all merchants
      if (method === 'GET' && url.pathname === '/api/merchants') {
        const merchants = hub.getAllMerchants()
        const merchantInfos: MerchantInfo[] = merchants.map(m => ({
          id: m.id,
          name: m.name,
          address: m.address.toString(),
          creditLimit: m.creditLimit.toString(),
          balance: m.balance.toString(),
          availableToReceive: (m.creditLimit - m.balance).toString(),
          totalReceived: m.totalReceived.toString(),
          canReceiveWithoutFunding: true
        }))
        
        return Response.json({ ok: true, data: merchantInfos }, { headers })
      }
      
      // Route: Register customer (needs deposit)
      if (method === 'POST' && url.pathname === '/api/customers/register') {
        const body: RegisterCustomerRequest = await req.json()
        const deposit = BigInt(body.initialDeposit)
        
        const customer = await hub.registerCustomer(body.name, deposit)
        
        return Response.json({
          ok: true,
          data: serializeBigInt({
            id: customer.id,
            name: customer.name,
            address: customer.address,
            balance: customer.balance,
            totalSpent: customer.totalSpent
          })
        }, { headers })
      }
      
      // Route: Process payment
      if (method === 'POST' && url.pathname === '/api/payments') {
        const body: PaymentRequest = await req.json()
        const amount = BigInt(body.amount)
        
        const payment = await hub.processPayment(body.from, body.to, amount)
        
        return Response.json({
          ok: true,
          data: serializeBigInt({
            id: payment.id,
            from: payment.from,
            to: payment.to,
            amount: payment.amount,
            timestamp: payment.timestamp,
            status: payment.status
          })
        }, { headers })
      }
      
      // Route: Get payment history
      if (method === 'GET' && url.pathname === '/api/payments') {
        const payments = hub.getPayments()
        
        return Response.json({
          ok: true,
          data: serializeBigInt(payments)
        }, { headers })
      }
      
      // Route: Hub statistics
      if (method === 'GET' && url.pathname === '/api/hub/stats') {
        const stats = hub.getStats()
        
        return Response.json({
          ok: true,
          data: {
            ...serializeBigInt(stats),
            message: `Hub operating at ${stats.capitalEfficiency}x capital efficiency vs Lightning!`
          }
        }, { headers })
      }
      
      // Route: Demo scenario - showcase the innovation
      if (method === 'POST' && url.pathname === '/api/demo/showcase') {
        // Create a complete demo scenario
        console.log('\n🚀 RUNNING XLN DEMO SHOWCASE\n')
        
        // 1. Register coffee shop with instant $5k credit
        const coffeeShop = await hub.registerMerchant('Web3 Coffee Shop', 5_000n)
        
        // 2. Register customer with $100 deposit
        const customer = await hub.registerCustomer('Alice', 100n)
        
        // 3. Process payments
        await hub.processPayment(customer.id, coffeeShop.id, 5n)  // $5 coffee
        await hub.processPayment(customer.id, coffeeShop.id, 15n) // $15 lunch
        
        // 4. Get updated merchant
        const updatedMerchant = hub.getMerchant(coffeeShop.id)!
        
        const showcase = {
          message: "XLN Demo Complete! 🎉",
          innovation: "The coffee shop accepted $20 in payments WITHOUT any initial deposit!",
          comparison: {
            lightning: {
              merchantDeposit: "$5,000 required upfront",
              hubCollateral: "$5,000 locked",
              capitalEfficiency: "1x"
            },
            xln: {
              merchantDeposit: "$0 required",
              hubCollateral: "$1,000 (20% fractional reserve)",
              capitalEfficiency: "5x"
            }
          },
          results: {
            merchantName: updatedMerchant.name,
            creditLine: updatedMerchant.creditLimit.toString(),
            received: updatedMerchant.balance.toString(),
            deposited: "0",
            instantlyOperational: true
          }
        }
        
        return Response.json({ ok: true, data: showcase }, { headers })
      }
      
      // 404 for unknown routes
      return Response.json(
        { ok: false, error: 'Route not found' },
        { headers, status: 404 }
      )
      
    } catch (error) {
      console.error('API Error:', error)
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : 'Internal error' },
        { headers, status: 500 }
      )
    }
  }
})

console.log(`
🚀 XLN Demo Backend Running on http://localhost:${PORT}

Key Innovation: Merchants can accept payments with ZERO capital!

Try the demo:
  curl -X POST http://localhost:${PORT}/api/demo/showcase

API Endpoints:
  POST /api/merchants/register     - Register merchant (instant credit line)
  GET  /api/merchants              - List all merchants
  POST /api/customers/register     - Register customer (requires deposit)
  POST /api/payments               - Process payment
  GET  /api/payments               - Payment history
  GET  /api/hub/stats              - Hub statistics

The revolution: In Lightning, merchants need $1000 to receive $1000.
In XLN, merchants need $0 to receive $1000. That's the game changer.
`)