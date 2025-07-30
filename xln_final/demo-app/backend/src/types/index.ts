// XLN Demo API Types
import type { Address, Channel } from '../../../core/channels.js'

// Merchant registration
export interface Merchant {
  readonly id: string
  readonly name: string
  readonly address: Address
  readonly creditLimit: bigint  // Instantly granted credit line
  readonly balance: bigint      // Current balance (can receive up to creditLimit)
  readonly totalReceived: bigint
  readonly joinedAt: Date
}

// Customer account
export interface Customer {
  readonly id: string
  readonly name: string
  readonly address: Address
  readonly balance: bigint      // Pre-funded balance
  readonly totalSpent: bigint
}

// Payment record
export interface PaymentRecord {
  readonly id: string
  readonly from: Address
  readonly to: Address
  readonly amount: bigint
  readonly timestamp: Date
  readonly channelId: string
  readonly status: 'completed' | 'failed'
  readonly reason?: string
}

// Hub statistics
export interface HubStats {
  readonly address: Address
  readonly totalCollateral: bigint
  readonly totalCreditExtended: bigint
  readonly activeChannels: number
  readonly totalPayments: number
  readonly successRate: number
  readonly capitalEfficiency: number
}

// API responses
export type ApiResponse<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string }

// Registration requests
export interface RegisterMerchantRequest {
  name: string
  requestedCreditLimit?: string  // Default: 10000
}

export interface RegisterCustomerRequest {
  name: string
  initialDeposit: string
}

// Payment request
export interface PaymentRequest {
  from: string  // Customer ID
  to: string    // Merchant ID
  amount: string
}

// Merchant info for display
export interface MerchantInfo {
  id: string
  name: string
  address: string
  creditLimit: string
  balance: string
  availableToReceive: string
  totalReceived: string
  canReceiveWithoutFunding: boolean  // Always true! The key innovation
}