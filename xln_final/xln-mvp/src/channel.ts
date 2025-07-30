// XLN Credit-Line Channels - The Core Innovation
// Asymmetric trust relationships that enable receiving without having

import { ethers } from 'ethers'
import { wallet, address, type Address } from './crypto.js'

// The magic: leftCreditLimit !== rightCreditLimit
export interface Channel {
  participants: readonly [Address, Address]
  leftCreditLimit: bigint    // How much left can owe right
  rightCreditLimit: bigint   // How much right can owe left
  balance: bigint            // Current balance (+ means right owes left)
  nonce: bigint
}

export interface Payment {
  from: Address
  to: Address
  amount: bigint
}

// Create channel with asymmetric credit limits
export const createChannel = (
  left: Address,
  right: Address,
  leftCreditLimit: bigint,
  rightCreditLimit: bigint
): Channel => ({
  participants: [left, right],
  leftCreditLimit,
  rightCreditLimit,
  balance: 0n,
  nonce: 0n
})

// Check if payment is possible given credit limits
const canPay = (ch: Channel, payment: Payment): boolean => {
  const [left, right] = ch.participants
  
  // Determine payment direction
  if (payment.from === left && payment.to === right) {
    // Left paying right: balance increases
    const newBalance = ch.balance + payment.amount
    // Check if right would exceed credit limit
    return newBalance <= ch.rightCreditLimit
  } else if (payment.from === right && payment.to === left) {
    // Right paying left: balance decreases
    const newBalance = ch.balance - payment.amount
    // Check if left would exceed credit limit (negative balance)
    return -newBalance <= ch.leftCreditLimit
  }
  
  return false // Invalid payment (not channel participants)
}

// Execute payment
export const pay = (ch: Channel, payment: Payment): Channel | null => {
  if (!canPay(ch, payment)) return null
  
  const [left, right] = ch.participants
  let balanceChange = 0n
  
  if (payment.from === left && payment.to === right) {
    balanceChange = payment.amount
  } else if (payment.from === right && payment.to === left) {
    balanceChange = -payment.amount
  } else {
    return null
  }
  
  return {
    ...ch,
    balance: ch.balance + balanceChange,
    nonce: ch.nonce + 1n
  }
}

// Demo showing the innovation
export const demo = () => {
  console.log('\n💡 XLN Credit-Line Innovation\n')
  
  const hub = address(wallet('hub'))
  const maria = address(wallet('maria-taco-truck'))
  
  // THE INNOVATION: Maria gets credit without depositing
  const channel = createChannel(
    hub,
    maria,
    0n,      // Hub needs no credit from Maria
    1000n    // Maria can receive up to $1000!
  )
  
  console.log('Channel created:')
  console.log(`- Hub needs from Maria: $${channel.leftCreditLimit}`)
  console.log(`- Maria can receive: $${channel.rightCreditLimit}`)
  console.log(`- Maria's deposit: $0\n`)
  
  // Customer payment routed through hub to Maria
  const payment = { from: hub, to: maria, amount: 50n }
  const updated = pay(channel, payment)
  
  if (updated) {
    console.log('✅ Payment successful!')
    console.log(`- Maria received: $50`)
    console.log(`- Channel balance: $${updated.balance}`)
    console.log(`- Maria can still receive: $${channel.rightCreditLimit - updated.balance}`)
  }
  
  console.log('\n🎯 The Revolution:')
  console.log('Lightning: Maria needs $1000 locked to receive $1000')
  console.log('XLN: Maria needs $0 to receive $1000')
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demo()
}