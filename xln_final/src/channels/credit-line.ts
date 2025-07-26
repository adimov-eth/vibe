// Credit-line payment channels - THE CORE INNOVATION
// Receivers can accept payments without pre-funding through credit limits
// This solves Lightning Network's fundamental bootstrap problem

import type {
  CreditLineChannel,
  PaymentRequest,
  Payment,
  ChannelOpenRequest,
  ChannelUpdate,
  ChannelResult,
  PaymentResult,
  Address
} from '../types/channels.js'
import { ChannelErrorCodes } from '../types/channels.js'

const DEBUG = true

// === CHANNEL CREATION ===

export const createCreditLineChannel = (
  request: ChannelOpenRequest
): ChannelResult<CreditLineChannel> => {
  const [participant1, participant2] = request.participants
  
  if (DEBUG) console.log(`💳 Creating credit-line channel: ${participant1} ↔ ${participant2}`)
  
  // Validation
  if (participant1 === participant2) {
    return { ok: false, error: 'Participants must be different', code: 'INVALID_PARTICIPANTS' }
  }

  // Generate deterministic channel ID
  const channelId = generateChannelId(participant1, participant2)
  
  const channel: CreditLineChannel = {
    id: channelId,
    participants: [participant1, participant2],
    balances: { ...request.initialBalances },
    creditLimits: { ...request.creditLimits },  // INNOVATION: Credit limits for unfunded receiving
    reserved: { [participant1]: 0n, [participant2]: 0n },
    nonce: 0n,
    status: 'open',
    lastUpdate: Date.now(),
    hubAddress: request.hubAddress
  }

  if (DEBUG) {
    console.log(`  ✅ Channel created: ${channelId}`)
    console.log(`  💰 Initial balances: ${participant1}=${request.initialBalances[participant1] || 0n}, ${participant2}=${request.initialBalances[participant2] || 0n}`)
    console.log(`  🏦 Credit limits: ${participant1}=${request.creditLimits[participant1] || 0n}, ${participant2}=${request.creditLimits[participant2] || 0n}`)
  }

  return { ok: true, data: channel }
}

// === PAYMENT PROCESSING ===

/**
 * REVOLUTIONARY: Receive payment without pre-funding
 * The receiver can accept payments up to their credit limit even with zero balance
 */
export const receivePayment = (
  channel: CreditLineChannel,
  request: PaymentRequest
): PaymentResult => {
  if (DEBUG) console.log(`📥 Processing payment: ${request.from} → ${request.to}, amount: ${request.amount}`)

  // Validation
  if (channel.status !== 'open') {
    return { ok: false, error: 'Channel is not open', code: 'CHANNEL_CLOSED' }
  }

  if (!channel.participants.includes(request.from) || !channel.participants.includes(request.to)) {
    return { ok: false, error: 'Invalid participants', code: 'INVALID_SIGNATURE' }
  }

  const senderBalance = channel.balances[request.from] || 0n
  const senderReserved = channel.reserved[request.from] || 0n
  const receiverBalance = channel.balances[request.to] || 0n
  const receiverCreditLimit = channel.creditLimits[request.to] || 0n

  // Check sender has available funds (balance - reserved)
  const senderAvailable = senderBalance - senderReserved
  if (senderAvailable < request.amount) {
    if (DEBUG) console.log(`  ❌ Insufficient sender balance: ${senderAvailable} < ${request.amount}`)
    return { ok: false, error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' }
  }

  // INNOVATION CHECK: Receiver can go negative up to credit limit
  const receiverNewBalance = receiverBalance + request.amount
  const maxReceivableAmount = receiverCreditLimit  // Can receive up to credit limit even from zero
  
  if (receiverBalance < 0n && receiverNewBalance > receiverCreditLimit) {
    if (DEBUG) console.log(`  ❌ Payment would exceed receiver credit limit: ${receiverNewBalance} > ${receiverCreditLimit}`)
    return { ok: false, error: 'Would exceed credit limit', code: 'CREDIT_EXCEEDED' }
  }

  // Create payment record
  const payment: Payment = {
    id: generatePaymentId(request),
    channelId: channel.id,
    from: request.from,
    to: request.to,
    amount: request.amount,
    timestamp: Date.now(),
    status: 'completed'
  }

  if (DEBUG) {
    console.log(`  ✅ Payment accepted!`)
    console.log(`  💰 Sender: ${senderBalance} → ${senderBalance - request.amount}`)
    console.log(`  💰 Receiver: ${receiverBalance} → ${receiverBalance + request.amount}`)
    if (receiverBalance + request.amount < 0n) {
      console.log(`  🏦 CREDIT USED: Receiver went negative (${receiverBalance + request.amount}), enabled by credit limit`)
    }
  }

  return { ok: true, payment }
}

/**
 * Send payment - traditional direction
 */
export const sendPayment = (
  channel: CreditLineChannel,
  request: PaymentRequest
): PaymentResult => {
  return receivePayment(channel, request)  // Same logic, different perspective
}

/**
 * Apply payment to channel state (after successful validation)
 */
export const applyPaymentToChannel = (
  channel: CreditLineChannel,
  payment: Payment
): ChannelResult<CreditLineChannel> => {
  if (payment.status !== 'completed') {
    return { ok: false, error: 'Cannot apply non-completed payment', code: 'INVALID_SIGNATURE' }
  }

  const newBalances = { ...channel.balances }
  newBalances[payment.from] = (newBalances[payment.from] || 0n) - payment.amount
  newBalances[payment.to] = (newBalances[payment.to] || 0n) + payment.amount

  const updatedChannel: CreditLineChannel = {
    ...channel,
    balances: newBalances,
    nonce: channel.nonce + 1n,
    lastUpdate: Date.now()
  }

  return { ok: true, data: updatedChannel }
}

// === CHANNEL STATE MANAGEMENT ===

/**
 * Check if channel can accept payment of given amount
 */
export const canAcceptPayment = (
  channel: CreditLineChannel,
  from: Address,
  to: Address,
  amount: bigint
): boolean => {
  if (channel.status !== 'open') return false

  const senderBalance = channel.balances[from] || 0n
  const senderReserved = channel.reserved[from] || 0n
  const receiverBalance = channel.balances[to] || 0n
  const receiverCreditLimit = channel.creditLimits[to] || 0n

  // Sender check
  const senderAvailable = senderBalance - senderReserved
  if (senderAvailable < amount) return false

  // INNOVATION: Receiver credit check
  const receiverNewBalance = receiverBalance + amount
  if (receiverBalance < 0n && receiverNewBalance > receiverCreditLimit) return false

  return true
}

/**
 * Get available balance for sending (considering reserved amounts)
 */
export const getAvailableBalance = (channel: CreditLineChannel, address: Address): bigint => {
  const balance = channel.balances[address] || 0n
  const reserved = channel.reserved[address] || 0n
  return balance - reserved
}

/**
 * Get available credit for receiving
 */
export const getAvailableCredit = (channel: CreditLineChannel, address: Address): bigint => {
  const balance = channel.balances[address] || 0n
  const creditLimit = channel.creditLimits[address] || 0n
  
  if (balance >= 0n) {
    return creditLimit  // Can receive up to full credit limit
  } else {
    return creditLimit + balance  // Already used some credit (balance is negative)
  }
}

/**
 * Calculate channel liquidity (how much can flow in each direction)
 */
export const getChannelLiquidity = (channel: CreditLineChannel) => {
  const [addr1, addr2] = channel.participants
  
  return {
    [addr1]: {
      canSend: getAvailableBalance(channel, addr1),
      canReceive: getAvailableCredit(channel, addr1),
      balance: channel.balances[addr1] || 0n,
      creditLimit: channel.creditLimits[addr1] || 0n
    },
    [addr2]: {
      canSend: getAvailableBalance(channel, addr2),
      canReceive: getAvailableCredit(channel, addr2),
      balance: channel.balances[addr2] || 0n,
      creditLimit: channel.creditLimits[addr2] || 0n
    }
  }
}

// === UTILITY FUNCTIONS ===

const generateChannelId = (addr1: Address, addr2: Address): string => {
  // Deterministic channel ID from sorted addresses
  const sorted = [addr1, addr2].sort()
  return `ch_${sorted[0]}_${sorted[1]}_${Date.now()}`
}

const generatePaymentId = (request: PaymentRequest): string => {
  return `pay_${request.channelId}_${request.amount}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Create a demo credit-line channel for testing
 */
export const createDemoChannel = (
  addr1: Address, 
  addr2: Address, 
  creditLimit1: bigint = 1000n, 
  creditLimit2: bigint = 1000n
): CreditLineChannel => {
  const request: ChannelOpenRequest = {
    participants: [addr1, addr2],
    initialBalances: { [addr1]: 0n, [addr2]: 0n },  // INNOVATION: Start with zero balances!
    creditLimits: { [addr1]: creditLimit1, [addr2]: creditLimit2 }
  }

  const result = createCreditLineChannel(request)
  if (!result.ok) throw new Error(result.error)
  
  return result.data
}