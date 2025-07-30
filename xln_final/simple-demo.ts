#!/usr/bin/env bun
// Simple XLN Demo - Shows the core innovation in 50 lines

import { channel, pay } from './src/core/channels'
import { wallet, address } from './src/core/crypto'

// The story: Maria opens a taco truck and needs to accept payments
// In Lightning: She needs $1000 locked up to receive $1000
// In XLN: She needs $0 to receive $1000

const main = async () => {
  console.log('\n🌮 XLN Demo: Maria\'s Taco Truck\n')
  
  // 1. Maria and the Payment Hub
  const hub = wallet('payment-hub')
  const maria = wallet('maria-taco-truck')
  
  console.log('Maria wants to accept digital payments at her new taco truck.')
  console.log(`Maria's address: ${address(maria)}`)
  console.log(`Hub's address: ${address(hub)}\n`)
  
  // 2. Lightning Network approach (fails)
  console.log('❌ Lightning Network:')
  console.log('Hub: "You need to deposit $1000 to receive $1000 in payments"')
  console.log('Maria: "But I just started my business, I don\'t have $1000!"')
  console.log('Result: Maria can\'t accept digital payments. 😢\n')
  
  // 3. XLN approach (works!)
  console.log('✅ XLN Credit-Line Channels:')
  console.log('Hub: "No deposit needed! Here\'s a $1000 credit line."')
  
  // Create channel with asymmetric credit limits
  const ch = channel(
    address(hub),
    address(maria),
    0n,      // Hub needs no credit from Maria
    1000n    // Maria gets $1000 credit line instantly!
  )
  
  console.log(`\nChannel created:`)
  console.log(`- Maria can receive up to: $${ch.rightCreditLimit}`)
  console.log(`- Maria's deposit required: $0`)
  console.log(`- Current balance: $${ch.balance}\n`)
  
  // 4. Customer pays Maria $50 for tacos
  console.log('🌯 Customer buys $50 worth of tacos...')
  
  const payment = {
    from: address(hub),  // Payment comes through hub
    to: address(maria),
    amount: 50n
  }
  
  const updatedChannel = pay(ch, payment)
  
  if (updatedChannel) {
    console.log(`\n✅ Payment successful!`)
    console.log(`- Maria received: $50`)
    console.log(`- Channel balance: $${updatedChannel.balance}`)
    console.log(`- Maria can still receive: $${ch.rightCreditLimit - updatedChannel.balance}`)
    console.log(`- Maria's total deposits: $0`)
  }
  
  console.log('\n🎉 THE INNOVATION:')
  console.log('Maria accepted $50 in payments without locking up a single dollar!')
  console.log('In Lightning, this would be impossible without pre-funding.')
  console.log('\nXLN enables instant business operations for everyone. 🚀')
}

main()