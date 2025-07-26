// Entity types and interfaces extracted from xln/src/server.ts

import type { ConsensusConfig, JurisdictionConfig } from './consensus.js'

export type EntityType = 'lazy' | 'numbered' | 'named'

export interface EntityResolution {
  entityId: string
  type: EntityType
}

export interface EntityCreationResult {
  entityId: string
  config: ConsensusConfig
  type: EntityType
  metadata?: {
    number?: number
    name?: string
    hash?: string
  }
}