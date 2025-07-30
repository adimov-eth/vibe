// XLN Channels - Credit-line payment channels with cryptographic signatures
// Core protocol for programmable correspondent banking

import { ethers } from 'ethers'

// Types
export type Address = `0x${string}`
export type Signature = `0x${string}`
export type Hash = `0x${string}`

export interface Channel {
  readonly participants: readonly [Address, Address]
  readonly balance: bigint                          // Net position (zero-sum)
  readonly leftCreditLimit: bigint                  // Left participant's credit limit
  readonly rightCreditLimit: bigint                 // Right participant's credit limit
  readonly collateral: bigint                       // On-chain backing
  readonly ondelta: bigint                          // On-chain balance
  readonly offdelta: bigint                         // Off-chain balance
  readonly nonce: bigint
  readonly signatures: readonly [Signature?, Signature?] // Latest state sigs
}

export interface Payment {
  readonly from: Address
  readonly to: Address
  readonly amount: bigint
}

// Import crypto utilities from separate module
import { wallet as createWallet, address as getAddress } from './crypto.js'

// Re-export for convenience
export const wallet = createWallet
export const address = getAddress

// Channel ID from participants
const channelId = (participants: readonly [Address, Address]): Hash =>
  ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address'],
      participants
    )
  ) as Hash

// Hash channel state for signatures
const stateHash = (ch: Channel): Hash =>
  ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'int256', 'uint256', 'uint256', 'uint256', 'uint256', 'int256', 'int256'],
      [
        channelId(ch.participants), 
        ch.balance, 
        ch.leftCreditLimit,
        ch.rightCreditLimit,
        ch.collateral,
        ch.nonce,
        ch.ondelta,
        ch.offdelta
      ]
    )
  ) as Hash

// Create channel
export const channel = (
  alice: Address,
  bob: Address,
  leftCreditLimit = 1000n,
  rightCreditLimit = 1000n,
  collateral = 0n
): Channel => ({
  participants: [alice, bob],
  balance: 0n,
  leftCreditLimit,
  rightCreditLimit,
  collateral,
  ondelta: 0n,
  offdelta: 0n,
  nonce: 0n,
  signatures: [undefined, undefined]
})

// Check if payment possible
const canPay = (ch: Channel, p: Payment): boolean => {
  const fromIdx = ch.participants.indexOf(p.from)
  const toIdx = ch.participants.indexOf(p.to)
  if (fromIdx === -1 || toIdx === -1) return false
  
  const newBalance = ch.balance + (fromIdx === 0 ? p.amount : -p.amount)
  
  // Check credit limits:
  // If balance > 0: left has surplus, right owes
  // If balance < 0: right has surplus, left owes
  if (newBalance > 0 && newBalance > ch.rightCreditLimit) return false
  if (newBalance < 0 && -newBalance > ch.leftCreditLimit) return false
  
  return true
}

// Execute payment (immutable)
export const pay = (ch: Channel, p: Payment): Channel | null => {
  if (!canPay(ch, p)) return null
  
  const fromIdx = ch.participants.indexOf(p.from)
  const shift = fromIdx === 0 ? p.amount : -p.amount
  
  return {
    ...ch,
    balance: ch.balance + shift,
    nonce: ch.nonce + 1n,
    signatures: [undefined, undefined] // Reset sigs on state change
  }
}

// Sign channel state
export const sign = async (
  w: ethers.Wallet,
  ch: Channel
): Promise<Channel> => {
  const idx = ch.participants.indexOf(address(w))
  if (idx === -1) throw new Error('Signer not in channel')
  
  const sig = await w.signMessage(stateHash(ch)) as Signature
  const newSigs: [Signature?, Signature?] = [...ch.signatures]
  newSigs[idx] = sig
  
  return { ...ch, signatures: newSigs }
}

// Verify channel signatures
export const verify = (ch: Channel): boolean =>
  ch.signatures.every((sig, idx) =>
    !sig || ethers.verifyMessage(stateHash(ch), sig) === ch.participants[idx]
  )

// Multi-channel routing
export const route = (
  channels: Channel[],
  from: Address,
  to: Address,
  amount: bigint,
  hubs: Address[]
): { path: Address[]; channels: Channel[] } | null => {
  // Direct route
  const direct = channels.find(ch =>
    ch.participants.includes(from) && ch.participants.includes(to)
  )
  if (direct && canPay(direct, { from, to, amount })) {
    const updated = pay(direct, { from, to, amount })
    if (updated) {
      const newChannels = [...channels]
      newChannels[channels.indexOf(direct)] = updated
      return { path: [from, to], channels: newChannels }
    }
  }
  
  // Hub route
  for (const hub of hubs) {
    const ch1 = channels.find(ch =>
      ch.participants.includes(from) && ch.participants.includes(hub)
    )
    const ch2 = channels.find(ch =>
      ch.participants.includes(hub) && ch.participants.includes(to)
    )
    
    if (ch1 && ch2 &&
        canPay(ch1, { from, to: hub, amount }) &&
        canPay(ch2, { from: hub, to, amount })) {
      
      const updated1 = pay(ch1, { from, to: hub, amount })
      const updated2 = pay(ch2, { from: hub, to, amount })
      
      if (updated1 && updated2) {
        const newChannels = [...channels]
        newChannels[channels.indexOf(ch1)] = updated1
        newChannels[channels.indexOf(ch2)] = updated2
        return { path: [from, hub, to], channels: newChannels }
      }
    }
  }
  
  return null
}


// Demo moved to src/demo.ts
/* if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('XLN Cryptographic Protocol\n')
    
    // Create wallets
    const alice = wallet('alice')
    const bob = wallet('bob')
    const hub = wallet('hub')
    
    // Setup channels
    let channels: Channel[] = [
      channel(address(alice), address(hub), 1000n),
      channel(address(hub), address(bob), 1000n)
    ]
    
    console.log('Network:')
    console.log(`Alice (${address(alice)}) ← → Hub ← → Bob (${address(bob)})\n`)
    
    // Route payment through hub
    const result = route(channels, address(alice), address(bob), 500n, [address(hub)])
    if (!result) {
      console.log('Payment failed')
      return
    }
    
    console.log(`Payment routed: ${result.path.join(' → ')}`)
    console.log('Channel states after payment:')
    
    channels = result.channels
    
    // Sign the updated states
    channels[0] = await sign(alice, channels[0])
    channels[0] = await sign(hub, channels[0])
    
    channels[1] = await sign(hub, channels[1])
    channels[1] = await sign(bob, channels[1])
    
    // Verify
    console.log(`\nChannel 1 (Alice-Hub): balance = ${channels[0].balance}`)
    console.log(`  Signatures valid: ${verify(channels[0])}`)
    console.log(`Channel 2 (Hub-Bob): balance = ${channels[1].balance}`)
    console.log(`  Signatures valid: ${verify(channels[1])}`)
    
    console.log('\nThe key insight: Bob received payment without any initial funds')
    console.log('Every state change is cryptographically signed by both parties')
  })()
} */