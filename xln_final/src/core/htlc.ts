// HTLCs - Hash Time Locked Contracts for atomic routing
// Core mechanism: lock payment with hash, unlock with secret

import { ethers } from 'ethers'
import type { Address, Hash } from './channels.js'

export interface HTLC {
  readonly from: Address
  readonly to: Address
  readonly amount: bigint
  readonly hashlock: Hash      // Hash of the secret
  readonly timelock: number    // Unix timestamp for timeout
  readonly settled: boolean    // Has been claimed with secret
}

// Create hashlock from secret
export const hashlock = (secret: string): Hash => 
  ethers.keccak256(ethers.toUtf8Bytes(secret)) as Hash

// Create HTLC
export const htlc = (
  from: Address,
  to: Address,
  amount: bigint,
  hash: Hash,
  timeoutSeconds = 3600  // 1 hour default
): HTLC => ({
  from,
  to,
  amount,
  hashlock: hash,
  timelock: Math.floor(Date.now() / 1000) + timeoutSeconds,
  settled: false
})

// Verify secret matches hashlock
export const verifySecret = (h: HTLC, secret: string): boolean =>
  hashlock(secret) === h.hashlock

// Check if HTLC expired
export const isExpired = (h: HTLC): boolean =>
  Math.floor(Date.now() / 1000) > h.timelock

// Settle HTLC with secret
export const settle = (h: HTLC, secret: string): HTLC | null => {
  if (h.settled) return null  // Already settled
  if (isExpired(h)) return null  // Too late
  if (!verifySecret(h, secret)) return null  // Wrong secret
  
  return { ...h, settled: true }
}

// Refund expired HTLC
export const refund = (h: HTLC): HTLC | null => {
  if (h.settled) return null  // Can't refund if settled
  if (!isExpired(h)) return null  // Not expired yet
  
  return { ...h, settled: true }  // Mark as settled (refunded)
}