// XLN Hub Server - Manages credit-line channels
// SQLite built into Bun, WebSockets for realtime, simple HTTP server

import { Database } from "bun:sqlite"
import { serve } from "bun"
import { wallet, address, type Address } from '../src/crypto.js'

// Hub identity
const hubWallet = wallet('xln-hub-1')
const hubAddress = address(hubWallet)

// Database - just a local SQLite file
const db = new Database("hub.db")

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS channels (
    merchant_address TEXT PRIMARY KEY,
    merchant_name TEXT NOT NULL,
    credit_limit INTEGER NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_address TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// WebSocket connections
const merchants = new Map<string, any>()

// Single Bun server handling both HTTP and WebSocket
const server = serve({
  port: 3000,
  
  async fetch(req) {
    const url = new URL(req.url)
    
    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const upgraded = server.upgrade(req)
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 })
      }
      return undefined
    }
    
    // Enable CORS for local development
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    }
    
    // Handle preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers })
    }
    
    // API Routes
    const path = url.pathname
    
    // POST /api/merchants - Register merchant
    if (path === "/api/merchants" && req.method === "POST") {
      const { name, creditLimit = 1000 } = await req.json()
      
      const merchantAddress = address(wallet(name))
      
      db.run(
        "INSERT INTO channels (merchant_address, merchant_name, credit_limit) VALUES (?, ?, ?)",
        [merchantAddress, name, creditLimit]
      )
      
      return Response.json({
        success: true,
        merchant: {
          name,
          address: merchantAddress,
          creditLimit,
          message: `Can now receive up to $${creditLimit} with ZERO deposit!`
        }
      }, { headers })
    }
    
    // POST /api/pay/:address - Process payment
    if (path.startsWith("/api/pay/") && req.method === "POST") {
      const merchantAddress = path.split("/").pop()
      const { amount } = await req.json()
      
      const channel = db.query("SELECT * FROM channels WHERE merchant_address = ?").get(merchantAddress)
      
      if (!channel) {
        return Response.json({ error: "Merchant not found" }, { status: 404, headers })
      }
      
      // Check credit limit
      if (channel.balance + amount > channel.credit_limit) {
        return Response.json({ error: "Exceeds credit limit" }, { status: 400, headers })
      }
      
      // Update balance
      db.run(
        "UPDATE channels SET balance = balance + ? WHERE merchant_address = ?",
        [amount, merchantAddress]
      )
      
      // Record payment
      db.run(
        "INSERT INTO payments (merchant_address, amount) VALUES (?, ?)",
        [merchantAddress, amount]
      )
      
      // Notify merchant via WebSocket
      const ws = merchants.get(merchantAddress)
      if (ws) {
        ws.send(JSON.stringify({
          type: 'payment',
          amount,
          newBalance: channel.balance + amount
        }))
      }
      
      return Response.json({
        success: true,
        payment: {
          merchant: channel.merchant_name,
          amount,
          newBalance: channel.balance + amount,
          availableCredit: channel.credit_limit - (channel.balance + amount)
        }
      }, { headers })
    }
    
    // GET /api/merchants/:address - Get merchant info
    if (path.startsWith("/api/merchants/") && req.method === "GET") {
      const merchantAddress = path.split("/").pop()
      const channel = db.query("SELECT * FROM channels WHERE merchant_address = ?").get(merchantAddress)
      
      if (!channel) {
        return Response.json({ error: "Merchant not found" }, { status: 404, headers })
      }
      
      return Response.json({
        name: channel.merchant_name,
        address: channel.merchant_address,
        creditLimit: channel.credit_limit,
        balance: channel.balance,
        availableCredit: channel.credit_limit - channel.balance
      }, { headers })
    }
    
    // GET / - Welcome message
    if (path === "/") {
      return Response.json({
        name: "XLN Hub",
        address: hubAddress,
        message: "Merchants can receive payments with ZERO deposit!",
        endpoints: {
          "POST /api/merchants": "Register merchant with credit line",
          "POST /api/pay/:address": "Process payment to merchant",
          "GET /api/merchants/:address": "Get merchant info"
        }
      }, { headers })
    }
    
    return new Response("Not found", { status: 404 })
  },
  
  websocket: {
    open(ws) {
      const address = new URL(ws.data.url).pathname.slice(1)
      if (address) {
        merchants.set(address, ws)
      }
    },
    
    close(ws) {
      const address = new URL(ws.data.url).pathname.slice(1)
      merchants.delete(address)
    },
    
    message(ws, message) {
      // Echo for testing
      ws.send(message)
    }
  }
})

console.log(`\n🚀 XLN Hub Running on http://localhost:3000`)
console.log(`Hub address: ${hubAddress}`)
console.log(`\nAPI Endpoints:`)
console.log(`  POST /api/merchants - Register merchant with credit line`)
console.log(`  POST /api/pay/:address - Process payment to merchant`)
console.log(`  GET  /api/merchants/:address - Get merchant info`)
console.log(`\n💡 The Innovation: Merchants can receive payments with ZERO deposit!`)