// XLN Economics Demo - Fractional reserve hub operations
// Shows 5x capital efficiency vs Lightning

import { analyze, RESERVE_RATIOS, type Hub } from './economics/fractional-reserve.js'

function demo() {
  console.log('=== XLN Fractional Reserve Economics ===\n')
  
  // Lightning Network hub (traditional)
  console.log('1. Lightning Network Hub (Traditional):')
  console.log('   - Must lock $1 to route $1')
  console.log('   - To route $1M needs $1M locked')
  console.log('   - Capital efficiency: 1x\n')
  
  // XLN Major Hub  
  const xlnHub: Hub = {
    id: 'london-hub',
    collateral: 200_000n,        // $200k on-chain
    creditExtended: 800_000n,    // $800k credit given
    creditReceived: 100_000n,    // $100k credit received
    tier: 'major'
  }
  
  console.log('2. XLN Major Hub:')
  const analysis = analyze(xlnHub)
  console.log(`   Hub: ${xlnHub.id}`)
  console.log(`   Collateral: $${xlnHub.collateral.toLocaleString()}`)
  console.log(`   Credit Extended: $${xlnHub.creditExtended.toLocaleString()}`)
  console.log(`   Leverage: ${analysis.leverage}x / ${analysis.maxLeverage}x`)
  console.log(`   Capital Efficiency: ${analysis.efficiency} vs Lightning`)
  console.log(`   Utilization: ${analysis.utilization}`)
  console.log(`   Available Credit: $${analysis.availableCredit.toLocaleString()}\n`)
  
  // Show different tiers
  console.log('3. Hub Tier Comparison:')
  const tiers: Hub[] = [
    { id: 'major', collateral: 1000n, creditExtended: 5000n, creditReceived: 0n, tier: 'major' },
    { id: 'regional', collateral: 1000n, creditExtended: 3000n, creditReceived: 0n, tier: 'regional' },
    { id: 'local', collateral: 1000n, creditExtended: 2000n, creditReceived: 0n, tier: 'local' },
    { id: 'trader', collateral: 1000n, creditExtended: 1000n, creditReceived: 0n, tier: 'trader' }
  ]
  
  console.log('   Tier      | Reserve | Max Leverage | Efficiency')
  console.log('   ----------|---------|--------------|------------')
  tiers.forEach(hub => {
    const a = analyze(hub)
    console.log(`   ${hub.tier.padEnd(9)} | ${(RESERVE_RATIOS[hub.tier] * 100).toFixed(0)}%     | ${a.maxLeverage}x         | ${a.efficiency}`)
  })
  
  // Over-leveraged hub
  console.log('\n4. Risk Management:')
  const riskyHub: Hub = {
    id: 'risky-hub',
    collateral: 100_000n,
    creditExtended: 600_000n,  // 6x leverage!
    creditReceived: 0n,
    tier: 'major'
  }
  
  const risky = analyze(riskyHub)
  console.log(`   Over-leveraged hub: ${riskyHub.id}`)
  console.log(`   Leverage: ${risky.leverage}x (MAX: ${risky.maxLeverage}x)`)
  console.log(`   Status: ${risky.solvent ? 'SOLVENT' : '⚠️  OVER-LEVERAGED'}`)
  console.log(`   Must reduce exposure by: $${Math.abs(Number(risky.availableCredit)).toLocaleString()}\n`)
  
  console.log('=== KEY INSIGHTS ===')
  console.log('1. Major hubs achieve 5x capital efficiency')
  console.log('2. Only 20% reserves needed vs 100% in Lightning')
  console.log('3. Tiered system matches real-world trust levels')
  console.log('4. Transparent leverage enables proper risk pricing')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demo()
}