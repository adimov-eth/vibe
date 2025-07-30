#!/usr/bin/env bun
// Demo: Multi-chain support and cross-chain atomic swaps

import type { CrossChainChannel } from './core/multi-chain'
import {
  createCrossChainChannel,
  setCreditLimits,
  createCrossChainSwap,
  canPerformSwap,
  getChainStats,
  getTotalValueLocked,
  SUPPORTED_CHAINS
} from './core/multi-chain'
import { wallet, address } from './core/crypto'

// Demo: Basic multi-chain channel setup
const demoMultiChainSetup = () => {
  console.log('\n=== Multi-Chain Channel Setup ===')
  
  const alice = address(wallet('alice'))
  const bob = address(wallet('bob'))
  
  // Create channel supporting Ethereum and Polygon
  const chains = SUPPORTED_CHAINS.filter(c => 
    c.chainId === 1 || c.chainId === 137
  )
  
  let channel = createCrossChainChannel(alice, bob, chains)
  
  // Set credit limits on each chain
  channel = setCreditLimits(channel, 1, 1000n, 500n) // ETH: Alice 1000, Bob 500
  channel = setCreditLimits(channel, 137, 5000n, 3000n) // MATIC: Alice 5000, Bob 3000
  
  console.log('Created multi-chain channel:')
  console.log(`Participants: ${alice.slice(0, 8)}... ↔ ${bob.slice(0, 8)}...`)
  console.log('\nSupported chains:')
  
  for (const chain of channel.chains) {
    const stats = getChainStats(channel, chain.chainId)
    console.log(`\n${chain.name} (Chain ${chain.chainId}):`)
    console.log(`  - Native: ${chain.nativeCurrency}`)
    console.log(`  - Left credit: ${stats.leftCredit}`)
    console.log(`  - Right credit: ${stats.rightCredit}`)
  }
}

// Demo: Cross-chain atomic swap
const demoCrossChainSwap = () => {
  console.log('\n=== Cross-Chain Atomic Swap ===')
  
  const alice = address(wallet('alice'))
  const bob = address(wallet('bob'))
  
  const chains = SUPPORTED_CHAINS.filter(c => 
    c.chainId === 1 || c.chainId === 137
  )
  
  let channel = createCrossChainChannel(alice, bob, chains)
  channel = setCreditLimits(channel, 1, 1000n, 500n)
  channel = setCreditLimits(channel, 137, 5000n, 3000n)
  
  // Alice wants to swap 0.1 ETH for MATIC at 2000 MATIC/ETH rate
  const ethAmount = 100n // 0.1 ETH in smallest units (simplified)
  const exchangeRate = 2000n * 1000000000000000000n // 2000 MATIC per ETH
  
  console.log('Swap parameters:')
  console.log(`- From: Ethereum (${ethAmount} wei)`)
  console.log(`- To: Polygon`)
  console.log(`- Rate: 2000 MATIC/ETH`)
  
  // Check if swap is possible
  const canSwap = canPerformSwap(channel, alice, 1, ethAmount)
  console.log(`\nCan perform swap: ${canSwap}`)
  
  if (canSwap) {
    // Create the swap
    channel = createCrossChainSwap(
      channel,
      alice,
      bob,
      1, // Ethereum
      137, // Polygon
      ethAmount,
      exchangeRate,
      'secret123'
    )
    
    console.log('\nSwap created with HTLCs!')
    console.log(`Active HTLCs: ${channel.htlcs.length}`)
    
    // Show updated balances
    console.log('\nUpdated balances:')
    const ethStats = getChainStats(channel, 1)
    const maticStats = getChainStats(channel, 137)
    
    console.log(`- Ethereum: ${ethStats.balance} (${ethStats.pendingHTLCs} pending HTLCs)`)
    console.log(`- Polygon: ${maticStats.balance} (${maticStats.pendingHTLCs} pending HTLCs)`)
  }
}

// Demo: Multi-chain liquidity management
const demoMultiChainLiquidity = () => {
  console.log('\n=== Multi-Chain Liquidity Management ===')
  
  const alice = address(wallet('alice'))
  const bob = address(wallet('bob'))
  
  // Create channel supporting all 4 chains
  let channel = createCrossChainChannel(alice, bob, SUPPORTED_CHAINS)
  
  // Set different credit limits per chain based on risk/liquidity
  channel = setCreditLimits(channel, 1, 10000n, 10000n)    // ETH: High trust
  channel = setCreditLimits(channel, 137, 50000n, 50000n)  // Polygon: High volume
  channel = setCreditLimits(channel, 56, 20000n, 20000n)   // BSC: Medium trust
  channel = setCreditLimits(channel, 43114, 5000n, 5000n)  // AVAX: Lower limits
  
  // Simulate some swaps
  const swaps = [
    { from: 1, to: 137, amount: 100n, rate: 2000n },
    { from: 137, to: 56, amount: 1000n, rate: 5n },
    { from: 56, to: 43114, amount: 50n, rate: 20n },
    { from: 43114, to: 1, amount: 200n, rate: 50n }
  ]
  
  for (const swap of swaps) {
    if (canPerformSwap(channel, alice, swap.from, swap.amount)) {
      channel = createCrossChainSwap(
        channel,
        alice,
        bob,
        swap.from,
        swap.to,
        swap.amount,
        swap.rate * 1000000000000000000n,
        `secret${swap.from}-${swap.to}`
      )
    }
  }
  
  console.log('Multi-chain liquidity status:')
  console.log(`Total swaps performed: ${channel.htlcs.length / 2}`)
  
  // Show TVL across chains
  const tvl = getTotalValueLocked(channel)
  console.log('\nTotal Value Locked per chain:')
  
  for (const chain of SUPPORTED_CHAINS) {
    const locked = tvl[chain.chainId] || 0n
    const stats = getChainStats(channel, chain.chainId)
    console.log(`\n${chain.name}:`)
    console.log(`  - Balance: ${stats.balance}`)
    console.log(`  - Collateral: ${stats.collateral}`)
    console.log(`  - TVL: ${locked}`)
    console.log(`  - Pending HTLCs: ${stats.pendingHTLCs}`)
  }
}

// Demo: Chain-specific risk management
const demoChainRiskManagement = () => {
  console.log('\n=== Chain-Specific Risk Management ===')
  
  const alice = address(wallet('alice'))
  const bob = address(wallet('bob'))
  
  let channel = createCrossChainChannel(alice, bob, SUPPORTED_CHAINS)
  
  // Set credit limits based on chain characteristics
  console.log('Setting risk-adjusted credit limits:')
  
  for (const chain of SUPPORTED_CHAINS) {
    // Calculate limits based on block time (faster = higher limits)
    const speedMultiplier = 12n / BigInt(chain.blockTime) // ETH baseline
    const baseLimit = 1000n
    const limit = baseLimit * speedMultiplier
    
    channel = setCreditLimits(channel, chain.chainId, limit, limit)
    
    console.log(`\n${chain.name}:`)
    console.log(`  - Block time: ${chain.blockTime}s`)
    console.log(`  - Speed multiplier: ${speedMultiplier}x`)
    console.log(`  - Credit limit: ${limit}`)
  }
  
  // Show risk metrics
  console.log('\n\nRisk-adjusted capacity:')
  
  for (const chain of SUPPORTED_CHAINS) {
    const stats = getChainStats(channel, chain.chainId)
    const totalCapacity = stats.leftCredit + stats.rightCredit
    const utilizationRate = stats.balance === 0n ? 0 : 
      (stats.balance * 100n) / totalCapacity
    
    console.log(`${chain.name}: ${totalCapacity} capacity (${utilizationRate}% utilized)`)
  }
}

// Run all demos
const main = () => {
  console.log('XLN Multi-Chain Support Demo')
  console.log('============================')
  
  demoMultiChainSetup()
  demoCrossChainSwap()
  demoMultiChainLiquidity()
  demoChainRiskManagement()
  
  console.log('\n\n✓ Multi-chain support enables:')
  console.log('  - Cross-chain atomic swaps without bridges')
  console.log('  - Chain-specific credit limits and risk management')
  console.log('  - Unified liquidity across multiple blockchains')
  console.log('  - Efficient capital allocation based on chain properties')
  console.log('  - True interoperability through payment channels')
}

main()