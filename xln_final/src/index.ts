// XLN Final - Entry point for revolutionary credit-line payment channels
// Testing the extracted consensus engine

import { processEntityInput, mergeEntityInputs } from './consensus/engine.js'
import type { 
  Env, 
  EntityReplica, 
  EntityInput, 
  ConsensusConfig,
  EntityState 
} from './types/consensus.js'

// === DEMO SETUP ===

const createDemoConfig = (): ConsensusConfig => ({
  mode: 'proposer-based',
  threshold: BigInt(2), // Need 2 out of 3 validators
  validators: ['alice', 'bob', 'charlie'],
  shares: {
    'alice': BigInt(1),
    'bob': BigInt(1), 
    'charlie': BigInt(1)
  }
})

const createDemoState = (): EntityState => ({
  height: 0,
  timestamp: Date.now(),
  nonces: new Map(),
  messages: [],
  proposals: new Map(),
  config: createDemoConfig()
})

const createDemoReplica = (signerId: string, isProposer: boolean): EntityReplica => ({
  entityId: 'demo-entity',
  signerId,
  state: createDemoState(),
  mempool: [],
  isProposer
})

const createDemoEnv = (): Env => ({
  replicas: new Map(),
  height: 0,
  timestamp: Date.now(),
  serverInput: {
    serverTxs: [],
    entityInputs: []
  }
})

// === DEMO EXECUTION ===

const runConsensusDemo = () => {
  console.log('🚀 XLN Final - Consensus Engine Demo')
  console.log('=====================================')
  
  const env = createDemoEnv()
  const aliceReplica = createDemoReplica('alice', true)  // Proposer
  const bobReplica = createDemoReplica('bob', false)     // Validator
  
  console.log('📝 Setup:')
  console.log(`  - Alice (proposer): ${aliceReplica.isProposer ? '✅' : '❌'}`)
  console.log(`  - Bob (validator): ${bobReplica.isProposer ? '✅' : '❌'}`)
  console.log(`  - Threshold: ${aliceReplica.state.config.threshold}`)
  console.log('')
  
  // Test 1: Add transactions to mempool
  console.log('🔄 Test 1: Adding transactions to mempool')
  const chatTx: EntityInput = {
    entityId: 'demo-entity',
    signerId: 'alice',
    entityTxs: [{
      type: 'chat',
      data: { from: 'alice', message: 'Hello XLN!' }
    }]
  }
  
  const result1 = processEntityInput(env, aliceReplica, chatTx)
  console.log(`  Result: ${result1.ok ? '✅' : '❌'} ${result1.ok ? `${result1.data.length} outputs` : result1.error}`)
  console.log(`  Alice mempool: ${aliceReplica.mempool.length} transactions`)
  console.log('')
  
  // Test 2: Auto-propose (Alice should create a proposal)
  console.log('🚀 Test 2: Auto-propose with mempool transactions')
  const emptyInput: EntityInput = {
    entityId: 'demo-entity',
    signerId: 'alice'
  }
  
  const result2 = processEntityInput(env, aliceReplica, emptyInput)
  console.log(`  Result: ${result2.ok ? '✅' : '❌'} ${result2.ok ? `${result2.data.length} outputs` : result2.error}`)
  console.log(`  Alice proposal: ${aliceReplica.proposal ? '✅' : '❌'}`)
  if (aliceReplica.proposal) {
    console.log(`  Frame hash: ${aliceReplica.proposal.hash}`)
    console.log(`  Signatures: ${aliceReplica.proposal.signatures.size}`)
  }
  console.log('')
  
  // Test 3: Test proposal and voting system
  console.log('🗳️  Test 3: Proposal and voting system')
  const proposalTx: EntityInput = {
    entityId: 'demo-entity',
    signerId: 'alice',
    entityTxs: [{
      type: 'propose',
      data: { 
        proposer: 'alice',
        action: {
          type: 'collective_message',
          data: { message: 'XLN will change everything!' }
        }
      }
    }]
  }
  
  const result3 = processEntityInput(env, aliceReplica, proposalTx)
  console.log(`  Result: ${result3.ok ? '✅' : '❌'} ${result3.ok ? `${result3.data.length} outputs` : result3.error}`)
  console.log(`  Proposals in state: ${aliceReplica.state.proposals.size}`)
  console.log(`  Messages in state: ${aliceReplica.state.messages.length}`)
  
  // Check if proposal was created or executed
  const proposals = Array.from(aliceReplica.state.proposals.values())
  if (proposals.length > 0) {
    const proposal = proposals[0]
    console.log(`  Proposal status: ${proposal.status}`)
    console.log(`  Proposal votes: ${proposal.votes.size}`)
  }
  console.log('')
  
  console.log('✅ Consensus engine with governance working!')
  console.log('📋 Next: Extract entity management and add EVM-compatible crypto')
}

// === RUN DEMO ===

runConsensusDemo()