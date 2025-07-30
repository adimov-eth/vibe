// XLN Onion Routing - Privacy through layered encryption
// Each hop only knows the next hop, not the full route

import { ethers } from 'ethers'
import type { Address, Hash } from './crypto.js'
import { wallet, hash as createHash } from './crypto.js'

// Onion packet structure
export interface OnionPacket {
  readonly nextHop: Address | null      // null for final recipient
  readonly encryptedPayload: string     // Base64 encoded encrypted data
}

// Payment info for final recipient
export interface FinalPaymentInfo {
  readonly amount: bigint
  readonly secret: string
  readonly sender?: Address  // Optional - final recipient may not need to know
}

// Intermediate hop info
export interface HopInfo {
  readonly amount: bigint
  readonly nextPacket: OnionPacket
}

// Simple encryption using ethers wallet
// In production, use proper ECIES or similar
const encrypt = async (
  publicKey: string,
  data: string
): Promise<string> => {
  // Simple XOR encryption for demo
  // Real implementation would use ECIES with public key
  const key = ethers.keccak256(ethers.toUtf8Bytes(publicKey))
  const encoded = Buffer.from(data, 'utf-8')
  const keyBuf = Buffer.from(key.slice(2), 'hex')
  
  // XOR each byte with key
  const encrypted = Buffer.alloc(encoded.length)
  for (let i = 0; i < encoded.length; i++) {
    encrypted[i] = encoded[i] ^ keyBuf[i % keyBuf.length]
  }
  
  return encrypted.toString('base64')
}

const decrypt = async (
  privateKey: string,
  encrypted: string
): Promise<string> => {
  // For demo, we use the wallet address as public key
  const wallet = new ethers.Wallet(privateKey)
  const publicKey = wallet.address
  
  // Reverse the XOR encryption
  const key = ethers.keccak256(ethers.toUtf8Bytes(publicKey))
  const encBuf = Buffer.from(encrypted, 'base64')
  const keyBuf = Buffer.from(key.slice(2), 'hex')
  
  const decrypted = Buffer.alloc(encBuf.length)
  for (let i = 0; i < encBuf.length; i++) {
    decrypted[i] = encBuf[i] ^ keyBuf[i % keyBuf.length]
  }
  
  return decrypted.toString('utf-8')
}

// Serialize with bigint support
const serialize = (obj: any): string => {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )
}

// Deserialize with bigint support
const deserialize = (str: string): any => {
  return JSON.parse(str, (_, value) => {
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const num = BigInt(value)
      // Only convert if it's a reasonable bigint
      if (num > Number.MAX_SAFE_INTEGER) return num
    }
    return value
  })
}

// Create onion packet for payment routing
export const createOnionPacket = async (
  route: Address[],
  amount: bigint,
  secret: string,
  getPublicKey: (addr: Address) => Promise<string>
): Promise<OnionPacket> => {
  if (route.length === 0) {
    throw new Error('Empty route')
  }
  
  // Start with final recipient's packet
  const finalRecipient = route[route.length - 1]
  const finalPayment: FinalPaymentInfo = {
    amount,
    secret,
  }
  
  let packet: OnionPacket = {
    nextHop: null,
    encryptedPayload: await encrypt(
      await getPublicKey(finalRecipient),
      serialize(finalPayment)
    )
  }
  
  // Wrap in layers for each intermediate hop (reverse order)
  for (let i = route.length - 2; i >= 0; i--) {
    const hop = route[i]
    const hopInfo: HopInfo = {
      amount,
      nextPacket: packet
    }
    
    packet = {
      nextHop: route[i + 1],
      encryptedPayload: await encrypt(
        await getPublicKey(hop),
        serialize(hopInfo)
      )
    }
  }
  
  return packet
}

// Process onion packet at a hop
export const processOnionPacket = async (
  packet: OnionPacket,
  privateKey: string
): Promise<{ isFinal: boolean, info: FinalPaymentInfo | HopInfo }> => {
  const decrypted = await decrypt(privateKey, packet.encryptedPayload)
  const parsed = deserialize(decrypted)
  
  if (packet.nextHop === null) {
    // This is the final recipient
    return {
      isFinal: true,
      info: parsed as FinalPaymentInfo
    }
  } else {
    // Intermediate hop
    return {
      isFinal: false,
      info: parsed as HopInfo
    }
  }
}

// Integrate with routing - create private routed payment
export interface PrivateRoutedPayment {
  readonly amount: bigint
  readonly hashlock: Hash
  readonly timelock: number
  readonly onionPacket: OnionPacket
}

export const createPrivatePayment = async (
  route: Address[],
  amount: bigint,
  secret: string,
  getPublicKey: (addr: Address) => Promise<string>,
  timeoutSeconds = 3600
): Promise<PrivateRoutedPayment> => {
  const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret)) as Hash
  const onionPacket = await createOnionPacket(
    route,
    amount,
    secret,
    getPublicKey
  )
  
  return {
    amount,
    hashlock,
    timelock: Math.floor(Date.now() / 1000) + timeoutSeconds,
    onionPacket
  }
}

// Demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = async () => {
    console.log('XLN Onion Routing Demo\n')
    
    // Create wallets for participants
    const alice = wallet('alice')
    const hub = wallet('hub')
    const merchant = wallet('merchant')
    
    const participants = {
      [alice.address]: alice,
      [hub.address]: hub,
      [merchant.address]: merchant
    }
    
    // Simple public key lookup (using address for demo)
    const getPublicKey = async (addr: Address) => addr
    
    // Create payment route: Alice -> Hub -> Merchant
    const route: Address[] = [
      alice.address as Address,
      hub.address as Address,
      merchant.address as Address
    ]
    
    console.log('Route:', route.map(a => a.slice(0, 8)).join(' -> '))
    
    // Create onion packet
    const secret = 'payment-secret-42'
    const amount = 1000n
    const packet = await createOnionPacket(
      route,
      amount,
      secret,
      getPublicKey
    )
    
    console.log('\n1. Alice creates onion packet')
    console.log('   Next hop:', packet.nextHop?.slice(0, 8))
    console.log('   Encrypted:', packet.encryptedPayload.slice(0, 20) + '...')
    
    // Hub processes packet
    console.log('\n2. Hub processes packet')
    const hubResult = await processOnionPacket(packet, hub.privateKey)
    if (!hubResult.isFinal && 'nextPacket' in hubResult.info) {
      const hopInfo = hubResult.info as HopInfo
      console.log('   Amount:', hopInfo.amount)
      console.log('   Next hop:', hopInfo.nextPacket.nextHop?.slice(0, 8) || 'FINAL')
      
      // Merchant processes final packet
      console.log('\n3. Merchant processes final packet')
      const merchantResult = await processOnionPacket(
        hopInfo.nextPacket,
        merchant.privateKey
      )
      if (merchantResult.isFinal) {
        const finalInfo = merchantResult.info as FinalPaymentInfo
        console.log('   Amount:', finalInfo.amount)
        console.log('   Secret:', finalInfo.secret)
        console.log('   Success! Payment received privately.')
      }
    }
  }
  
  demo()
}