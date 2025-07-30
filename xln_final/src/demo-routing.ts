// XLN Routing Demo - Atomic multi-hop payments
// Shows how HTLCs enable trustless routing

import { channel, wallet, address } from './core/channels.js'
import { findPath, createRoutedPayment, executeRoute } from './core/routing.js'
import { settle, verifySecret } from './core/htlc.js'

async function demo() {
  console.log('=== XLN Atomic Routing Demo ===\n')
  
  // Create network: Alice -> Hub -> Bob
  const alice = wallet('alice')
  const hub = wallet('hub')
  const bob = wallet('bob')
  
  console.log('Network topology:')
  console.log(`Alice: ${address(alice)}`)
  console.log(`Hub:   ${address(hub)}`)
  console.log(`Bob:   ${address(bob)}`)
  console.log('Alice ← → Hub ← → Bob\n')
  
  // Create channels with credit
  const channels = [
    channel(address(alice), address(hub), 1000n, 1000n),
    channel(address(hub), address(bob), 1000n, 1000n)
  ]
  
  // Find route from Alice to Bob
  const path = findPath(channels, address(alice), address(bob), 100n)
  if (!path) {
    console.log('No route found!')
    return
  }
  
  console.log(`Route found: ${path.map(a => a.slice(0, 8)).join(' → ')}\n`)
  
  // Create atomic payment with secret
  const secret = 'magic-secret-42'
  const payment = createRoutedPayment(path, 100n, secret)
  
  console.log('1. Creating HTLCs for atomic routing:')
  console.log(`   Secret: "${secret}"`)
  console.log(`   Hashlock: ${payment.hashlock}\n`)
  
  payment.htlcs.forEach((htlc, i) => {
    console.log(`   HTLC ${i + 1}: ${htlc.from.slice(0, 8)} → ${htlc.to.slice(0, 8)}`)
    console.log(`   Amount: ${htlc.amount}, Timeout: ${htlc.timelock}`)
  })
  
  // Execute the route (lock funds)
  console.log('\n2. Locking funds in channels:')
  const result = executeRoute(channels, payment)
  if (!result) {
    console.log('   Route execution failed!')
    return
  }
  console.log('   ✓ All payments locked with hashlock\n')
  
  // Bob reveals secret to claim payment
  console.log('3. Bob reveals secret to claim:')
  const bobHTLC = payment.htlcs[1]  // Hub → Bob
  const bobClaim = settle(bobHTLC, secret)
  
  if (bobClaim) {
    console.log('   ✓ Bob successfully claimed 100 from Hub')
    console.log(`   Bob now knows secret: "${secret}"\n`)
  }
  
  // Hub uses secret to claim from Alice
  console.log('4. Hub uses secret to claim from Alice:')
  const hubHTLC = payment.htlcs[0]  // Alice → Hub
  const hubClaim = settle(hubHTLC, secret)
  
  if (hubClaim) {
    console.log('   ✓ Hub successfully claimed 100 from Alice')
    console.log('   Payment complete!\n')
  }
  
  // Show final balances
  console.log('5. Final channel states:')
  console.log(`   Alice-Hub channel: balance = ${result.channels[0].balance}`)
  console.log(`   Hub-Bob channel:   balance = ${result.channels[1].balance}\n`)
  
  console.log('=== KEY INSIGHTS ===')
  console.log('1. Payment is ATOMIC - either all succeed or all fail')
  console.log('2. Hub cannot steal funds - needs secret from Bob')
  console.log('3. Timeouts ensure funds not locked forever')
  console.log('4. No trust required between non-adjacent nodes')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error)
}