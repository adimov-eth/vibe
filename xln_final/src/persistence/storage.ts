// XLN Channel State Persistence - Save/load channel state to JSON
// Pure functions for serialize/deserialize, no side effects

import type { Channel } from '../core/channels.js'
import type { MultiAssetChannel, Delta } from '../core/multi-asset-channels.js'

// Serialized formats - explicit types for JSON representation
export interface SerializedChannel {
  readonly participants: readonly string[]
  readonly balance: string
  readonly leftCreditLimit: string
  readonly rightCreditLimit: string
  readonly collateral: string
  readonly ondelta: string
  readonly offdelta: string
  readonly nonce: string
  readonly signatures: readonly (string | null)[]
}

export interface SerializedDelta {
  readonly tokenId: number
  readonly collateral: string
  readonly ondelta: string
  readonly offdelta: string
  readonly leftCreditLimit: string
  readonly rightCreditLimit: string
}

export interface SerializedMultiAssetChannel {
  readonly participants: readonly string[]
  readonly deltas: readonly SerializedDelta[]
  readonly nonce: string
  readonly signatures: readonly (string | null)[]
}

// Serialize basic channel to JSON-safe format
export const serializeChannel = (ch: Channel): SerializedChannel => ({
  participants: [...ch.participants],
  balance: ch.balance.toString(),
  leftCreditLimit: ch.leftCreditLimit.toString(),
  rightCreditLimit: ch.rightCreditLimit.toString(),
  collateral: ch.collateral.toString(),
  ondelta: ch.ondelta.toString(),
  offdelta: ch.offdelta.toString(),
  nonce: ch.nonce.toString(),
  signatures: ch.signatures.map(sig => sig ?? null)
})

// Deserialize basic channel from JSON
export const deserializeChannel = (data: SerializedChannel): Channel => ({
  participants: [data.participants[0] as `0x${string}`, data.participants[1] as `0x${string}`],
  balance: BigInt(data.balance),
  leftCreditLimit: BigInt(data.leftCreditLimit),
  rightCreditLimit: BigInt(data.rightCreditLimit),
  collateral: BigInt(data.collateral),
  ondelta: BigInt(data.ondelta),
  offdelta: BigInt(data.offdelta),
  nonce: BigInt(data.nonce),
  signatures: [
    data.signatures[0] ? data.signatures[0] as `0x${string}` : undefined,
    data.signatures[1] ? data.signatures[1] as `0x${string}` : undefined
  ]
})

// Serialize delta
const serializeDelta = (d: Delta): SerializedDelta => ({
  tokenId: d.tokenId,
  collateral: d.collateral.toString(),
  ondelta: d.ondelta.toString(),
  offdelta: d.offdelta.toString(),
  leftCreditLimit: d.leftCreditLimit.toString(),
  rightCreditLimit: d.rightCreditLimit.toString()
})

// Deserialize delta
const deserializeDelta = (d: SerializedDelta): Delta => ({
  tokenId: d.tokenId,
  collateral: BigInt(d.collateral),
  ondelta: BigInt(d.ondelta),
  offdelta: BigInt(d.offdelta),
  leftCreditLimit: BigInt(d.leftCreditLimit),
  rightCreditLimit: BigInt(d.rightCreditLimit)
})

// Serialize multi-asset channel
export const serializeMultiAssetChannel = (ch: MultiAssetChannel): SerializedMultiAssetChannel => ({
  participants: [...ch.participants],
  deltas: ch.deltas.map(serializeDelta),
  nonce: ch.nonce.toString(),
  signatures: ch.signatures.map(sig => sig ?? null)
})

// Deserialize multi-asset channel
export const deserializeMultiAssetChannel = (data: SerializedMultiAssetChannel): MultiAssetChannel => ({
  participants: [data.participants[0] as `0x${string}`, data.participants[1] as `0x${string}`],
  deltas: data.deltas.map(deserializeDelta),
  nonce: BigInt(data.nonce),
  signatures: [
    data.signatures[0] ? data.signatures[0] as `0x${string}` : undefined,
    data.signatures[1] ? data.signatures[1] as `0x${string}` : undefined
  ]
})

// Channel state container - for saving multiple channels
export interface ChannelState {
  readonly version: string
  readonly timestamp: number
  readonly channels: readonly SerializedChannel[]
  readonly multiAssetChannels: readonly SerializedMultiAssetChannel[]
}

// Create state container
export const createStateContainer = (
  channels: readonly Channel[],
  multiAssetChannels: readonly MultiAssetChannel[]
): ChannelState => ({
  version: '1.0.0',
  timestamp: Date.now(),
  channels: channels.map(serializeChannel),
  multiAssetChannels: multiAssetChannels.map(serializeMultiAssetChannel)
})

// Load state from container
export const loadStateContainer = (state: ChannelState): {
  channels: Channel[]
  multiAssetChannels: MultiAssetChannel[]
} => ({
  channels: state.channels.map(deserializeChannel),
  multiAssetChannels: state.multiAssetChannels.map(deserializeMultiAssetChannel)
})

// JSON string operations
export const toJSON = (state: ChannelState): string => 
  JSON.stringify(state, null, 2)

export const fromJSON = (json: string): ChannelState => 
  JSON.parse(json) as ChannelState

// Validation helpers
export const isValidChannelState = (data: unknown): data is ChannelState => {
  if (!data || typeof data !== 'object') return false
  const state = data as any
  
  return (
    typeof state.version === 'string' &&
    typeof state.timestamp === 'number' &&
    Array.isArray(state.channels) &&
    Array.isArray(state.multiAssetChannels)
  )
}