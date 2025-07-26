// Entity manager - Unified interface for all entity types
// Extracted and organized from xln/src/server.ts

import type { EntityResolution, EntityCreationResult } from '../types/entities.js'
import type { JurisdictionConfig } from '../types/consensus.js'
import { detectEntityType } from './utils.js'
import { createLazyEntity, resolveLazyEntity } from './lazy.js'
import { createNumberedEntity, requestNumberedEntity, resolveNumberedEntity } from './numbered.js'
import { createNamedEntity, requestNamedEntity, resolveNamedEntity } from './named.js'

const DEBUG = true

/**
 * Unified entity resolution - determines type and resolves configuration
 */
export const resolveEntityIdentifier = async (identifier: string): Promise<EntityResolution> => {
  const type = detectEntityType(identifier)
  
  if (DEBUG) console.log(`🔍 Resolving entity identifier: ${identifier}`)
  if (DEBUG) console.log(`   → Detected type: ${type}`)

  return {
    entityId: identifier,
    type
  }
}

/**
 * Create entity of specified type with given parameters
 */
export const createEntity = async (
  type: 'lazy' | 'numbered' | 'named',
  params: {
    name?: string
    number?: number
    validators: string[]
    threshold: bigint
    jurisdiction?: JurisdictionConfig
  }
): Promise<EntityCreationResult> => {
  if (DEBUG) console.log(`🏗️ Creating ${type} entity`)

  switch (type) {
    case 'lazy':
      if (!params.name) throw new Error('Lazy entities require a name')
      return createLazyEntity(params.name, params.validators, params.threshold, params.jurisdiction)
    
    case 'numbered':
      if (params.number !== undefined) {
        return createNumberedEntity(params.number, params.validators, params.threshold, params.jurisdiction)
      } else {
        return await requestNumberedEntity(params.validators, params.threshold, params.jurisdiction)
      }
    
    case 'named':
      if (!params.name) throw new Error('Named entities require a name')
      return createNamedEntity(params.name, params.validators, params.threshold, params.jurisdiction)
    
    default:
      throw new Error(`Unknown entity type: ${type}`)
  }
}

/**
 * Resolve entity configuration from identifier
 */
export const resolveEntityConfig = async (entityId: string): Promise<EntityCreationResult | null> => {
  const resolution = await resolveEntityIdentifier(entityId)
  
  if (DEBUG) console.log(`🔧 Resolving config for ${resolution.type} entity: ${entityId}`)

  switch (resolution.type) {
    case 'lazy':
      // For lazy entities, we need additional info to resolve the config
      // This would come from the entity usage context in production
      if (DEBUG) console.log(`   ⚠️ Lazy entity resolution requires validator list - using mock data`)
      return resolveLazyEntity(entityId, ['alice', 'bob', 'charlie'], BigInt(2))
    
    case 'numbered':
      return await resolveNumberedEntity(entityId)
    
    case 'named':
      // Extract name from the entity ID (this is simplified for demo)
      // In production, there would be a reverse lookup
      if (DEBUG) console.log(`   ⚠️ Named entity resolution requires name lookup - using mock data`)
      return await resolveNamedEntity('demo-entity')
    
    default:
      if (DEBUG) console.log(`   ❌ Unknown entity type: ${resolution.type}`)
      return null
  }
}

/**
 * Get entity creation cost and requirements
 */
export const getEntityRequirements = (type: 'lazy' | 'numbered' | 'named') => {
  switch (type) {
    case 'lazy':
      return {
        cost: 'Free',
        speed: 'Instant',
        requirements: ['Validator consensus configuration'],
        description: 'Deterministic hash-based entities, no blockchain interaction required'
      }
    
    case 'numbered':
      return {
        cost: 'Gas fees',
        speed: '~15 seconds (block confirmation)',
        requirements: ['Blockchain transaction', 'EntityProvider contract interaction'],
        description: 'On-chain registered entities with sequential numbering'
      }
    
    case 'named':
      return {
        cost: 'Premium + admin approval',
        speed: '1-3 business days',
        requirements: ['Admin approval', 'Name availability check', 'Premium payment'],
        description: 'Human-readable named entities with admin curation'
      }
    
    default:
      throw new Error(`Unknown entity type: ${type}`)
  }
}

/**
 * Validate entity configuration
 */
export const validateEntityConfig = (
  validators: string[],
  threshold: bigint
): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  if (validators.length === 0) {
    errors.push('At least one validator required')
  }

  if (threshold <= 0n) {
    errors.push('Threshold must be positive')
  }

  if (threshold > BigInt(validators.length)) {
    errors.push('Threshold cannot exceed number of validators')
  }

  // Check for duplicate validators
  const uniqueValidators = new Set(validators)
  if (uniqueValidators.size !== validators.length) {
    errors.push('Duplicate validators not allowed')
  }

  // Validate validator format (should be addresses or identifiers)
  validators.forEach((validator, index) => {
    if (!validator || validator.trim().length === 0) {
      errors.push(`Validator ${index + 1} is empty`)
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

// Export for convenient access to all entity creation methods
export {
  createLazyEntity,
  createNumberedEntity,
  createNamedEntity,
  requestNumberedEntity,
  requestNamedEntity
}