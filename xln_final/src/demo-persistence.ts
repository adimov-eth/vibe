// XLN Persistence Demo - Save/load channel state and WAL recovery

import { wallet, address, channel, pay, sign } from './core/channels.js'
import { multiAssetChannel, ASSETS, payAsset, signMultiAsset } from './core/multi-asset-channels.js'
import {
  createStateContainer,
  loadStateContainer,
  toJSON,
  fromJSON,
  isValidChannelState
} from './persistence/storage.js'
import {
  createWalFile,
  appendEntry,
  walCreateChannel,
  walPay,
  walSign,
  walCreateMultiAssetChannel,
  walPayAsset,
  walCheckpoint,
  compactWal,
  walToJSON,
  walFromJSON
} from './persistence/wal.js'
import { promises as fs } from 'fs'
import { join } from 'path'

const STORAGE_DIR = './xln-storage'

// Ensure storage directory exists
const ensureStorageDir = async () => {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (e) {
    // Directory already exists
  }
}

// Save channel state to file
const saveState = async (filename: string, channels: any[], multiAssetChannels: any[]) => {
  const state = createStateContainer(channels, multiAssetChannels)
  const json = toJSON(state)
  await fs.writeFile(join(STORAGE_DIR, filename), json, 'utf8')
  return state
}

// Load channel state from file
const loadState = async (filename: string) => {
  const json = await fs.readFile(join(STORAGE_DIR, filename), 'utf8')
  const state = fromJSON(json)
  if (!isValidChannelState(state)) {
    throw new Error('Invalid channel state file')
  }
  return loadStateContainer(state)
}

// Save WAL to file
const saveWal = async (filename: string, wal: any) => {
  const json = walToJSON(wal)
  await fs.writeFile(join(STORAGE_DIR, filename), json, 'utf8')
}

// Load WAL from file
const loadWal = async (filename: string) => {
  const json = await fs.readFile(join(STORAGE_DIR, filename), 'utf8')
  return walFromJSON(json)
}

// Demo
export const demo = async () => {
  console.log('🗄️  XLN Persistence Demo\n')
  console.log('Setting up storage...')
  await ensureStorageDir()
  
  // Create wallets
  const alice = wallet('alice')
  const bob = wallet('bob')
  const hub = wallet('hub')
  
  // Initialize WAL
  let wal = createWalFile()
  
  // Create channels
  console.log('\n1️⃣  Creating channels...')
  
  const ch1 = channel(address(alice), address(hub), 1000n, 1000n)
  wal = appendEntry(wal, walCreateChannel(ch1))
  
  const ch2 = channel(address(hub), address(bob), 1000n, 1000n)
  wal = appendEntry(wal, walCreateChannel(ch2))
  
  const multiCh = multiAssetChannel(
    address(alice),
    address(bob),
    [
      { tokenId: ASSETS.USDT, leftCreditLimit: 5000n, rightCreditLimit: 5000n },
      { tokenId: ASSETS.ETH, leftCreditLimit: 1000n, rightCreditLimit: 1000n }
    ]
  )
  wal = appendEntry(wal, walCreateMultiAssetChannel(multiCh))
  
  // Save initial state
  console.log('💾 Saving initial state...')
  await saveState('channels.json', [ch1, ch2], [multiCh])
  await saveWal('wal.json', wal)
  
  // Make payments
  console.log('\n2️⃣  Making payments...')
  
  // Pay through hub
  const payment1 = { from: address(alice), to: address(hub), amount: 300n }
  const ch1After = pay(ch1, payment1)!
  wal = appendEntry(wal, walPay(ch1, ch1After, payment1))
  
  const payment2 = { from: address(hub), to: address(bob), amount: 300n }
  const ch2After = pay(ch2, payment2)!
  wal = appendEntry(wal, walPay(ch2, ch2After, payment2))
  
  // Multi-asset payment
  const assetPayment = { 
    from: address(alice), 
    to: address(bob), 
    amount: 1500n,
    tokenId: ASSETS.USDT
  }
  const multiChAfter = payAsset(multiCh, assetPayment)!
  wal = appendEntry(wal, walPayAsset(multiCh, multiChAfter, assetPayment))
  
  // Sign states
  console.log('\n3️⃣  Signing channel states...')
  
  const ch1Signed = await sign(alice, ch1After)
  wal = appendEntry(wal, walSign(ch1Signed, address(alice), ch1Signed.signatures[0]!))
  
  const ch1FullySigned = await sign(hub, ch1Signed)
  wal = appendEntry(wal, walSign(ch1FullySigned, address(hub), ch1FullySigned.signatures[1]!))
  
  // Create checkpoint
  console.log('\n4️⃣  Creating checkpoint...')
  wal = appendEntry(wal, walCheckpoint([ch1FullySigned, ch2After], [multiChAfter]))
  
  // Save updated state
  console.log('💾 Saving updated state...')
  await saveState('channels-updated.json', [ch1FullySigned, ch2After], [multiChAfter])
  await saveWal('wal-updated.json', wal)
  
  // Simulate crash and recovery
  console.log('\n5️⃣  Simulating crash and recovery...')
  console.log('   Loading state from disk...')
  
  const recovered = await loadState('channels-updated.json')
  console.log(`   ✅ Recovered ${recovered.channels.length} channels`)
  console.log(`   ✅ Recovered ${recovered.multiAssetChannels.length} multi-asset channels`)
  
  // Verify recovered state
  console.log('\n6️⃣  Verifying recovered state:')
  console.log(`   Channel 1 balance: ${recovered.channels[0].balance}`)
  console.log(`   Channel 1 signatures: ${recovered.channels[0].signatures.filter(s => s).length}/2`)
  console.log(`   Multi-asset USDT balance: ${recovered.multiAssetChannels[0].deltas[0].offdelta}`)
  
  // Load and compact WAL
  console.log('\n7️⃣  WAL operations:')
  const recoveredWal = await loadWal('wal-updated.json')
  console.log(`   Total entries: ${recoveredWal.entries.length}`)
  
  const compactedWal = compactWal(recoveredWal)
  console.log(`   After compaction: ${compactedWal.entries.length} entries`)
  
  // File sizes
  console.log('\n8️⃣  Storage efficiency:')
  const stateStats = await fs.stat(join(STORAGE_DIR, 'channels-updated.json'))
  const walStats = await fs.stat(join(STORAGE_DIR, 'wal-updated.json'))
  console.log(`   State file: ${stateStats.size} bytes`)
  console.log(`   WAL file: ${walStats.size} bytes`)
  
  console.log('\n✅ Persistence demo complete!')
  console.log('   - Channel state serialized/deserialized')
  console.log('   - WAL tracks all operations')
  console.log('   - Crash recovery successful')
  console.log('   - Files saved to ./xln-storage/')
  
  return { channels: recovered.channels, multiAssetChannels: recovered.multiAssetChannels }
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error)
}