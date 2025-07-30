// Multi-Asset XLN Channels - Trust varies by asset
// You trust someone for $5k USDT but only $1k BTC

import { ethers } from 'ethers'
import type { Address, Signature, Hash } from './channels.js'

// Asset types
export const ASSETS = {
  USDT: 0,
  ETH: 1,
  BTC: 2,
  USDC: 3
} as const

export type AssetId = typeof ASSETS[keyof typeof ASSETS]

// Per-asset state tracking
export interface Delta {
  readonly tokenId: AssetId
  readonly collateral: bigint          // On-chain backing for this asset
  readonly ondelta: bigint             // On-chain balance
  readonly offdelta: bigint            // Off-chain balance 
  readonly leftCreditLimit: bigint     // How much left can owe in this asset
  readonly rightCreditLimit: bigint    // How much right can owe in this asset
}

// Multi-asset channel
export interface MultiAssetChannel {
  readonly participants: readonly [Address, Address]
  readonly deltas: readonly Delta[]    // One per asset
  readonly nonce: bigint
  readonly signatures: readonly [Signature?, Signature?]
}

// Multi-asset payment
export interface AssetPayment {
  readonly from: Address
  readonly to: Address
  readonly amount: bigint
  readonly tokenId: AssetId
}

// Create empty delta for an asset
const createDelta = (
  tokenId: AssetId,
  leftCreditLimit = 0n,
  rightCreditLimit = 0n,
  collateral = 0n
): Delta => ({
  tokenId,
  collateral,
  ondelta: 0n,
  offdelta: 0n,
  leftCreditLimit,
  rightCreditLimit
})

// Create multi-asset channel
export const multiAssetChannel = (
  alice: Address,
  bob: Address,
  assetLimits?: Array<{
    tokenId: AssetId
    leftCreditLimit: bigint
    rightCreditLimit: bigint
    collateral?: bigint
  }>
): MultiAssetChannel => {
  // Default: USDT with symmetric 1000 limits
  const deltas = assetLimits?.map(limit =>
    createDelta(
      limit.tokenId,
      limit.leftCreditLimit,
      limit.rightCreditLimit,
      limit.collateral ?? 0n
    )
  ) ?? [createDelta(ASSETS.USDT, 1000n, 1000n)]
  
  return {
    participants: [alice, bob],
    deltas,
    nonce: 0n,
    signatures: [undefined, undefined]
  }
}

// Get net balance for a specific asset
const getBalance = (ch: MultiAssetChannel, tokenId: AssetId): bigint => {
  const delta = ch.deltas.find(d => d.tokenId === tokenId)
  if (!delta) return 0n
  return delta.offdelta
}

// Check if payment possible for specific asset
export const canPayAsset = (ch: MultiAssetChannel, p: AssetPayment): boolean => {
  const fromIdx = ch.participants.indexOf(p.from)
  const toIdx = ch.participants.indexOf(p.to)
  if (fromIdx === -1 || toIdx === -1) return false
  
  const delta = ch.deltas.find(d => d.tokenId === p.tokenId)
  if (!delta) return false
  
  const shift = fromIdx === 0 ? p.amount : -p.amount
  const newBalance = delta.offdelta + shift
  
  // Consider both credit limits AND on-chain collateral
  // Can go negative up to credit limit + own collateral
  const fromOndelta = fromIdx === 0 ? delta.ondelta : -delta.ondelta
  const toOndelta = fromIdx === 0 ? -delta.ondelta : delta.ondelta
  
  if (newBalance > 0) {
    // Right side owes left - check against right's limit + left's collateral
    const maxOwed = delta.rightCreditLimit + (fromOndelta > 0n ? fromOndelta : 0n)
    if (newBalance > maxOwed) return false
  } else if (newBalance < 0) {
    // Left side owes right - check against left's limit + right's collateral  
    const maxOwed = delta.leftCreditLimit + (toOndelta > 0n ? toOndelta : 0n)
    if (-newBalance > maxOwed) return false
  }
  
  return true
}

// Execute multi-asset payment
export const payAsset = (
  ch: MultiAssetChannel,
  p: AssetPayment
): MultiAssetChannel | null => {
  if (!canPayAsset(ch, p)) return null
  
  const fromIdx = ch.participants.indexOf(p.from)
  const shift = fromIdx === 0 ? p.amount : -p.amount
  
  // Update the specific asset's delta
  const newDeltas = ch.deltas.map(d =>
    d.tokenId === p.tokenId
      ? { ...d, offdelta: d.offdelta + shift }
      : d
  )
  
  return {
    ...ch,
    deltas: newDeltas,
    nonce: ch.nonce + 1n,
    signatures: [undefined, undefined]
  }
}

// Hash channel state for signatures
const stateHash = (ch: MultiAssetChannel): Hash => {
  // Include all deltas in hash
  const deltaData = ch.deltas.flatMap(d => [
    d.tokenId,
    d.collateral,
    d.ondelta,
    d.offdelta,
    d.leftCreditLimit,
    d.rightCreditLimit
  ])
  
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'uint256[]', 'uint256'],
      [ch.participants[0], ch.participants[1], deltaData, ch.nonce]
    )
  ) as Hash
}

// Sign multi-asset channel state  
export const signMultiAsset = async (
  w: ethers.Wallet,
  ch: MultiAssetChannel
): Promise<MultiAssetChannel> => {
  const idx = ch.participants.indexOf(w.address as Address)
  if (idx === -1) throw new Error('Signer not in channel')
  
  const sig = await w.signMessage(stateHash(ch)) as Signature
  const newSigs: [Signature?, Signature?] = [...ch.signatures]
  newSigs[idx] = sig
  
  return { ...ch, signatures: newSigs }
}

// Verify signatures
export const verifyMultiAsset = (ch: MultiAssetChannel): boolean =>
  ch.signatures.every((sig, idx) =>
    !sig || ethers.verifyMessage(stateHash(ch), sig) === ch.participants[idx]
  )

// Route multi-asset payment
export const routeAsset = (
  channels: MultiAssetChannel[],
  from: Address,
  to: Address,
  amount: bigint,
  tokenId: AssetId,
  hubs: Address[]
): { path: Address[]; channels: MultiAssetChannel[] } | null => {
  // Direct route
  const direct = channels.find(ch =>
    ch.participants.includes(from) && ch.participants.includes(to)
  )
  if (direct && canPayAsset(direct, { from, to, amount, tokenId })) {
    const updated = payAsset(direct, { from, to, amount, tokenId })
    if (updated) {
      const newChannels = [...channels]
      newChannels[channels.indexOf(direct)] = updated
      return { path: [from, to], channels: newChannels }
    }
  }
  
  // Hub route
  for (const hub of hubs) {
    const ch1 = channels.find(ch =>
      ch.participants.includes(from) && ch.participants.includes(hub)
    )
    const ch2 = channels.find(ch =>
      ch.participants.includes(hub) && ch.participants.includes(to)
    )
    
    if (ch1 && ch2 &&
        canPayAsset(ch1, { from, to: hub, amount, tokenId }) &&
        canPayAsset(ch2, { from: hub, to, amount, tokenId })) {
      
      const updated1 = payAsset(ch1, { from, to: hub, amount, tokenId })
      const updated2 = payAsset(ch2, { from: hub, to, amount, tokenId })
      
      if (updated1 && updated2) {
        const newChannels = [...channels]
        newChannels[channels.indexOf(ch1)] = updated1
        newChannels[channels.indexOf(ch2)] = updated2
        return { path: [from, hub, to], channels: newChannels }
      }
    }
  }
  
  return null
}