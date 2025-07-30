// Fractional Reserve Economics
// Core innovation: Hubs need only 20% reserves for full operation

export interface Hub {
  readonly id: string
  readonly collateral: bigint      // On-chain collateral
  readonly creditExtended: bigint  // Total credit given out
  readonly creditReceived: bigint  // Total credit received
  readonly tier: 'major' | 'regional' | 'local' | 'trader'
}

// Reserve requirements by tier
export const RESERVE_RATIOS = {
  major: 0.2,     // 20% reserves = 5x leverage
  regional: 0.33, // 33% reserves = 3x leverage  
  local: 0.5,     // 50% reserves = 2x leverage
  trader: 1.0     // 100% reserves = no leverage
} as const

// Calculate maximum credit a hub can extend
export const maxCredit = (hub: Hub): bigint => {
  const ratio = RESERVE_RATIOS[hub.tier]
  const max = hub.collateral * BigInt(Math.floor(1 / ratio))
  return max - hub.creditExtended
}

// Calculate current leverage
export const leverage = (hub: Hub): number => {
  if (hub.collateral === 0n) return 0
  return Number(hub.creditExtended) / Number(hub.collateral)
}

// Check if hub is within safe operating parameters
export const isSolvent = (hub: Hub): boolean => {
  const maxLeverage = 1 / RESERVE_RATIOS[hub.tier]
  return leverage(hub) <= maxLeverage
}

// Calculate capital efficiency vs Lightning
export const capitalEfficiency = (hub: Hub): number => {
  // Lightning needs 100% reserves
  const lightningReserves = hub.creditExtended
  // XLN needs only fractional reserves
  const xlnReserves = hub.collateral
  
  if (xlnReserves === 0n) return 0
  return Number(lightningReserves) / Number(xlnReserves)
}

// Economic analysis
export const analyze = (hub: Hub) => {
  const lev = leverage(hub)
  const maxLev = 1 / RESERVE_RATIOS[hub.tier]
  const efficiency = capitalEfficiency(hub)
  const available = maxCredit(hub)
  
  return {
    tier: hub.tier,
    collateral: hub.collateral,
    creditExtended: hub.creditExtended,
    leverage: lev.toFixed(2),
    maxLeverage: maxLev.toFixed(2),
    utilization: ((lev / maxLev) * 100).toFixed(1) + '%',
    efficiency: efficiency.toFixed(1) + 'x',
    availableCredit: available,
    solvent: isSolvent(hub)
  }
}