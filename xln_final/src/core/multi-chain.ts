// Multi-chain support for cross-chain atomic swaps
// Enables seamless value transfer across different blockchains

import type { Address, Hash } from './crypto'
import type { HTLC } from './htlc'
import { htlc as createHTLC, settle as settleHTLC, hashlock } from './htlc'

export interface ChainConfig {
  readonly chainId: number
  readonly name: string
  readonly rpcUrl: string
  readonly blockTime: number // seconds
  readonly nativeCurrency: string
  readonly explorerUrl: string
}

export interface CrossChainChannel {
  readonly participants: readonly [Address, Address]
  readonly chains: readonly ChainConfig[]
  readonly balances: Record<number, bigint> // chainId -> balance
  readonly creditLimits: Record<number, { left: bigint; right: bigint }>
  readonly collateral: Record<number, bigint> // chainId -> collateral
  readonly nonce: bigint
  readonly htlcs: readonly CrossChainHTLC[]
}

export interface CrossChainHTLC extends HTLC {
  readonly sourceChain: number
  readonly targetChain: number
  readonly tokenAddress?: Address // Optional: native currency if not provided
  readonly exchangeRate: bigint // Fixed-point (1e18 = 1.0)
}

// Supported chains configuration
export const SUPPORTED_CHAINS: readonly ChainConfig[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    blockTime: 12,
    nativeCurrency: 'ETH',
    explorerUrl: 'https://etherscan.io'
  },
  {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    blockTime: 2,
    nativeCurrency: 'MATIC',
    explorerUrl: 'https://polygonscan.com'
  },
  {
    chainId: 56,
    name: 'BSC',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockTime: 3,
    nativeCurrency: 'BNB',
    explorerUrl: 'https://bscscan.com'
  },
  {
    chainId: 43114,
    name: 'Avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockTime: 2,
    nativeCurrency: 'AVAX',
    explorerUrl: 'https://snowtrace.io'
  }
]

// Create a cross-chain channel
export const createCrossChainChannel = (
  participant1: Address,
  participant2: Address,
  chains: readonly ChainConfig[]
): CrossChainChannel => {
  const balances: Record<number, bigint> = {}
  const creditLimits: Record<number, { left: bigint; right: bigint }> = {}
  const collateral: Record<number, bigint> = {}

  // Initialize for each chain
  for (const chain of chains) {
    balances[chain.chainId] = 0n
    creditLimits[chain.chainId] = { left: 0n, right: 0n }
    collateral[chain.chainId] = 0n
  }

  return {
    participants: [participant1, participant2],
    chains,
    balances,
    creditLimits,
    collateral,
    nonce: 0n,
    htlcs: []
  }
}

// Set credit limits for a specific chain
export const setCreditLimits = (
  channel: CrossChainChannel,
  chainId: number,
  leftLimit: bigint,
  rightLimit: bigint
): CrossChainChannel => {
  if (!channel.chains.find(c => c.chainId === chainId)) {
    throw new Error(`Chain ${chainId} not supported in this channel`)
  }

  return {
    ...channel,
    creditLimits: {
      ...channel.creditLimits,
      [chainId]: { left: leftLimit, right: rightLimit }
    }
  }
}

// Create cross-chain swap using HTLCs
export const createCrossChainSwap = (
  channel: CrossChainChannel,
  from: Address,
  to: Address,
  sourceChain: number,
  targetChain: number,
  sourceAmount: bigint,
  exchangeRate: bigint, // 1e18 = 1.0
  secret: string
): CrossChainChannel => {
  // Validate chains
  if (!channel.chains.find(c => c.chainId === sourceChain)) {
    throw new Error(`Source chain ${sourceChain} not supported`)
  }
  if (!channel.chains.find(c => c.chainId === targetChain)) {
    throw new Error(`Target chain ${targetChain} not supported`)
  }

  // Calculate target amount
  const targetAmount = (sourceAmount * exchangeRate) / 1000000000000000000n

  // Create HTLCs for both chains
  const hash = hashlock(secret)
  const baseHTLC = createHTLC(from, to, sourceAmount, hash)
  
  const sourceHTLC: CrossChainHTLC = {
    ...baseHTLC,
    sourceChain,
    targetChain,
    amount: sourceAmount,
    exchangeRate
  }

  const targetHTLC: CrossChainHTLC = {
    ...baseHTLC,
    sourceChain: targetChain,
    targetChain: sourceChain,
    from: to,
    to: from,
    amount: targetAmount,
    exchangeRate
  }

  // Update balances atomically
  const newBalances = { ...channel.balances }
  const [leftParticipant] = channel.participants
  const isLeftParty = from === leftParticipant

  // Deduct from source chain
  newBalances[sourceChain] += isLeftParty ? -sourceAmount : sourceAmount
  // Add to target chain (opposite direction)
  newBalances[targetChain] += isLeftParty ? targetAmount : -targetAmount

  return {
    ...channel,
    balances: newBalances,
    htlcs: [...channel.htlcs, sourceHTLC, targetHTLC],
    nonce: channel.nonce + 1n
  }
}

// Check if swap can be performed
export const canPerformSwap = (
  channel: CrossChainChannel,
  participant: Address,
  sourceChain: number,
  amount: bigint
): boolean => {
  const [leftParticipant] = channel.participants
  const isLeft = participant === leftParticipant
  const balance = channel.balances[sourceChain] || 0n
  const limits = channel.creditLimits[sourceChain]
  
  if (!limits) return false

  const availableCredit = isLeft
    ? balance + limits.left
    : -balance + limits.right

  return amount <= availableCredit
}

// Get chain statistics
export const getChainStats = (
  channel: CrossChainChannel,
  chainId: number
): {
  balance: bigint
  collateral: bigint
  leftCredit: bigint
  rightCredit: bigint
  pendingHTLCs: number
} => {
  const balance = channel.balances[chainId] || 0n
  const collateral = channel.collateral[chainId] || 0n
  const limits = channel.creditLimits[chainId] || { left: 0n, right: 0n }
  const pendingHTLCs = channel.htlcs.filter(
    h => !h.settled && (h.sourceChain === chainId || h.targetChain === chainId)
  ).length

  return {
    balance,
    collateral,
    leftCredit: limits.left,
    rightCredit: limits.right,
    pendingHTLCs
  }
}

// Calculate total value locked across all chains
export const getTotalValueLocked = (
  channel: CrossChainChannel
): Record<number, bigint> => {
  const tvl: Record<number, bigint> = {}
  
  for (const chain of channel.chains) {
    const collateral = channel.collateral[chain.chainId] || 0n
    const pendingHTLCs = channel.htlcs
      .filter(h => !h.settled && h.sourceChain === chain.chainId)
      .reduce((sum, h) => sum + h.amount, 0n)
    
    tvl[chain.chainId] = collateral + pendingHTLCs
  }
  
  return tvl
}

// Export types
export type { CrossChainChannel, CrossChainHTLC }