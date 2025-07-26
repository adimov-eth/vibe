// Credit-line payment channel types - THE REVOLUTIONARY INNOVATION
// Allows receivers to accept payments without pre-funding

export type Address = string

export interface CreditLineChannel {
  readonly id: string
  readonly participants: readonly [Address, Address]
  readonly balances: Record<Address, bigint>
  readonly creditLimits: Record<Address, bigint>  // CORE INNOVATION: Credit limits enable unfunded receiving
  readonly reserved: Record<Address, bigint>      // Reserved for pending payments
  readonly nonce: bigint
  readonly status: 'open' | 'disputed' | 'closing' | 'closed'
  readonly lastUpdate: number
  readonly hubAddress?: Address  // Hub facilitating this channel
}

export interface PaymentRequest {
  readonly channelId: string
  readonly from: Address
  readonly to: Address
  readonly amount: bigint
  readonly memo?: string
  readonly expiry: number
}

export interface Payment {
  readonly id: string
  readonly channelId: string
  readonly from: Address
  readonly to: Address
  readonly amount: bigint
  readonly timestamp: number
  readonly status: 'pending' | 'completed' | 'failed' | 'cancelled'
  readonly route?: Address[]  // Path through hubs if routed payment
}

export interface PaymentRoute {
  readonly path: Address[]
  readonly totalFees: bigint
  readonly estimatedSuccess: number  // 0-1 probability
  readonly estimatedDelay: number    // milliseconds
}

export interface ChannelUpdate {
  readonly channelId: string
  readonly newBalances: Record<Address, bigint>
  readonly newReserved: Record<Address, bigint>
  readonly nonce: bigint
  readonly signatures: Record<Address, string>
}

export interface HubInfo {
  readonly address: Address
  readonly totalLiquidity: bigint
  readonly reserveRatio: number      // e.g. 0.2 for 20% reserves
  readonly connectedChannels: number
  readonly feeRate: bigint          // Fee in basis points
  readonly uptime: number           // 0-1 reliability score
}

export interface ChannelOpenRequest {
  readonly participants: [Address, Address]
  readonly initialBalances: Record<Address, bigint>
  readonly creditLimits: Record<Address, bigint>
  readonly hubAddress?: Address
}

export type ChannelResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string; code: string }

export type PaymentResult = 
  | { ok: true; payment: Payment }
  | { ok: false; error: string; code: 'INSUFFICIENT_BALANCE' | 'CREDIT_EXCEEDED' | 'CHANNEL_CLOSED' | 'ROUTE_FAILED' }

// Payment channel error codes
export const ChannelErrorCodes = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  CREDIT_EXCEEDED: 'CREDIT_EXCEEDED', 
  CHANNEL_CLOSED: 'CHANNEL_CLOSED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  NONCE_MISMATCH: 'NONCE_MISMATCH',
  ROUTE_FAILED: 'ROUTE_FAILED',
  HUB_UNAVAILABLE: 'HUB_UNAVAILABLE'
} as const