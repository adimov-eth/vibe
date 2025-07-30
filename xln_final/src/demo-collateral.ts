// XLN Collateral Demo - On-chain/Off-chain State Split
// Shows how collateral enables payments beyond credit limits

import { wallet, address } from './core/channels.js'
import { multiAssetChannel, payAsset, ASSETS, canPayAsset } from './core/multi-asset-channels.js'
import { 
  depositCollateral, 
  withdrawCollateral, 
  getAvailableBalance,
  getCollateralizationRatio,
  settleChannel 
} from './core/collateral.js'

async function demo() {
  console.log('=== XLN Collateral System Demo ===\n')
  
  // Create participants
  const alice = wallet('alice')
  const bob = wallet('bob')
  
  console.log('Participants:')
  console.log(`Alice: ${address(alice)}`)
  console.log(`Bob:   ${address(bob)}\n`)
  
  // Create channel with small credit limits
  const limits = [
    { tokenId: ASSETS.USDT, leftCreditLimit: 100n, rightCreditLimit: 100n, collateral: 0n }
  ]
  
  let channel = multiAssetChannel(address(alice), address(bob), limits)
  
  console.log('1. Initial channel state:')
  console.log('   Credit limits: Alice=100 USDT, Bob=100 USDT')
  console.log('   Collateral: 0')
  console.log('   ondelta: 0, offdelta: 0\n')
  
  // Try to send payment beyond credit limit
  console.log('2. Alice tries to pay Bob 150 USDT (exceeds her 100 credit):')
  const payment1 = {
    from: address(alice),
    to: address(bob),
    amount: 150n,
    tokenId: ASSETS.USDT
  }
  
  if (!canPayAsset(channel, payment1)) {
    console.log('   ✗ Payment FAILED - exceeds credit limit')
    console.log('   Alice can only go 100 into debt without collateral\n')
  }
  
  // Alice deposits collateral
  console.log('3. Alice deposits 200 USDT collateral on-chain:')
  const depositResult = depositCollateral({
    channel,
    participant: address(alice),
    tokenId: ASSETS.USDT,
    amount: 200n
  })
  
  if (!depositResult) {
    console.log('   ✗ Deposit failed - internal error')
    return
  }
  
  channel = depositResult
  const delta1 = channel.deltas[0]
  console.log(`   ✓ Collateral increased to: ${delta1.collateral}`)
  console.log(`   ✓ ondelta updated to: ${delta1.ondelta} (Alice has +200)`)
  console.log(`   offdelta remains: ${delta1.offdelta}\n`)
  
  // Now payment should work
  console.log('4. Alice tries payment again (with collateral backing):')
  if (canPayAsset(channel, payment1)) {
    console.log('   ✓ Payment NOW POSSIBLE - collateral enables it')
    channel = payAsset(channel, payment1)!
    
    const delta2 = channel.deltas[0]
    console.log(`   offdelta changed to: ${delta2.offdelta} (Alice owes 150)`)
    console.log(`   ondelta unchanged: ${delta2.ondelta} (still +200)`)
    console.log('   Net position: Alice has 200 on-chain, owes 150 off-chain = +50 net\n')
  }
  
  // Show available balances
  console.log('5. Available balances after payment:')
  const aliceAvailable = getAvailableBalance(channel, address(alice), ASSETS.USDT)
  const bobAvailable = getAvailableBalance(channel, address(bob), ASSETS.USDT)
  console.log(`   Alice available: ${aliceAvailable} USDT`)
  console.log(`   Bob available: ${bobAvailable} USDT`)
  console.log(`   Collateralization ratio: ${getCollateralizationRatio(channel, ASSETS.USDT)}x\n`)
  
  // Try to withdraw excess collateral
  console.log('6. Alice tries to withdraw 100 USDT collateral:')
  const withdrawal = withdrawCollateral({
    channel,
    participant: address(alice),
    tokenId: ASSETS.USDT,
    amount: 100n
  })
  
  if (withdrawal) {
    channel = withdrawal
    const delta3 = channel.deltas[0]
    console.log('   ✓ Withdrawal successful')
    console.log(`   Collateral now: ${delta3.collateral}`)
    console.log(`   ondelta now: ${delta3.ondelta} (Alice has +100)`)
    console.log('   Still safe - Alice has 100 on-chain but owes 150 off-chain')
    console.log('   The 100 credit limit covers the 50 gap\n')
  }
  
  // Settlement
  console.log('7. Settlement - moving off-chain state on-chain:')
  channel = settleChannel(channel, ASSETS.USDT)!
  const finalDelta = channel.deltas[0]
  
  console.log('   Before settlement:')
  console.log('   - ondelta: +100 (Alice deposited 200, withdrew 100)')
  console.log('   - offdelta: -150 (Alice paid Bob 150)')
  console.log('\n   After settlement:')
  console.log(`   - ondelta: ${finalDelta.ondelta} (combines on-chain + off-chain)`)
  console.log(`   - offdelta: ${finalDelta.offdelta} (reset to 0)`)
  console.log('\n   Result: Bob now has claim to 50 USDT on-chain (-50 ondelta)\n')
  
  console.log('=== KEY INSIGHTS ===')
  console.log('1. Collateral enables payments beyond credit limits')
  console.log('2. On-chain (ondelta) and off-chain (offdelta) tracked separately')
  console.log('3. Payments happen off-chain for speed (only affect offdelta)')
  console.log('4. Settlement moves accumulated off-chain state on-chain')
  console.log('5. This enables high-frequency trading with periodic settlement')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error)
}