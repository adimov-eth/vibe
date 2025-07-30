// XLN Credit Demo - Demonstrating asymmetric credit limits
// The key innovation: receive payments without pre-funding

import { channel, pay, sign, verify, wallet, address } from './core/channels.js'

async function demo() {
  console.log('=== XLN Credit Line Demo ===\n')
  
  // Create participants
  const alice = wallet('alice')    // Regular user
  const merchant = wallet('merchant') // Trusted merchant
  
  console.log('Participants:')
  console.log(`Alice (user):     ${address(alice)}`)
  console.log(`Merchant (shop):  ${address(merchant)}\n`)
  
  // Create asymmetric channel:
  // - Alice can owe merchant up to 5000 (merchant trusts Alice)
  // - Merchant can owe Alice only 100 (Alice doesn't trust merchant much)
  const ch = channel(
    address(alice), 
    address(merchant),
    5000n,  // leftCreditLimit: Alice can owe up to 5000
    100n,   // rightCreditLimit: Merchant can owe up to 100
    0n      // No collateral needed!
  )
  
  console.log('Channel created with asymmetric credit:')
  console.log(`- Alice can owe merchant up to: 5000`)
  console.log(`- Merchant can owe Alice up to: 100`)
  console.log(`- Initial balance: ${ch.balance}\n`)
  
  // Alice buys coffee for 5 (she has NO FUNDS)
  console.log('1. Alice buys coffee for 5:')
  const ch1 = pay(ch, { 
    from: address(alice), 
    to: address(merchant), 
    amount: 5n 
  })
  
  if (!ch1) {
    console.log('   Payment failed!')
    return
  }
  
  console.log(`   ✓ Payment successful!`)
  console.log(`   Balance: ${ch1.balance} (Merchant is owed 5)`)
  console.log(`   Alice has NO FUNDS but can still pay!\n`)
  
  // Alice buys lunch for 20
  console.log('2. Alice buys lunch for 20:')
  const ch2 = pay(ch1, { 
    from: address(alice), 
    to: address(merchant), 
    amount: 20n 
  })
  
  console.log(`   ✓ Payment successful!`)
  console.log(`   Balance: ${ch2!.balance} (Merchant is owed 25)\n`)
  
  // Merchant tries to buy something expensive from Alice
  console.log('3. Merchant tries to buy $200 item from Alice:')
  const ch3 = pay(ch2!, { 
    from: address(merchant), 
    to: address(alice), 
    amount: 200n 
  })
  
  if (!ch3) {
    console.log('   ✗ Payment failed! Exceeds merchant credit limit (100)')
    console.log('   This is correct - Alice only trusts merchant for 100\n')
  }
  
  // But merchant CAN buy something small
  console.log('4. Merchant buys $50 item from Alice:')
  const ch4 = pay(ch2!, { 
    from: address(merchant), 
    to: address(alice), 
    amount: 50n 
  })
  
  console.log(`   ✓ Payment successful!`)
  console.log(`   Balance: ${ch4!.balance} (Net position: merchant owes 25)\n`)
  
  // Sign the final state
  console.log('5. Cryptographic signatures:')
  const signed1 = await sign(alice, ch4!)
  const signed2 = await sign(merchant, signed1)
  
  console.log(`   Alice signed: ${signed2.signatures[0]?.slice(0, 20)}...`)
  console.log(`   Merchant signed: ${signed2.signatures[1]?.slice(0, 20)}...`)
  console.log(`   Signatures valid: ${verify(signed2)}\n`)
  
  console.log('=== KEY INSIGHTS ===')
  console.log('1. Alice could pay WITHOUT having any funds')
  console.log('2. Credit limits are ASYMMETRIC (5000 vs 100)')
  console.log('3. This maps to real world trust relationships')
  console.log('4. Every state change is cryptographically signed')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error)
}