// XLN Hub Service - The core innovation engine
// Manages credit-line channels enabling zero-capital payment acceptance

import { channel, pay, sign, route, type Channel, type Address } from '../../../../src/core/channels.js'
import { wallet, address } from '../../../../src/core/crypto.js'
import { type Hub, maxCredit, analyze, RESERVE_RATIOS } from '../../../../src/economics/fractional-reserve.js'
import type { Merchant, Customer, PaymentRecord } from '../types/index.js'

export class HubService {
  private readonly hubWallet = wallet('xln-demo-hub')
  private readonly hubAddress: Address
  
  // State
  private channels = new Map<string, Channel>()
  private merchants = new Map<string, Merchant>()
  private customers = new Map<string, Customer>()
  private payments: PaymentRecord[] = []
  
  // Hub economics
  private hub: Hub
  
  constructor() {
    this.hubAddress = address(this.hubWallet)
    
    // Initialize hub with 100k collateral as major hub (5x leverage)
    this.hub = {
      id: 'demo-hub',
      collateral: 100_000n,
      creditExtended: 0n,
      creditReceived: 0n,
      tier: 'major'
    }
    
    console.log(`Hub initialized at ${this.hubAddress}`)
    console.log(`Collateral: $${this.hub.collateral}`)
    console.log(`Max credit capacity: $${maxCredit(this.hub)} (${1/RESERVE_RATIOS.major}x leverage)`)
  }
  
  // Register merchant with instant credit line
  async registerMerchant(name: string, requestedCredit = 10_000n): Promise<Merchant> {
    // Check hub capacity
    const available = maxCredit(this.hub)
    if (requestedCredit > available) {
      throw new Error(`Insufficient hub capacity. Available: $${available}`)
    }
    
    // Create merchant
    const merchantWallet = wallet(name)
    const merchantAddress = address(merchantWallet)
    const merchant: Merchant = {
      id: `merchant-${Date.now()}`,
      name,
      address: merchantAddress,
      creditLimit: requestedCredit,
      balance: 0n,
      totalReceived: 0n,
      joinedAt: new Date()
    }
    
    // Create credit-line channel
    // Hub extends credit to merchant (rightCreditLimit)
    const ch = channel(
      this.hubAddress,
      merchantAddress,
      0n,  // Hub needs no credit from merchant
      requestedCredit  // Merchant gets instant credit line!
    )
    
    // Store channel directly
    const signed = ch
    
    // Store
    this.channels.set(`${this.hubAddress}-${merchantAddress}`, signed)
    this.merchants.set(merchant.id, merchant)
    
    // Update hub accounting
    this.hub = {
      ...this.hub,
      creditExtended: this.hub.creditExtended + requestedCredit
    }
    
    console.log(`\n✅ Merchant "${name}" registered!`)
    console.log(`   Credit line: $${requestedCredit}`)
    console.log(`   Can accept payments: IMMEDIATELY`)
    console.log(`   Required deposit: $0`)
    console.log(`   Hub utilization: ${analyze(this.hub).utilization}`)
    
    return merchant
  }
  
  // Register customer (needs to deposit funds)
  async registerCustomer(name: string, deposit: bigint): Promise<Customer> {
    const customerWallet = wallet(name)
    const customerAddress = address(customerWallet)
    
    const customer: Customer = {
      id: `customer-${Date.now()}`,
      name,
      address: customerAddress,
      balance: deposit,
      totalSpent: 0n
    }
    
    // Create channel with customer's deposit
    // Hub must be first participant for consistent balance interpretation
    const ch = channel(
      this.hubAddress,    // Hub first
      customerAddress,    // Customer second
      0n,                 // Hub needs no credit from customer
      deposit             // Customer's spending limit
    )
    
    // Sign initial state
    const signed = await sign(this.hubWallet, ch)
    
    // Store
    this.channels.set(`${this.hubAddress}-${customerAddress}`, signed)
    this.customers.set(customer.id, customer)
    
    console.log(`\n✅ Customer "${name}" registered!`)
    console.log(`   Deposited: $${deposit}`)
    console.log(`   Can spend up to: $${deposit}`)
    
    return customer
  }
  
  // Process payment - the magic happens here
  async processPayment(customerId: string, merchantId: string, amount: bigint): Promise<PaymentRecord> {
    const customer = this.customers.get(customerId)
    const merchant = this.merchants.get(merchantId)
    
    if (!customer || !merchant) {
      throw new Error('Invalid customer or merchant')
    }
    
    if (amount > customer.balance) {
      throw new Error(`Insufficient funds. Balance: $${customer.balance}`)
    }
    
    // Check if merchant can receive (within credit limit)
    if (merchant.balance + amount > merchant.creditLimit) {
      throw new Error(`Exceeds merchant credit limit. Available: $${merchant.creditLimit - merchant.balance}`)
    }
    
    // Simple two-hop payment: customer -> hub -> merchant
    // First hop: customer pays hub
    const customerChannelKey = `${this.hubAddress}-${customer.address}`
    const customerChannel = this.channels.get(customerChannelKey)
    if (!customerChannel) throw new Error('Customer channel not found')
    
    // In credit model: hub extends credit to customer (negative balance)
    const payment1 = { from: this.hubAddress, to: customer.address, amount }
    console.log('Customer channel before payment:', {
      participants: customerChannel.participants,
      balance: customerChannel.balance,
      leftCredit: customerChannel.leftCreditLimit,
      rightCredit: customerChannel.rightCreditLimit
    })
    console.log('Payment:', payment1)
    const updatedCustomerChannel = pay(customerChannel, payment1)
    if (!updatedCustomerChannel) throw new Error('Customer payment failed')
    
    // Second hop: hub pays merchant  
    const merchantChannelKey = `${this.hubAddress}-${merchant.address}`
    const merchantChannel = this.channels.get(merchantChannelKey)
    if (!merchantChannel) throw new Error('Merchant channel not found')
    
    const payment2 = { from: this.hubAddress, to: merchant.address, amount }
    const updatedMerchantChannel = pay(merchantChannel, payment2)
    if (!updatedMerchantChannel) throw new Error('Merchant payment failed')
    
    // Update channels
    this.channels.set(customerChannelKey, updatedCustomerChannel)
    this.channels.set(merchantChannelKey, updatedMerchantChannel)
    
    // Update balances
    this.customers.set(customerId, {
      ...customer,
      balance: customer.balance - amount,
      totalSpent: customer.totalSpent + amount
    })
    
    this.merchants.set(merchantId, {
      ...merchant,
      balance: merchant.balance + amount,
      totalReceived: merchant.totalReceived + amount
    })
    
    // Record payment
    const payment: PaymentRecord = {
      id: `payment-${Date.now()}`,
      from: customer.address,
      to: merchant.address,
      amount,
      timestamp: new Date(),
      channelId: `${customer.address}->${this.hubAddress}->${merchant.address}`,
      status: 'completed'
    }
    
    this.payments.push(payment)
    
    console.log(`\n💸 Payment processed!`)
    console.log(`   ${customer.name} → ${merchant.name}: $${amount}`)
    console.log(`   Route: ${customer.name} → Hub → ${merchant.name}`)
    console.log(`   Merchant balance: $${this.merchants.get(merchantId)!.balance}`)
    console.log(`   Merchant received WITHOUT any deposit!`)
    
    return payment
  }
  
  // Get hub statistics
  getStats(): HubStats {
    const analysis = analyze(this.hub)
    const successfulPayments = this.payments.filter(p => p.status === 'completed').length
    
    return {
      address: this.hubAddress,
      totalCollateral: this.hub.collateral,
      totalCreditExtended: this.hub.creditExtended,
      activeChannels: this.channels.size,
      totalPayments: this.payments.length,
      successRate: this.payments.length > 0 ? (successfulPayments / this.payments.length) : 1,
      capitalEfficiency: parseFloat(analysis.efficiency)
    }
  }
  
  // Get merchant info
  getMerchant(id: string): Merchant | undefined {
    return this.merchants.get(id)
  }
  
  // Get all merchants
  getAllMerchants(): Merchant[] {
    return Array.from(this.merchants.values())
  }
  
  // Get customer
  getCustomer(id: string): Customer | undefined {
    return this.customers.get(id)
  }
  
  // Get payment history
  getPayments(limit = 50): PaymentRecord[] {
    return this.payments.slice(-limit).reverse()
  }
}

// Singleton instance
export const hub = new HubService()