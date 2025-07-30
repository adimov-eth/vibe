// XLN Byzantine Consensus Engine
// 4-phase BFT: ADD_TX → PROPOSE → SIGN → COMMIT
// Enables distributed agreement on state transitions

import { hash } from "../core/crypto";

// === CORE TYPES ===

export interface ConsensusConfig {
  mode: "proposer-based" | "gossip-based";
  threshold: bigint; // Voting power needed to commit
  validators: string[]; // List of validator IDs
  shares: Record<string, bigint>; // Voting power per validator
}

export interface ConsensusState {
  height: number;
  stateRoot: string;
  // Application-specific state goes here
  // Consensus doesn't care about the content
}

export interface Transaction {
  type: string;
  data: any;
  nonce: number;
  signature?: string;
}

export interface ProposedFrame {
  height: number;
  txs: Transaction[];
  hash: string;
  newState: ConsensusState;
  signatures: Map<string, string>;
}

export interface Replica {
  signerId: string;
  state: ConsensusState;
  mempool: Transaction[];
  proposal?: ProposedFrame;
  isProposer: boolean;
  config: ConsensusConfig;
}

export interface ConsensusMessage {
  phase: "ADD_TX" | "PROPOSE" | "SIGN" | "COMMIT";
  signerId: string;
  data: any;
}

// === CONSENSUS LOGIC ===

// Calculate total voting power for a set of signers
function calculateQuorumPower(
  config: ConsensusConfig,
  signers: string[]
): bigint {
  return signers.reduce(
    (total, signer) => total + (config.shares[signer] || 0n),
    0n
  );
}

// Apply state transition (delegate to application layer)
function applyTransactions(
  state: ConsensusState,
  txs: Transaction[]
): ConsensusState {
  // Application must implement actual state transition
  // Consensus only ensures agreement
  return {
    ...state,
    height: state.height + 1,
    stateRoot: hash(JSON.stringify({ state, txs })),
  };
}

// Main consensus state machine
export function processConsensusMessage(
  replica: Replica,
  message: ConsensusMessage
): ConsensusMessage[] {
  const outbox: ConsensusMessage[] = [];

  switch (message.phase) {
    case "ADD_TX":
      // Phase 1: Add transactions to mempool
      const { transactions } = message.data;
      replica.mempool.push(...transactions);

      // Auto-propose if we're proposer with non-empty mempool
      if (replica.isProposer && replica.mempool.length > 0 && !replica.proposal) {
        const newState = applyTransactions(replica.state, replica.mempool);
        
        const frameHash = hash(JSON.stringify({ height: newState.height, txs: replica.mempool }));
        const proposerSignature = `sig_${replica.signerId}_${frameHash}`;
        
        replica.proposal = {
          height: replica.state.height + 1,
          txs: [...replica.mempool],
          hash: frameHash,
          newState,
          signatures: new Map([[replica.signerId, proposerSignature]]), // Proposer signs own proposal
        };

        // Broadcast proposal to all validators
        replica.config.validators.forEach(validator => {
          outbox.push({
            phase: "PROPOSE",
            signerId: validator,
            data: { frame: replica.proposal },
          });
        });
      }
      break;

    case "PROPOSE":
      // Phase 2: Receive proposal, validate and sign
      const { frame } = message.data;
      
      if (!replica.proposal && frame.height === replica.state.height + 1) {
        // Verify proposal is valid (application-specific validation here)
        const signature = `sig_${replica.signerId}_${frame.hash}`;
        
        if (replica.config.mode === "gossip-based") {
          // Gossip signature to all validators
          replica.config.validators.forEach(validator => {
            outbox.push({
              phase: "SIGN",
              signerId: validator,
              data: { 
                frameHash: frame.hash,
                signatures: new Map([[replica.signerId, signature]])
              },
            });
          });
        } else {
          // Send signature to proposer only
          const proposerId = replica.config.validators[0];
          outbox.push({
            phase: "SIGN",
            signerId: proposerId,
            data: { 
              frameHash: frame.hash,
              signatures: new Map([[replica.signerId, signature]])
            },
          });
        }

        // Store proposal for commit phase
        replica.proposal = frame;
      }
      break;

    case "SIGN":
      // Phase 3: Collect signatures, check threshold
      const { frameHash, signatures } = message.data;
      
      if (replica.proposal && replica.proposal.hash === frameHash) {
        // Collect signatures
        for (const [signer, sig] of signatures) {
          replica.proposal.signatures.set(signer, sig);
        }

        // Check if threshold reached
        const signers = Array.from(replica.proposal.signatures.keys());
        const totalPower = calculateQuorumPower(replica.config, signers);

        if (totalPower >= replica.config.threshold) {
          // Threshold reached - commit the frame
          replica.state = replica.proposal.newState;
          const committedFrame = replica.proposal;
          
          // Clear state
          replica.mempool.length = 0;
          replica.proposal = undefined;

          // Notify all validators of commit
          replica.config.validators.forEach(validator => {
            outbox.push({
              phase: "COMMIT",
              signerId: validator,
              data: { 
                frame: committedFrame,
                signatures: committedFrame.signatures
              },
            });
          });
        }
      }
      break;

    case "COMMIT":
      // Phase 4: Apply committed frame
      const { frame: committedFrame, signatures: commitSigs } = message.data;
      
      // Verify signatures meet threshold
      const commitSigners = Array.from(commitSigs.keys()) as string[];
      const commitPower = calculateQuorumPower(replica.config, commitSigners);
      
      if (commitPower >= replica.config.threshold && 
          committedFrame.height === replica.state.height + 1) {
        // Apply the committed state
        replica.state = committedFrame.newState;
        replica.mempool.length = 0;
        replica.proposal = undefined;
      }
      break;
  }

  return outbox;
}

// === CONSENSUS SETUP ===

export function createReplica(
  signerId: string,
  config: ConsensusConfig,
  initialState: ConsensusState,
  isProposer: boolean = false
): Replica {
  return {
    signerId,
    state: initialState,
    mempool: [],
    proposal: undefined,
    isProposer: isProposer || config.validators[0] === signerId,
    config,
  };
}

// Run consensus until no more messages
export function runConsensusRound(
  replicas: Map<string, Replica>,
  initialMessages: ConsensusMessage[]
): void {
  let messages = [...initialMessages];
  
  while (messages.length > 0) {
    const newMessages: ConsensusMessage[] = [];
    
    for (const message of messages) {
      const replica = replicas.get(message.signerId);
      if (replica) {
        const outbox = processConsensusMessage(replica, message);
        newMessages.push(...outbox);
      }
    }
    
    messages = newMessages;
  }
}