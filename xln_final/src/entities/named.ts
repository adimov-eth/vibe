// Named entities - Premium, admin assignment required
// Extracted from xln/src/server.ts

import type { ConsensusConfig, JurisdictionConfig } from '../types/consensus.js'
import type { EntityCreationResult } from '../types/entities.js'
import { generateNamedEntityId } from './utils.js'

const DEBUG = true

/**
 * Create a named entity (premium, requires admin assignment)
 * Name must be assigned by system admin first
 */
export const createNamedEntity = (
  name: string,
  validators: string[],
  threshold: bigint,
  jurisdiction?: JurisdictionConfig
): EntityCreationResult => {
  const entityId = generateNamedEntityId(name)
  
  if (DEBUG) console.log(`🏷️ Creating named entity: "${name}"`)
  if (DEBUG) console.log(`   → Entity ID: ${entityId}`)
  if (DEBUG) console.log(`   → Validators: ${validators.join(', ')}`)
  if (DEBUG) console.log(`   → Threshold: ${threshold}`)

  // Create shares map (equal shares for named entities)
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
    type: 'named',
    metadata: {
      name: name
    }
  }
}

/**
 * Request named entity assignment from admin
 * This would interact with admin system in production
 */
export const requestNamedEntity = async (
  name: string,
  validators: string[],
  threshold: bigint,
  jurisdiction?: JurisdictionConfig
): Promise<string> => {
  if (DEBUG) console.log(`🏷️ Requesting named entity assignment`)
  if (DEBUG) console.log(`   → Name: "${name}"`)
  if (DEBUG) console.log(`   → Validators: ${validators.join(', ')}`)
  if (DEBUG) console.log(`   → Threshold: ${threshold}`)

  // Simulate admin request process
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  
  if (DEBUG) console.log(`   📝 Name assignment request submitted: ${requestId}`)
  if (DEBUG) console.log(`   ⏳ Waiting for admin approval...`)

  // In production, this would be an actual admin workflow
  return requestId
}

/**
 * Check status of named entity assignment request
 */
export const checkNamedEntityRequest = async (requestId: string): Promise<{
  status: 'pending' | 'approved' | 'rejected'
  entityResult?: EntityCreationResult
}> => {
  if (DEBUG) console.log(`🔍 Checking request status: ${requestId}`)

  // Simulate admin decision
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const approved = Math.random() > 0.3 // 70% approval rate for demo
  
  if (approved) {
    if (DEBUG) console.log(`   ✅ Request approved`)
    
    // Create mock entity for demo
    const entityResult = createNamedEntity(
      'demo-entity',
      ['alice', 'bob', 'charlie'],
      BigInt(2)
    )
    
    return {
      status: 'approved',
      entityResult
    }
  } else {
    if (DEBUG) console.log(`   ❌ Request rejected`)
    return { status: 'rejected' }
  }
}

/**
 * Resolve a named entity from blockchain
 * Would query name registry contract in production
 */
export const resolveNamedEntity = async (
  name: string
): Promise<EntityCreationResult | null> => {
  if (DEBUG) console.log(`🔍 Resolving named entity: "${name}"`)

  // Simulate blockchain lookup
  await new Promise(resolve => setTimeout(resolve, 50))

  // For demo purposes, return mock data
  // In production, this would query the name registry
  if (name === 'demo-entity') {
    return createNamedEntity(name, ['alice', 'bob', 'charlie'], BigInt(2))
  }

  if (DEBUG) console.log(`   ❌ Named entity not found: "${name}"`)
  return null
}