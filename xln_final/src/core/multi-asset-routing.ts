// Multi-asset routing with HTLCs
// Atomic multi-hop payments for any asset

import type { Address } from './channels.js'
import type { MultiAssetChannel, AssetId, AssetPayment } from './multi-asset-channels.js'
import { payAsset } from './multi-asset-channels.js'
import { htlc as createHTLC, hashlock, type HTLC } from './htlc.js'

export interface AssetRoute {
  readonly path: Address[]
  readonly amount: bigint
  readonly tokenId: AssetId
  readonly finalRecipient: Address
}

export interface AssetRoutedPayment {
  readonly route: AssetRoute
  readonly htlcs: HTLC[]
  readonly secret: string
  readonly hashlock: string
}

// Find path for specific asset
export const findAssetPath = (
  channels: MultiAssetChannel[],
  from: Address,
  to: Address,
  amount: bigint,
  tokenId: AssetId
): Address[] | null => {
  // Check if we can pay directly
  const direct = channels.find(ch =>
    ch.participants.includes(from) && ch.participants.includes(to)
  )
  
  if (direct) {
    // Check if this asset exists and has sufficient limits
    const delta = direct.deltas.find(d => d.tokenId === tokenId)
    if (delta) {
      const fromIdx = direct.participants.indexOf(from)
      const shift = fromIdx === 0 ? amount : -amount
      const newBalance = delta.offdelta + shift
      
      // Check credit limits for this asset
      const withinLimits = 
        (newBalance <= 0 || newBalance <= delta.rightCreditLimit) &&
        (newBalance >= 0 || -newBalance <= delta.leftCreditLimit)
      
      if (withinLimits) return [from, to]
    }
  }
  
  // Try one-hop paths
  for (const ch1 of channels) {
    if (!ch1.participants.includes(from)) continue
    const hub = ch1.participants.find(p => p !== from)
    if (!hub) continue
    
    // Check if hub has channels with sufficient limits for this asset
    const ch2 = channels.find(ch =>
      ch.participants.includes(hub) && ch.participants.includes(to)
    )
    
    if (ch2) {
      // Verify both channels support this asset with sufficient limits
      const delta1 = ch1.deltas.find(d => d.tokenId === tokenId)
      const delta2 = ch2.deltas.find(d => d.tokenId === tokenId)
      
      if (delta1 && delta2) {
        // Simulate payments to check limits
        const payment1: AssetPayment = { from, to: hub, amount, tokenId }
        const payment2: AssetPayment = { from: hub, to, amount, tokenId }
        
        if (canPayInChannel(ch1, payment1) && canPayInChannel(ch2, payment2)) {
          return [from, hub, to]
        }
      }
    }
  }
  
  return null
}

// Helper to check if payment possible in channel
const canPayInChannel = (ch: MultiAssetChannel, p: AssetPayment): boolean => {
  const fromIdx = ch.participants.indexOf(p.from)
  const toIdx = ch.participants.indexOf(p.to)
  if (fromIdx === -1 || toIdx === -1) return false
  
  const delta = ch.deltas.find(d => d.tokenId === p.tokenId)
  if (!delta) return false
  
  const shift = fromIdx === 0 ? p.amount : -p.amount
  const newBalance = delta.offdelta + shift
  
  return (newBalance <= 0 || newBalance <= delta.rightCreditLimit) &&
         (newBalance >= 0 || -newBalance <= delta.leftCreditLimit)
}

// Create atomic multi-asset routed payment
export const createAssetRoutedPayment = (
  path: Address[],
  amount: bigint,
  tokenId: AssetId,
  secret: string,
  timeoutSeconds = 3600
): AssetRoutedPayment => {
  const hash = hashlock(secret)
  const htlcs: HTLC[] = []
  
  // Create HTLCs for each hop
  for (let i = 0; i < path.length - 1; i++) {
    const hopTimeout = timeoutSeconds - (i * 600) // 10 min less per hop
    htlcs.push(createHTLC(
      path[i],
      path[i + 1],
      amount,
      hash,
      hopTimeout
    ))
  }
  
  return {
    route: {
      path,
      amount,
      tokenId,
      finalRecipient: path[path.length - 1]
    },
    htlcs,
    secret,
    hashlock: hash
  }
}

// Execute multi-asset routed payment
export const executeAssetRoute = (
  channels: MultiAssetChannel[],
  payment: AssetRoutedPayment
): { channels: MultiAssetChannel[], htlcs: HTLC[] } | null => {
  const updatedChannels = [...channels]
  const { path, amount, tokenId } = payment.route
  
  // Lock payments in each channel for the specific asset
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]
    const to = path[i + 1]
    
    const chIdx = updatedChannels.findIndex(ch =>
      ch.participants.includes(from) && ch.participants.includes(to)
    )
    if (chIdx === -1) return null
    
    const updated = payAsset(updatedChannels[chIdx], {
      from,
      to,
      amount,
      tokenId
    })
    if (!updated) return null
    
    updatedChannels[chIdx] = updated
  }
  
  return { 
    channels: updatedChannels, 
    htlcs: payment.htlcs 
  }
}