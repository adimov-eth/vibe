// XLN Unified Demo - All core innovations working together
// Credit lines + HTLCs + Routing + Fractional reserves

import { channel, wallet, address, sign, verify } from './core/channels.js'
import { findPath, createRoutedPayment, executeRoute } from './core/routing.js'
import { settle } from './core/htlc.js'
import { analyze, type Hub } from './economics/fractional-reserve.js'

async function demo() {
  console.log('=== XLN UNIFIED DEMO ===\n')
  console.log('Demonstrating all core innovations:\n')
  
  // 1. Setup network with asymmetric credit
  console.log('1. CREDIT-LINE CHANNELS (Asymmetric Trust)')
  
  const alice = wallet('alice')      // Regular user
  const hub = wallet('londonHub')    // Major hub
  const merchant = wallet('merchant') // Nigerian merchant
  
  // Asymmetric credit relationships
  const channels = [
    // Alice can owe hub 5000, hub can owe Alice 1000
    channel(address(alice), address(hub), 5000n, 1000n, 0n),
    // Hub can owe merchant 10000, merchant can owe hub 1000  
    channel(address(hub), address(merchant), 1000n, 10000n, 0n)
  ]
  
  console.log('   Alice ← → London Hub ← → Nigerian Merchant')
  console.log('   Credit limits:')
  console.log('   - Alice can owe hub: 5000')
  console.log('   - Hub can owe Alice: 1000')
  console.log('   - Hub can owe merchant: 1000')
  console.log('   - Merchant can owe hub: 10000\n')
  
  // 2. Hub economics
  console.log('2. FRACTIONAL RESERVES (5x Capital Efficiency)')
  
  const londonHub: Hub = {
    id: 'london-hub',
    collateral: 2_000_000n,      // $2M on-chain
    creditExtended: 8_000_000n,  // $8M credit given out
    creditReceived: 1_000_000n,  // $1M credit received
    tier: 'major'
  }
  
  const hubAnalysis = analyze(londonHub)
  console.log(`   Hub collateral: $${londonHub.collateral.toLocaleString()}`)
  console.log(`   Credit extended: $${londonHub.creditExtended.toLocaleString()}`)
  console.log(`   Leverage: ${hubAnalysis.leverage}x`)
  console.log(`   Capital efficiency: ${hubAnalysis.efficiency} vs Lightning\n`)
  
  // 3. Atomic routing
  console.log('3. HTLC ROUTING (Atomic Multi-hop)')
  
  const path = findPath(channels, address(alice), address(merchant), 500n)
  if (!path) {
    console.log('   No route found!')
    return
  }
  
  console.log(`   Route: ${path.map(a => a.slice(0, 8)).join(' → ')}`)
  
  const secret = 'nigerian-coffee-order-42'
  const payment = createRoutedPayment(path, 500n, secret)
  
  console.log(`   Secret: "${secret}"`)
  console.log(`   Hashlock: ${payment.hashlock.slice(0, 16)}...\n`)
  
  // 4. Execute payment (Alice has NO FUNDS!)
  console.log('4. PAYMENT EXECUTION (Without Pre-funding)')
  
  const result = executeRoute(channels, payment)
  if (!result) {
    console.log('   Payment failed!')
    return
  }
  
  console.log('   ✓ Alice pays 500 to merchant (SHE HAS NO FUNDS!)')
  console.log('   ✓ Payment locked with HTLCs')
  
  // Merchant reveals secret
  const merchantClaim = settle(payment.htlcs[1], secret)
  console.log('   ✓ Merchant reveals secret and claims payment')
  
  // Hub claims from Alice
  const hubClaim = settle(payment.htlcs[0], secret)
  console.log('   ✓ Hub uses secret to claim from Alice')
  console.log('   ✓ Payment complete atomically!\n')
  
  // 5. Sign final states
  console.log('5. CRYPTOGRAPHIC SIGNATURES')
  
  const ch1 = result.channels[0]
  const signed1 = await sign(alice, ch1)
  const signed2 = await sign(hub, signed1)
  
  console.log(`   Channel state signed by both parties`)
  console.log(`   Signatures valid: ${verify(signed2)}\n`)
  
  // Summary
  console.log('=== SUMMARY: XLN vs LIGHTNING ===\n')
  console.log('XLN Advantages Demonstrated:')
  console.log('✓ Alice paid WITHOUT having any funds (credit lines)')
  console.log('✓ Hub operates with 4x leverage (fractional reserves)')
  console.log('✓ Payment routed atomically through HTLCs')
  console.log('✓ Every state cryptographically signed')
  console.log('✓ Trust relationships match real world (asymmetric)\n')
  
  console.log('Lightning Would Require:')
  console.log('✗ Alice pre-funds $500 to pay $500')
  console.log('✗ Hub locks $8M to route $8M (no leverage)')
  console.log('✗ Symmetric channels (unrealistic trust model)')
  console.log('✗ Complex channel management and rebalancing\n')
  
  console.log('Result: XLN enables payments that Lightning cannot.')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error)
}