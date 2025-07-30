// XLN Write-Ahead Logging - Crash recovery through operation journaling
// Pure functions for WAL operations, actual file I/O handled by caller

import type { Channel } from '../core/channels.js'
import type { MultiAssetChannel } from '../core/multi-asset-channels.js'
import type { Payment } from '../core/channels.js'
import type { AssetPayment } from '../core/multi-asset-channels.js'
import { serializeChannel, serializeMultiAssetChannel } from './storage.js'

// WAL operation types
export type WalOpType = 
  | 'CREATE_CHANNEL'
  | 'PAY'
  | 'SIGN'
  | 'CREATE_MULTI_ASSET_CHANNEL'
  | 'PAY_ASSET'
  | 'SIGN_MULTI_ASSET'
  | 'CHECKPOINT'

// WAL entry structure
export interface WalEntry {
  readonly id: string                    // Unique operation ID
  readonly timestamp: number             // When operation occurred
  readonly type: WalOpType              // Operation type
  readonly data: unknown                // Operation-specific data
  readonly checksum?: string            // Optional integrity check
}

// Operation-specific data types
export interface CreateChannelOp {
  readonly channelId: string
  readonly participants: readonly string[]
  readonly leftCreditLimit: string
  readonly rightCreditLimit: string
  readonly collateral: string
}

export interface PayOp {
  readonly channelId: string
  readonly payment: {
    readonly from: string
    readonly to: string
    readonly amount: string
  }
  readonly beforeNonce: string
  readonly afterNonce: string
}

export interface SignOp {
  readonly channelId: string
  readonly signer: string
  readonly signature: string
  readonly nonce: string
}

export interface CreateMultiAssetChannelOp {
  readonly channelId: string
  readonly participants: readonly string[]
  readonly assetLimits: readonly {
    readonly tokenId: number
    readonly leftCreditLimit: string
    readonly rightCreditLimit: string
    readonly collateral?: string
  }[]
}

export interface PayAssetOp {
  readonly channelId: string
  readonly payment: {
    readonly from: string
    readonly to: string
    readonly amount: string
    readonly tokenId: number
  }
  readonly beforeNonce: string
  readonly afterNonce: string
}

// Generate unique operation ID
const generateId = (): string => 
  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

// Channel ID from participants (matches core logic)
const channelId = (participants: readonly string[]): string =>
  `${participants[0]}-${participants[1]}`

// Create WAL entries for operations

export const walCreateChannel = (
  channel: Channel
): WalEntry => ({
  id: generateId(),
  timestamp: Date.now(),
  type: 'CREATE_CHANNEL',
  data: {
    channelId: channelId(channel.participants),
    participants: [...channel.participants],
    leftCreditLimit: channel.leftCreditLimit.toString(),
    rightCreditLimit: channel.rightCreditLimit.toString(),
    collateral: channel.collateral.toString()
  } satisfies CreateChannelOp
})

export const walPay = (
  channelBefore: Channel,
  channelAfter: Channel,
  payment: Payment
): WalEntry => ({
  id: generateId(),
  timestamp: Date.now(),
  type: 'PAY',
  data: {
    channelId: channelId(channelBefore.participants),
    payment: {
      from: payment.from,
      to: payment.to,
      amount: payment.amount.toString()
    },
    beforeNonce: channelBefore.nonce.toString(),
    afterNonce: channelAfter.nonce.toString()
  } satisfies PayOp
})

export const walSign = (
  channel: Channel,
  signerAddress: string,
  signature: string
): WalEntry => ({
  id: generateId(),
  timestamp: Date.now(),
  type: 'SIGN',
  data: {
    channelId: channelId(channel.participants),
    signer: signerAddress,
    signature,
    nonce: channel.nonce.toString()
  } satisfies SignOp
})

export const walCreateMultiAssetChannel = (
  channel: MultiAssetChannel
): WalEntry => ({
  id: generateId(),
  timestamp: Date.now(),
  type: 'CREATE_MULTI_ASSET_CHANNEL',
  data: {
    channelId: channelId(channel.participants),
    participants: [...channel.participants],
    assetLimits: channel.deltas.map(d => ({
      tokenId: d.tokenId,
      leftCreditLimit: d.leftCreditLimit.toString(),
      rightCreditLimit: d.rightCreditLimit.toString(),
      collateral: d.collateral.toString()
    }))
  } satisfies CreateMultiAssetChannelOp
})

export const walPayAsset = (
  channelBefore: MultiAssetChannel,
  channelAfter: MultiAssetChannel,
  payment: AssetPayment
): WalEntry => ({
  id: generateId(),
  timestamp: Date.now(),
  type: 'PAY_ASSET',
  data: {
    channelId: channelId(channelBefore.participants),
    payment: {
      from: payment.from,
      to: payment.to,
      amount: payment.amount.toString(),
      tokenId: payment.tokenId
    },
    beforeNonce: channelBefore.nonce.toString(),
    afterNonce: channelAfter.nonce.toString()
  } satisfies PayAssetOp
})

export const walCheckpoint = (
  channels: readonly Channel[],
  multiAssetChannels: readonly MultiAssetChannel[]
): WalEntry => ({
  id: generateId(),
  timestamp: Date.now(),
  type: 'CHECKPOINT',
  data: {
    channels: channels.map(serializeChannel),
    multiAssetChannels: multiAssetChannels.map(serializeMultiAssetChannel)
  }
})

// WAL file format
export interface WalFile {
  readonly version: string
  readonly created: number
  readonly entries: readonly WalEntry[]
}

// Create new WAL file
export const createWalFile = (): WalFile => ({
  version: '1.0.0',
  created: Date.now(),
  entries: []
})

// Append entry to WAL
export const appendEntry = (
  wal: WalFile,
  entry: WalEntry
): WalFile => ({
  ...wal,
  entries: [...wal.entries, entry]
})

// Compact WAL by removing entries before checkpoint
export const compactWal = (wal: WalFile): WalFile => {
  const lastCheckpointIdx = wal.entries.findLastIndex(e => e.type === 'CHECKPOINT')
  if (lastCheckpointIdx === -1) return wal
  
  return {
    ...wal,
    entries: wal.entries.slice(lastCheckpointIdx)
  }
}

// Find entries after timestamp
export const entriesAfter = (
  wal: WalFile,
  timestamp: number
): readonly WalEntry[] =>
  wal.entries.filter(e => e.timestamp > timestamp)

// Find entries for specific channel
export const entriesForChannel = (
  wal: WalFile,
  channelId: string
): readonly WalEntry[] =>
  wal.entries.filter(e => {
    const data = e.data as any
    return data.channelId === channelId
  })

// Validate WAL file structure
export const isValidWalFile = (data: unknown): data is WalFile => {
  if (!data || typeof data !== 'object') return false
  const wal = data as any
  
  return (
    typeof wal.version === 'string' &&
    typeof wal.created === 'number' &&
    Array.isArray(wal.entries) &&
    wal.entries.every((e: any) =>
      typeof e.id === 'string' &&
      typeof e.timestamp === 'number' &&
      typeof e.type === 'string' &&
      e.data !== undefined
    )
  )
}

// JSON operations
export const walToJSON = (wal: WalFile): string =>
  JSON.stringify(wal, null, 2)

export const walFromJSON = (json: string): WalFile => {
  const data = JSON.parse(json)
  if (!isValidWalFile(data)) {
    throw new Error('Invalid WAL file format')
  }
  return data
}