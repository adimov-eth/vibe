// Core consensus types extracted from xln/src/server.ts
// Following pragmatic domain-driven structure

export interface JurisdictionConfig {
  address: string
  name: string
  entityProviderAddress: string
  depositoryAddress: string
  chainId?: number
}

export interface ConsensusConfig {
  mode: 'proposer-based' | 'gossip-based'
  threshold: bigint
  validators: string[]
  shares: { [validatorId: string]: bigint }
  jurisdiction?: JurisdictionConfig
}

export interface EntityTx {
  type: 'chat' | 'propose' | 'vote'
  data: any
}

export interface EntityState {
  height: number
  timestamp: number
  nonces: Map<string, number>
  messages: string[]
  proposals: Map<string, Proposal>
  config: ConsensusConfig
}

export interface Proposal {
  id: string
  proposer: string
  action: ProposalAction
  votes: Map<string, 'yes' | 'no'>
  status: 'pending' | 'executed' | 'rejected'
  created: number
}

export interface ProposalAction {
  type: 'collective_message'
  data: {
    message: string
  }
}

export interface ProposedEntityFrame {
  height: number
  txs: EntityTx[]
  hash: string
  newState: EntityState
  signatures: Map<string, string>
}

export interface EntityInput {
  entityId: string
  signerId: string
  entityTxs?: EntityTx[]
  precommits?: Map<string, string>
  proposedFrame?: ProposedEntityFrame
}

export interface EntityReplica {
  entityId: string
  signerId: string
  state: EntityState
  mempool: EntityTx[]
  proposal?: ProposedEntityFrame
  lockedFrame?: ProposedEntityFrame
  isProposer: boolean
}

export interface Env {
  replicas: Map<string, EntityReplica>
  height: number
  timestamp: number
  serverInput: ServerInput
}

export interface ServerInput {
  serverTxs: ServerTx[]
  entityInputs: EntityInput[]
}

export interface ServerTx {
  type: 'importReplica'
  entityId: string
  signerId: string
  data: {
    config: ConsensusConfig
    isProposer: boolean
  }
}

// Result type for consensus operations
export type ConsensusResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string; context?: string }