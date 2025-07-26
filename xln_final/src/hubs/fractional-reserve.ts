// Fractional-reserve hubs - ECONOMIC INNOVATION
// Hubs operate with 20% reserves vs 100% traditional Lightning
// This enables 80% capital efficiency improvement

import type { Address, CreditLineChannel, HubInfo } from '../types/channels.js'

const DEBUG = true

export interface FractionalReserveHub {
  readonly address: Address
  readonly totalLiquidity: bigint      // Total liquidity provided across all channels
  readonly reserves: bigint            // Actual funds held (20% of total exposure)
  readonly reserveRatio: number        // Target reserve ratio (e.g. 0.2 = 20%)
  readonly channels: Map<string, CreditLineChannel>
  readonly exposures: Map<Address, bigint>  // Net exposure to each participant
  readonly feeRate: bigint             // Fee in basis points (e.g. 10 = 0.1%)
  readonly riskParameters: {
    maxSingleExposure: bigint
    maxTotalExposure: bigint
    liquidityBuffer: number            // Extra buffer beyond reserve ratio
  }
}

/**
 * Create a fractional-reserve hub
 * INNOVATION: Operates with 20% reserves instead of 100% full funding
 */
export const createFractionalReserveHub = (
  address: Address,
  initialReserves: bigint,
  reserveRatio: number = 0.2  // 20% default
): FractionalReserveHub => {
  if (DEBUG) console.log(`🏦 Creating fractional-reserve hub: ${address}`)
  if (DEBUG) console.log(`   💰 Initial reserves: ${initialReserves}`)
  if (DEBUG) console.log(`   📊 Reserve ratio: ${(reserveRatio * 100).toFixed(1)}%`)

  const maxTotalExposure = initialReserves / BigInt(Math.floor(reserveRatio * 100)) * 100n

  const hub: FractionalReserveHub = {
    address,
    totalLiquidity: maxTotalExposure,
    reserves: initialReserves,
    reserveRatio,
    channels: new Map(),
    exposures: new Map(),
    feeRate: 10n, // 0.1% default fee
    riskParameters: {
      maxSingleExposure: maxTotalExposure / 10n, // Max 10% exposure to single party
      maxTotalExposure,
      liquidityBuffer: 0.05 // 5% extra buffer
    }
  }

  if (DEBUG) console.log(`   🎯 Max total exposure: ${maxTotalExposure} (${Number(maxTotalExposure / initialReserves)}x leverage)`)
  
  return hub
}

/**
 * Calculate capital efficiency improvement vs traditional Lightning
 */
export const calculateCapitalEfficiency = (hub: FractionalReserveHub) => {
  const traditionalRequired = hub.totalLiquidity  // Lightning requires 100% funding
  const fractionalRequired = hub.reserves         // XLN requires only reserves
  const improvement = Number(traditionalRequired) / Number(fractionalRequired)
  
  return {
    traditionalRequired,
    fractionalRequired,
    improvement,
    savingsPercent: ((improvement - 1) * 100).toFixed(1)
  }
}

/**
 * Check if hub can provide liquidity for a new channel
 */
export const canProvideLiquidity = (
  hub: FractionalReserveHub,
  requestedAmount: bigint,
  participantAddress: Address
): boolean => {
  // Check single exposure limit
  const currentExposure = hub.exposures.get(participantAddress) || 0n
  const newExposure = currentExposure + requestedAmount
  if (newExposure > hub.riskParameters.maxSingleExposure) {
    if (DEBUG) console.log(`   ❌ Single exposure limit exceeded: ${newExposure} > ${hub.riskParameters.maxSingleExposure}`)
    return false
  }

  // Check total exposure limit
  const totalCurrentExposure = Array.from(hub.exposures.values()).reduce((sum, exp) => sum + exp, 0n)
  const newTotalExposure = totalCurrentExposure + requestedAmount
  if (newTotalExposure > hub.riskParameters.maxTotalExposure) {
    if (DEBUG) console.log(`   ❌ Total exposure limit exceeded: ${newTotalExposure} > ${hub.riskParameters.maxTotalExposure}`)
    return false
  }

  // Check reserve ratio with buffer
  const requiredReserves = newTotalExposure * BigInt(Math.floor((hub.reserveRatio + hub.riskParameters.liquidityBuffer) * 100)) / 100n
  if (hub.reserves < requiredReserves) {
    if (DEBUG) console.log(`   ❌ Insufficient reserves: ${hub.reserves} < ${requiredReserves}`)
    return false
  }

  return true
}

/**
 * Provide liquidity to a new channel (hub becomes counterparty)
 */
export const provideLiquidity = (
  hub: FractionalReserveHub,
  participantAddress: Address,
  amount: bigint
): { ok: boolean; channelId?: string; error?: string } => {
  if (DEBUG) console.log(`💰 Hub providing ${amount} liquidity to ${participantAddress}`)

  if (!canProvideLiquidity(hub, amount, participantAddress)) {
    return { ok: false, error: 'Cannot provide requested liquidity' }
  }

  // Create channel between hub and participant
  const channelId = `hub_${hub.address}_${participantAddress}_${Date.now()}`
  
  const channel: CreditLineChannel = {
    id: channelId,
    participants: [hub.address, participantAddress],
    balances: {
      [hub.address]: amount,           // Hub starts with funds
      [participantAddress]: 0n         // Participant starts with zero
    },
    creditLimits: {
      [hub.address]: 0n,               // Hub doesn't need credit
      [participantAddress]: amount     // Participant gets credit limit
    },
    reserved: {
      [hub.address]: 0n,
      [participantAddress]: 0n
    },
    nonce: 0n,
    status: 'open',
    lastUpdate: Date.now(),
    hubAddress: hub.address
  }

  // Update hub state
  hub.channels.set(channelId, channel)
  const currentExposure = hub.exposures.get(participantAddress) || 0n
  hub.exposures.set(participantAddress, currentExposure + amount)

  if (DEBUG) {
    console.log(`   ✅ Channel created: ${channelId}`)
    console.log(`   🏦 Hub exposure to ${participantAddress}: ${hub.exposures.get(participantAddress)}`)
    console.log(`   📊 Total hub exposure: ${Array.from(hub.exposures.values()).reduce((sum, exp) => sum + exp, 0n)}`)
  }

  return { ok: true, channelId }
}

/**
 * Calculate hub profitability and risk metrics
 */
export const getHubMetrics = (hub: FractionalReserveHub) => {
  const totalExposure = Array.from(hub.exposures.values()).reduce((sum, exp) => sum + exp, 0n)
  const utilizationRate = Number(totalExposure) / Number(hub.riskParameters.maxTotalExposure)
  const leverageRatio = Number(totalExposure) / Number(hub.reserves)
  const efficiency = calculateCapitalEfficiency(hub)

  return {
    totalExposure,
    reserves: hub.reserves,
    utilizationRate: (utilizationRate * 100).toFixed(1) + '%',
    leverageRatio: leverageRatio.toFixed(1) + 'x',
    capitalEfficiency: efficiency.improvement.toFixed(1) + 'x better than Lightning',
    savingsPercent: efficiency.savingsPercent + '%',
    activeChannels: hub.channels.size,
    riskLevel: utilizationRate > 0.8 ? 'HIGH' : utilizationRate > 0.5 ? 'MEDIUM' : 'LOW'
  }
}

/**
 * Simulate hub revenue from fees
 */
export const simulateHubRevenue = (
  hub: FractionalReserveHub,
  dailyVolumePerChannel: bigint,
  days: number = 30
) => {
  const totalChannels = BigInt(hub.channels.size)
  const dailyVolume = dailyVolumePerChannel * totalChannels
  const totalVolume = dailyVolume * BigInt(days)
  const totalFees = totalVolume * hub.feeRate / 10000n // Convert basis points

  const traditionalCapitalRequired = hub.totalLiquidity
  const fractionalCapitalRequired = hub.reserves
  
  const traditionalROI = Number(totalFees) / Number(traditionalCapitalRequired) * 100
  const fractionalROI = Number(totalFees) / Number(fractionalCapitalRequired) * 100

  return {
    totalVolume,
    totalFees,
    traditionalROI: traditionalROI.toFixed(2) + '%',
    fractionalROI: fractionalROI.toFixed(2) + '%',
    roiImprovement: (fractionalROI / traditionalROI).toFixed(1) + 'x'
  }
}

/**
 * Create a demo hub for testing
 */
export const createDemoHub = (address: Address = 'demo-hub'): FractionalReserveHub => {
  return createFractionalReserveHub(address, 10000n, 0.2) // 10k reserves, 20% ratio = 50k max exposure
}