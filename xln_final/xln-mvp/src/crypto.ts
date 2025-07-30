// XLN Cryptography - Trust through mathematics, not promises
// Using ethers.js for EVM-compatible signatures

import { ethers } from 'ethers'

export type Address = `0x${string}`
export type Signature = `0x${string}`
export type Hash = `0x${string}`

// Generate deterministic wallet from seed
export const wallet = (seed: string): ethers.Wallet => 
  new ethers.Wallet(ethers.id(seed))

// Get address from wallet
export const address = (w: ethers.Wallet): Address =>
  w.address as Address

// Sign a message (EIP-191)
export const sign = async (w: ethers.Wallet, message: string): Promise<Signature> =>
  await w.signMessage(message) as Signature

// Verify signature
export const verify = (message: string, signature: Signature, signer: Address): boolean =>
  ethers.verifyMessage(message, signature) === signer

// Hash data (keccak256)
export const hash = (data: string): Hash =>
  ethers.keccak256(ethers.toUtf8Bytes(data)) as Hash

// Channel state commitment
export interface StateCommitment {
  readonly channelId: Hash
  readonly balance: bigint
  readonly nonce: bigint
  readonly timestamp: bigint
}

// Create state hash for signing
export const stateHash = (state: StateCommitment): Hash =>
  ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'int256', 'uint256', 'uint256'],
      [state.channelId, state.balance, state.nonce, state.timestamp]
    )
  ) as Hash

// Sign channel state
export const signState = async (
  w: ethers.Wallet,
  state: StateCommitment
): Promise<Signature> =>
  await sign(w, stateHash(state))

// Demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = async () => {
    console.log('XLN Cryptography Demo\n')
    
    // Create wallets
    const alice = wallet('alice')
    const bob = wallet('bob')
    
    console.log(`Alice: ${address(alice)}`)
    console.log(`Bob: ${address(bob)}\n`)
    
    // Sign message
    const message = 'Send 100 USDT'
    const signature = await sign(alice, message)
    console.log(`Message: "${message}"`)
    console.log(`Signature: ${signature}\n`)
    
    // Verify
    const valid = verify(message, signature, address(alice))
    const invalid = verify(message, signature, address(bob))
    console.log(`Verified by Alice's address: ${valid}`)
    console.log(`Verified by Bob's address: ${invalid}\n`)
    
    // Channel state signing
    const state: StateCommitment = {
      channelId: hash('alice-bob-channel'),
      balance: 500n,
      nonce: 1n,
      timestamp: BigInt(Date.now())
    }
    
    const stateSignature = await signState(alice, state)
    console.log('Channel State:')
    console.log(`  Balance: ${state.balance}`)
    console.log(`  Nonce: ${state.nonce}`)
    console.log(`  Hash: ${stateHash(state)}`)
    console.log(`  Signature: ${stateSignature}`)
  }
  
  demo()
}