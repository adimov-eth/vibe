// Entity utilities extracted from xln/src/server.ts
// Handles lazy, numbered, and named entity types

import type { ConsensusConfig, JurisdictionConfig } from '../types/consensus.js'
import type { EntityType } from '../types/entities.js'
import { hashBoard } from '../core/crypto.js'

const DEBUG = true

// === ENTITY ID GENERATION ===

export const encodeBoard = (config: ConsensusConfig): string => {
  const delegates = config.validators.map(validator => ({
    entityId: validator, // For EOA addresses (20 bytes)
    votingPower: Number(config.shares[validator] || 1n)
  }))

  const board = {
    votingThreshold: Number(config.threshold),
    delegates: delegates
  }

  // Return JSON representation that can be hashed consistently
  return JSON.stringify(board, Object.keys(board).sort())
}

export const generateLazyEntityId = (validators: {name: string, weight: number}[] | string[], threshold: bigint): string => {
  // Create deterministic entity ID from quorum composition
  let validatorData: {name: string, weight: number}[]
  
  // Handle both formats: array of objects or array of strings (assume weight=1)
  if (typeof validators[0] === 'string') {
    validatorData = (validators as string[]).map(name => ({name, weight: 1}))
  } else {
    validatorData = validators as {name: string, weight: number}[]
  }
  
  // Sort by name for canonical ordering
  const sortedValidators = validatorData.slice().sort((a, b) => a.name.localeCompare(b.name))
  
  const quorumData = {
    validators: sortedValidators,
    threshold: threshold.toString()
  }
  
  const serialized = JSON.stringify(quorumData)
  return hashBoard(serialized)
}

export const generateNumberedEntityId = (entityNumber: number): string => {
  // Convert number to bytes32 (left-padded with zeros)
  return `0x${entityNumber.toString(16).padStart(64, '0')}`
}

export const generateNamedEntityId = (name: string): string => {
  // For named entities: entityId resolved via name lookup on-chain
  // This is just for client-side preview
  return hashBoard(name)
}

// === ENTITY TYPE DETECTION ===

export const detectEntityType = (entityId: string): EntityType => {
  // Check if this is a hex string (0x followed by hex digits)
  if (entityId.startsWith('0x') && entityId.length === 66) {
    try {
      const num = BigInt(entityId)
      
      // Small positive numbers = numbered entities
      if (num > 0n && num < 1000000n) {
        return 'numbered'
      }
      
      // Very large numbers are lazy entity hashes
      return 'lazy'
    } catch {
      return 'lazy'
    }
  }
  
  // Check if this is a numeric string before trying BigInt conversion
  if (/^[0-9]+$/.test(entityId)) {
    try {
      const num = BigInt(entityId)
      
      // Small positive numbers = numbered entities
      if (num > 0n && num < 1000000n) {
        return 'numbered'
      }
      
      // Very large numbers might be lazy entity hashes
      return 'lazy'
    } catch {
      return 'lazy'
    }
  }
  
  // Non-numeric, non-hex strings are lazy entities
  return 'lazy'
}

export const extractNumberFromEntityId = (entityId: string): number | null => {
  // Check if this is a hex string (0x followed by hex digits)
  if (entityId.startsWith('0x') && entityId.length === 66) {
    try {
      const num = BigInt(entityId)
      
      // Check if it's a numbered entity (small positive number)
      if (num > 0n && num < 1000000n) {
        return Number(num)
      }
      
      return null
    } catch {
      return null
    }
  }
  
  // Check if this is a numeric string before trying BigInt conversion
  if (/^[0-9]+$/.test(entityId)) {
    try {
      const num = BigInt(entityId)
      
      // Check if it's a numbered entity (small positive number)
      if (num > 0n && num < 1000000n) {
        return Number(num)
      }
      
      return null
    } catch {
      return null
    }
  }
  
  return null
}