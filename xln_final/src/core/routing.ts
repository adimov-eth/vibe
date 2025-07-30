// Multi-hop routing with HTLCs and onion privacy
// Enables atomic payments across multiple channels with route privacy

import type { Channel, Address, Payment } from './channels.js'
import { pay } from './channels.js'
import { htlc as createHTLC, hashlock, type HTLC } from './htlc.js'
import { createOnionPacket, type OnionPacket } from './onion.js'

export interface Route {
  readonly path: Address[]
  readonly amount: bigint
  readonly finalRecipient: Address
}

export interface RoutedPayment {
  readonly route: Route
  readonly htlcs: HTLC[]
  readonly secret: string
  readonly hashlock: string
  readonly onionPacket?: OnionPacket  // Optional for backward compatibility
}

// Find path through network (simplified - just checks direct or 1-hop)
export const findPath = (
  channels: Channel[],
  from: Address,
  to: Address,
  amount: bigint
): Address[] | null => {
  // Direct path?
  const direct = channels.find(ch =>
    ch.participants.includes(from) && ch.participants.includes(to)
  )
  if (direct) return [from, to]
  
  // One-hop path?
  for (const ch1 of channels) {
    if (!ch1.participants.includes(from)) continue
    const hub = ch1.participants.find(p => p !== from)
    if (!hub) continue
    
    const ch2 = channels.find(ch =>
      ch.participants.includes(hub) && ch.participants.includes(to)
    )
    if (ch2) return [from, hub, to]
  }
  
  return null
}

// Create atomic routed payment
export const createRoutedPayment = (
  path: Address[],
  amount: bigint,
  secret: string,
  timeoutSeconds = 3600
): RoutedPayment => {
  const hash = hashlock(secret)
  const htlcs: HTLC[] = []
  
  // Create HTLCs for each hop with decreasing timeouts
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
      finalRecipient: path[path.length - 1]
    },
    htlcs,
    secret,
    hashlock: hash
  }
}

// Create private routed payment with onion routing
export const createPrivateRoutedPayment = async (
  path: Address[],
  amount: bigint,
  secret: string,
  getPublicKey: (addr: Address) => Promise<string>,
  timeoutSeconds = 3600
): Promise<RoutedPayment> => {
  const hash = hashlock(secret)
  const htlcs: HTLC[] = []
  
  // Create HTLCs for each hop with decreasing timeouts
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
  
  // Create onion packet for privacy
  const onionPacket = await createOnionPacket(
    path,
    amount,
    secret,
    getPublicKey
  )
  
  return {
    route: {
      path,
      amount,
      finalRecipient: path[path.length - 1]
    },
    htlcs,
    secret,
    hashlock: hash,
    onionPacket
  }
}

// Execute routed payment atomically
export const executeRoute = (
  channels: Channel[],
  payment: RoutedPayment
): { channels: Channel[], htlcs: HTLC[] } | null => {
  const updatedChannels = [...channels]
  const { path } = payment.route
  
  // Lock payments in each channel
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]
    const to = path[i + 1]
    
    const chIdx = updatedChannels.findIndex(ch =>
      ch.participants.includes(from) && ch.participants.includes(to)
    )
    if (chIdx === -1) return null
    
    const updated = pay(updatedChannels[chIdx], {
      from,
      to,
      amount: payment.route.amount
    })
    if (!updated) return null
    
    updatedChannels[chIdx] = updated
  }
  
  return { 
    channels: updatedChannels, 
    htlcs: payment.htlcs 
  }
}