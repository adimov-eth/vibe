// Lazy entities - Free, instant, hash-based
// Extracted from xln/src/server.ts

import type { ConsensusConfig, JurisdictionConfig } from '../types/consensus.js'
import type { EntityCreationResult } from '../types/entities.js'
import { generateLazyEntityId, encodeBoard } from './utils.js'

const DEBUG = true

/**
 * Create a lazy entity (free, instant)
 * Entity ID is deterministically generated from quorum composition
 */
export const createLazyEntity = (
  name: string, 
  validators: string[], 
  threshold: bigint, 
  jurisdiction?: JurisdictionConfig
): EntityCreationResult => {
  const entityId = generateLazyEntityId(validators, threshold)
  
  if (DEBUG) console.log(`🔒 Creating lazy entity: ${name}`)
  if (DEBUG) console.log(`   → Entity ID: ${entityId}`)
  if (DEBUG) console.log(`   → Validators: ${validators.join(', ')}`)
  if (DEBUG) console.log(`   → Threshold: ${threshold}`)

  // Create shares map (equal shares for lazy entities)
  const shares: { [validatorId: string]: bigint } = {}
  validators.forEach(validator => {
    shares[validator] = BigInt(1)
  })

  const config: ConsensusConfig = {
    mode: 'proposer-based',
    threshold,
    validators: validators.slice(), // Copy array
    shares,
    jurisdiction
  }

  // Validate the configuration
  const encodedBoard = encodeBoard(config)
  if (DEBUG) console.log(`   → Board encoding: ${encodedBoard.slice(0, 100)}...`)

  return {
    entityId,
    config,
    type: 'lazy',
    metadata: {
      hash: entityId,
      name: name
    }
  }
}

/**
 * Resolve a lazy entity by recreating its configuration
 * Since lazy entities are deterministic, we can recreate the config
 */
export const resolveLazyEntity = (
  entityId: string,
  validators: string[],
  threshold: bigint,
  jurisdiction?: JurisdictionConfig
): EntityCreationResult | null => {
  const expectedEntityId = generateLazyEntityId(validators, threshold)
  
  if (expectedEntityId !== entityId) {
    if (DEBUG) console.log(`❌ Lazy entity resolution failed: ID mismatch`)
    return null
  }

  // Create shares map
  const shares: { [validatorId: string]: bigint } = {}
  validators.forEach(validator => {
    shares[validator] = BigInt(1)
  })

  const config: ConsensusConfig = {
    mode: 'proposer-based',
    threshold,
    validators: validators.slice(),
    shares,
    jurisdiction
  }

  if (DEBUG) console.log(`✅ Resolved lazy entity: ${entityId}`)

  return {
    entityId,
    config,
    type: 'lazy',
    metadata: {
      hash: entityId
    }
  }
}