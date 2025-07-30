// Multi-Asset Demo - Trust varies by asset
// Real insight: You trust different amounts for different assets

import { wallet, address } from './core/channels.js'
import {
  ASSETS,
  multiAssetChannel,
  payAsset,
  signMultiAsset,
  verifyMultiAsset,
  routeAsset,
  type MultiAssetChannel
} from './core/multi-asset-channels.js'

console.log('=== XLN MULTI-ASSET DEMO ===\n')
console.log('Key insight: Trust is asset-specific in the real world')
console.log('You might trust someone for $5k USDT but only $1k BTC\n')

// Create participants
const alice = wallet('alice')
const bob = wallet('bob') 
const hub = wallet('hub')

console.log('Participants:')
console.log(`Alice: ${address(alice)}`)
console.log(`Bob: ${address(bob)}`)
console.log(`Hub: ${address(hub)}\n`)

// Create channels with asset-specific trust limits
console.log('1. ASSET-SPECIFIC TRUST RELATIONSHIPS')
console.log('   Alice ← → Hub with different limits per asset:')

const aliceHub = multiAssetChannel(
  address(alice),
  address(hub),
  [
    {
      tokenId: ASSETS.USDT,
      leftCreditLimit: 5000n,  // Alice trusts hub for $5k USDT
      rightCreditLimit: 1000n  // Hub trusts Alice for $1k USDT
    },
    {
      tokenId: ASSETS.BTC,
      leftCreditLimit: 1000n,  // Alice only trusts hub for $1k BTC (volatile!)
      rightCreditLimit: 500n   // Hub trusts Alice for $500 BTC
    },
    {
      tokenId: ASSETS.ETH,
      leftCreditLimit: 2000n,  // Medium trust for ETH
      rightCreditLimit: 2000n  // Symmetric for ETH
    }
  ]
)

console.log('   - USDT: Alice trusts hub for $5000, hub trusts Alice for $1000')
console.log('   - BTC:  Alice trusts hub for $1000, hub trusts Alice for $500')
console.log('   - ETH:  Both trust each other for $2000\n')

const hubBob = multiAssetChannel(
  address(hub),
  address(bob),
  [
    {
      tokenId: ASSETS.USDT,
      leftCreditLimit: 10000n, // Hub has high USDT capacity
      rightCreditLimit: 5000n
    },
    {
      tokenId: ASSETS.BTC,
      leftCreditLimit: 2000n,  // Lower BTC capacity
      rightCreditLimit: 1000n
    },
    {
      tokenId: ASSETS.ETH,
      leftCreditLimit: 5000n,
      rightCreditLimit: 3000n
    }
  ]
)

let channels: MultiAssetChannel[] = [aliceHub, hubBob]

// Demo different asset payments
console.log('2. MULTI-ASSET PAYMENTS')

// USDT payment - works because within trust limits
console.log('\n   a) Alice pays Bob 3000 USDT:')
const usdtResult = routeAsset(
  channels,
  address(alice),
  address(bob),
  3000n,
  ASSETS.USDT,
  [address(hub)]
)
if (usdtResult) {
  console.log('      ✓ Success! High USDT trust limits allow large payment')
  channels = usdtResult.channels
} else {
  console.log('      ✗ Failed - would exceed trust limits')
}

// BTC payment - fails because exceeds trust
console.log('\n   b) Alice tries to pay Bob 1500 BTC:')
const btcResult = routeAsset(
  channels,
  address(alice),
  address(bob),
  1500n,
  ASSETS.BTC,
  [address(hub)]
)
if (btcResult) {
  console.log('      ✓ Success!')
  channels = btcResult.channels
} else {
  console.log('      ✗ Failed - exceeds BTC trust limits (hub only trusts Alice for 500 BTC)')
}

// Smaller BTC payment - works
console.log('\n   c) Alice pays Bob 400 BTC:')
const btcSmallResult = routeAsset(
  channels,
  address(alice),
  address(bob),
  400n,
  ASSETS.BTC,
  [address(hub)]
)
if (btcSmallResult) {
  console.log('      ✓ Success! Within BTC trust limits')
  channels = btcSmallResult.channels
} else {
  console.log('      ✗ Failed')
}

// Sign and verify states
console.log('\n3. CRYPTOGRAPHIC SIGNATURES')
const ch = await signMultiAsset(alice, 
  await signMultiAsset(hub, channels[0])
)
console.log(`   Channel state signed by both parties`)
console.log(`   Signatures valid: ${verifyMultiAsset(ch)}`)

// Show final balances
console.log('\n4. FINAL CHANNEL STATES')
console.log('   Alice-Hub channel:')
channels[0].deltas.forEach(d => {
  const assetName = Object.keys(ASSETS).find(k => ASSETS[k as keyof typeof ASSETS] === d.tokenId)
  console.log(`     ${assetName}: balance = ${d.offdelta}`)
})

console.log('\n   Hub-Bob channel:')
channels[1].deltas.forEach(d => {
  const assetName = Object.keys(ASSETS).find(k => ASSETS[k as keyof typeof ASSETS] === d.tokenId)
  console.log(`     ${assetName}: balance = ${d.offdelta}`)
})

console.log('\n=== KEY INSIGHTS ===')
console.log('1. Different assets have different trust profiles')
console.log('2. Stablecoins (USDT) allow higher trust limits')
console.log('3. Volatile assets (BTC) require lower limits')
console.log('4. Each asset tracks its own balance and limits')
console.log('5. Routing respects asset-specific constraints')
console.log('\nThis mirrors real-world banking where credit limits vary by currency!')

export { }