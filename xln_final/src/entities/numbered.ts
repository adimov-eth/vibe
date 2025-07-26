// Numbered entities - Blockchain-registered, gas cost
// Extracted from xln/src/server.ts

import type { ConsensusConfig, JurisdictionConfig } from '../types/consensus.js'
import type { EntityCreationResult } from '../types/entities.js'
import { generateNumberedEntityId, extractNumberFromEntityId } from './utils.js'

const DEBUG = true

/**
 * Create a numbered entity (requires blockchain registration)
 * Entity number must be registered on-chain first
 */
export const createNumberedEntity = (
  entityNumber: number,
  validators: string[],
  threshold: bigint,
  jurisdiction?: JurisdictionConfig
): EntityCreationResult => {
  const entityId = generateNumberedEntityId(entityNumber)
  
  if (DEBUG) console.log(`🔢 Creating numbered entity: #${entityNumber}`)
  if (DEBUG) console.log(`   → Entity ID: ${entityId}`)
  if (DEBUG) console.log(`   → Validators: ${validators.join(', ')}`)
  if (DEBUG) console.log(`   → Threshold: ${threshold}`)

  // Create shares map (equal shares for numbered entities)
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

  return {
    entityId,
    config,
    type: 'numbered',
    metadata: {
      number: entityNumber
    }
  }
}

/**
 * Request numbered entity assignment from blockchain
 * This would interact with EntityProvider contract in production
 */
export const requestNumberedEntity = async (
  validators: string[],
  threshold: bigint,
  jurisdiction?: JurisdictionConfig
): Promise<EntityCreationResult> => {
  if (DEBUG) console.log(`📝 Requesting numbered entity assignment`)
  if (DEBUG) console.log(`   → Validators: ${validators.join(', ')}`)
  if (DEBUG) console.log(`   → Threshold: ${threshold}`)
  if (DEBUG) console.log(`   → Jurisdiction: ${jurisdiction?.name || 'default'}`)

  // Simulate blockchain interaction
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Simulate getting next available number
  const entityNumber = Math.floor(Math.random() * 1000) + 1
  
  if (DEBUG) console.log(`   ✅ Assigned Entity Number: ${entityNumber}`)

  return createNumberedEntity(entityNumber, validators, threshold, jurisdiction)
}

/**
 * Resolve a numbered entity from its ID
 * Would query EntityProvider contract in production
 */
export const resolveNumberedEntity = async (
  entityId: string
): Promise<EntityCreationResult | null> => {
  const entityNumber = extractNumberFromEntityId(entityId)
  
  if (entityNumber === null) {
    if (DEBUG) console.log(`❌ Invalid numbered entity ID: ${entityId}`)
    return null
  }

  if (DEBUG) console.log(`🔍 Resolving numbered entity #${entityNumber}`)

  // Simulate blockchain lookup
  await new Promise(resolve => setTimeout(resolve, 50))

  // For demo purposes, create a mock configuration
  // In production, this would come from the blockchain
  const mockValidators = ['alice', 'bob', 'charlie']
  const mockThreshold = BigInt(2)

  return createNumberedEntity(entityNumber, mockValidators, mockThreshold)
}