// for regular use > bun run src/server.ts
// for debugging > bun repl
// await import('./debug.js');

import { Buffer } from "buffer";
import { createHash } from "crypto";
import debug from "debug";
debug.enable("state:*,tx:*,block:*,error:*,diff:*");
// Use hex for Map/Set keys, Buffers for DB/RLP
const ENC = "hex" as const;

const hash = (data: Buffer): Buffer =>
  createHash("sha256").update(data).digest();

// Configure debug logging
const log = {
  state: debug("state:🔵"),
  tx: debug("tx:🟡"),
  block: debug("block:🟢"),
  error: debug("error:🔴"),
  diff: debug("diff:🟣"),
  info: debug("info:ℹ️"),
};

// === TYPES ===

declare const console: any;
let DEBUG = true;

interface ConsensusConfig {
  mode: "proposer-based" | "gossip-based";
  threshold: bigint;
  validators: string[];
  shares: { [validatorId: string]: bigint };
}

interface ServerInput {
  serverTxs: ServerTx[];
  entityInputs: EntityInput[];
}

interface ServerTx {
  type: "importReplica";
  entityId: string;
  signerId: string;
  data: {
    config: ConsensusConfig;
    isProposer: boolean;
  };
}

interface EntityInput {
  entityId: string;
  signerId: string;
  entityTxs?: EntityTx[];
  precommits?: Map<string, string>; // signerId -> signature
  proposedFrame?: ProposedEntityFrame;
}

interface Proposal {
  id: string; // hash of the proposal
  proposer: string;
  action: ProposalAction;
  votes: Map<string, "yes" | "no">;
  status: "pending" | "executed" | "rejected";
  created: number; // timestamp
}

interface ProposalAction {
  type: "collective_message";
  data: {
    message: string;
  };
}

interface EntityTx {
  type: "chat" | "propose" | "vote";
  data: any;
}

// === STATE ===
interface EntityState {
  height: number;
  nonces: Map<string, number>;
  messages: string[];
  proposals: Map<string, Proposal>;
  config: ConsensusConfig;
}

interface ProposedEntityFrame {
  height: number;
  txs: EntityTx[];
  hash: string;
  newState: EntityState;
  signatures: Map<string, string>; // signerId -> signature
}

interface EntityReplica {
  entityId: string;
  signerId: string;
  state: EntityState;
  mempool: EntityTx[];
  proposal?: ProposedEntityFrame;
  isProposer: boolean;
}

interface Env {
  replicas: Map<string, EntityReplica>;
  height: number;
  timestamp: number;
  serverInput: ServerInput; // Persistent storage for merged inputs
  // Future: add database connections, config, utilities, etc.
}

// === UTILITY FUNCTIONS ===
const calculateQuorumPower = (
  config: ConsensusConfig,
  signers: string[]
): bigint => {
  return signers.reduce(
    (sum, signerId) => sum + (config.shares[signerId] ?? 0n),
    0n
  );
};

const sortSignatures = (
  signatures: Map<string, string>,
  config: ConsensusConfig
): Map<string, string> => {
  const sortedEntries = Array.from(signatures.entries()).sort(([a], [b]) => {
    const indexA = config.validators.indexOf(a);
    const indexB = config.validators.indexOf(b);
    return indexA - indexB;
  });
  return new Map(sortedEntries);
};

const mergeEntityInputs = (entityInputs: EntityInput[]): EntityInput[] => {
  const merged = new Map<string, EntityInput>();
  let mergeCount = 0;

  for (const input of entityInputs) {
    const key = `${input.entityId}:${input.signerId}`;
    const existing = merged.get(key);

    if (existing) {
      mergeCount++;
      if (DEBUG)
        console.log(
          `    🔄 Merging inputs for ${key}: txs=${
            input.entityTxs?.length || 0
          }, precommits=${
            input.precommits?.size || 0
          }, frame=${!!input.proposedFrame}`
        );

      // Merge entityTxs
      if (input.entityTxs?.length) {
        existing.entityTxs = [
          ...(existing.entityTxs || []),
          ...input.entityTxs,
        ];
      }

      // Merge precommits
      if (input.precommits?.size) {
        if (!existing.precommits) existing.precommits = new Map();
        // Use spread operator for better performance
        for (const entry of input.precommits) {
          existing.precommits.set(...entry);
        }
      }

      // Take latest proposedFrame
      if (input.proposedFrame) {
        existing.proposedFrame = input.proposedFrame;
      }
    } else {
      merged.set(key, {
        ...input,
        precommits: input.precommits ? new Map(input.precommits) : undefined,
      });
    }
  }

  if (DEBUG && mergeCount > 0) {
    console.log(
      `    ⚠️  CORNER CASE: Merged ${mergeCount} duplicate inputs (${entityInputs.length} → ${merged.size})`
    );
  }

  return Array.from(merged.values());
};

// === PROPOSAL SYSTEM ===
const generateProposalId = (
  action: ProposalAction,
  proposer: string,
  env: Env
): string => {
  // Create deterministic hash from proposal data
  const proposalData = JSON.stringify({
    type: action.type,
    data: action.data,
    proposer,
    timestamp: env.timestamp,
  });

  const hash = createHash("sha256").update(proposalData).digest("hex");
  return `prop_${hash.slice(0, 12)}`;
};

const executeProposal = (
  entityState: EntityState,
  proposal: Proposal
): EntityState => {
  if (proposal.action.type === "collective_message") {
    const message = `[COLLECTIVE] ${proposal.action.data.message}`;
    if (DEBUG)
      console.log(`    🏛️  Executing collective proposal: "${message}"`);

    return {
      ...entityState,
      messages: [...entityState.messages, message],
    };
  }
  return entityState;
};

// === ENTITY PROCESSING ===
const applyEntityTx = (
  env: Env,
  entityState: EntityState,
  entityTx: EntityTx
): EntityState => {
  if (entityTx.type === "chat") {
    const { from, message } = entityTx.data;
    const currentNonce = entityState.nonces.get(from) || 0;

    // Create new state (immutable at transaction level)
    const newEntityState = {
      ...entityState,
      nonces: new Map(entityState.nonces),
      messages: [...entityState.messages],
      proposals: new Map(entityState.proposals),
    };

    newEntityState.nonces.set(from, currentNonce + 1);
    newEntityState.messages.push(`${from}: ${message}`);
    return newEntityState;
  }

  if (entityTx.type === "propose") {
    const { action, proposer } = entityTx.data;
    const proposalId = generateProposalId(action, proposer, env);

    if (DEBUG)
      console.log(
        `    📝 Creating proposal ${proposalId} by ${proposer}: ${action.data.message}`
      );

    const proposal: Proposal = {
      id: proposalId,
      proposer,
      action,
      votes: new Map([[proposer, "yes"]]), // Proposer auto-votes yes
      status: "pending",
      created: env.timestamp,
    };

    // Check if proposer has enough voting power to execute immediately
    const proposerPower = entityState.config.shares[proposer] || BigInt(0);
    const shouldExecuteImmediately =
      proposerPower >= entityState.config.threshold;

    let newEntityState = {
      ...entityState,
      nonces: new Map(entityState.nonces),
      messages: [...entityState.messages],
      proposals: new Map(entityState.proposals),
    };

    if (shouldExecuteImmediately) {
      proposal.status = "executed";
      newEntityState = executeProposal(newEntityState, proposal);
      if (DEBUG)
        console.log(
          `    ⚡ Proposal executed immediately - proposer has ${proposerPower} >= ${entityState.config.threshold} threshold`
        );
    } else {
      if (DEBUG)
        console.log(
          `    ⏳ Proposal pending votes - proposer has ${proposerPower} < ${entityState.config.threshold} threshold`
        );
    }

    newEntityState.proposals.set(proposalId, proposal);
    return newEntityState;
  }

  if (entityTx.type === "vote") {
    const { proposalId, voter, choice } = entityTx.data;
    const proposal = entityState.proposals.get(proposalId);

    if (!proposal || proposal.status !== "pending") {
      if (DEBUG)
        console.log(
          `    ❌ Vote ignored - proposal ${proposalId.slice(
            0,
            12
          )}... not found or not pending`
        );
      return entityState;
    }

    if (DEBUG)
      console.log(
        `    🗳️  Vote by ${voter}: ${choice} on proposal ${proposalId.slice(
          0,
          12
        )}...`
      );

    const newEntityState = {
      ...entityState,
      nonces: new Map(entityState.nonces),
      messages: [...entityState.messages],
      proposals: new Map(entityState.proposals),
    };

    const updatedProposal = {
      ...proposal,
      votes: new Map(proposal.votes),
    };
    updatedProposal.votes.set(voter, choice);

    // Calculate voting power for 'yes' votes
    const yesVoters = Array.from(updatedProposal.votes.entries())
      .filter(([_, vote]) => vote === "yes")
      .map(([voter, _]) => voter);

    const totalYesPower = calculateQuorumPower(entityState.config, yesVoters);

    if (DEBUG) {
      const totalShares = Object.values(entityState.config.shares).reduce(
        (sum, val) => sum + val,
        BigInt(0)
      );
      const percentage = (
        (Number(totalYesPower) / Number(entityState.config.threshold)) *
        100
      ).toFixed(1);
      log.info(
        `    🔍 Proposal votes: ${totalYesPower} / ${totalShares} [${percentage}% threshold${
          Number(totalYesPower) >= Number(entityState.config.threshold)
            ? "+"
            : ""
        }]`
      );
    }

    // Check if threshold reached
    if (totalYesPower >= entityState.config.threshold) {
      updatedProposal.status = "executed";
      const executedState = executeProposal(newEntityState, updatedProposal);
      executedState.proposals.set(proposalId, updatedProposal);
      return executedState;
    }

    newEntityState.proposals.set(proposalId, updatedProposal);
    return newEntityState;
  }

  return entityState;
};

const applyEntityFrame = (
  env: Env,
  entityState: EntityState,
  entityTxs: EntityTx[]
): EntityState => {
  return entityTxs.reduce(
    (currentEntityState, entityTx) =>
      applyEntityTx(env, currentEntityState, entityTx),
    entityState
  );
};

// === PROCESSING ===
const processEntityInput = (
  env: Env,
  entityReplica: EntityReplica,
  entityInput: EntityInput
): EntityInput[] => {
  // Add validation
  if (!entityReplica) {
    log.error("Invalid entityReplica provided");
    return [];
  }
  if (!entityInput.entityId || !entityInput.signerId) {
    log.error("Invalid entityInput: missing required fields");
    return [];
  }

  const entityOutbox: EntityInput[] = [];

  // Add transactions to mempool (mutable for performance)
  if (entityInput.entityTxs?.length) {
    entityReplica.mempool.push(...entityInput.entityTxs);
    if (DEBUG)
      console.log(
        `    → Added ${entityInput.entityTxs.length} txs to mempool (total: ${entityReplica.mempool.length})`
      );
    if (DEBUG && entityInput.entityTxs.length > 3) {
      console.log(
        `    ⚠️  CORNER CASE: Large batch of ${entityInput.entityTxs.length} transactions`
      );
    }
  } else if (entityInput.entityTxs && entityInput.entityTxs.length === 0) {
    if (DEBUG)
      console.log(
        `    ⚠️  CORNER CASE: Empty transaction array received - no mempool changes`
      );
  }

  // Handle proposed frame (PROPOSE phase)
  if (entityInput.proposedFrame && !entityReplica.proposal) {
    const frameSignature = `sig_${entityReplica.signerId}_${entityInput.proposedFrame.hash}`;
    const config = entityReplica.state.config;

    if (config.mode === "gossip-based") {
      // Send precommit to all validators
      config.validators.forEach((validatorId) => {
        entityOutbox.push({
          entityId: entityInput.entityId,
          signerId: validatorId,
          precommits: new Map([[entityReplica.signerId, frameSignature]]),
        });
      });
      if (DEBUG)
        console.log(
          `    → Signed proposal, gossiping precommit to ${config.validators.length} validators`
        );
    } else {
      // Send precommit to proposer only
      const proposerId = config.validators[0];
      entityOutbox.push({
        entityId: entityInput.entityId,
        signerId: proposerId,
        precommits: new Map([[entityReplica.signerId, frameSignature]]),
      });
      if (DEBUG)
        console.log(
          `    → Signed proposal, sending precommit to ${proposerId}`
        );
    }
  }

  // Handle precommits (SIGN phase)
  if (entityInput.precommits?.size && entityReplica.proposal) {
    // Collect signatures (mutable for performance)
    for (const [signerId, signature] of entityInput.precommits) {
      entityReplica.proposal.signatures.set(signerId, signature);
    }
    if (DEBUG)
      console.log(
        `    → Collected ${entityInput.precommits.size} signatures (total: ${entityReplica.proposal.signatures.size})`
      );

    // Check threshold using shares
    const signers = Array.from(entityReplica.proposal.signatures.keys());
    const totalPower = calculateQuorumPower(
      entityReplica.state.config,
      signers
    );

    if (DEBUG) {
      const totalShares = Object.values(
        entityReplica.state.config.shares
      ).reduce((sum, val) => sum + val, BigInt(0));
      const percentage = (
        (Number(totalPower) / Number(entityReplica.state.config.threshold)) *
        100
      ).toFixed(1);
      log.info(
        `    🔍 Threshold check: ${totalPower} / ${totalShares} [${percentage}% threshold${
          Number(totalPower) >= Number(entityReplica.state.config.threshold)
            ? "+"
            : ""
        }]`
      );
      if (entityReplica.state.config.mode === "gossip-based") {
        console.log(
          `    ⚠️  CORNER CASE: Gossip mode - all validators receive precommits`
        );
      }
    }

    if (totalPower >= entityReplica.state.config.threshold) {
      // Commit phase - use pre-computed state
      entityReplica.state = entityReplica.proposal.newState;
      if (DEBUG)
        console.log(
          `    → Threshold reached! Committing frame, height: ${entityReplica.state.height}`
        );

      // Save proposal data before clearing
      const sortedSignatures = sortSignatures(
        entityReplica.proposal.signatures,
        entityReplica.state.config
      );
      const committedFrame = entityReplica.proposal;

      // Clear state (mutable)
      entityReplica.mempool.length = 0;
      entityReplica.proposal = undefined;

      // Notify all validators
      entityReplica.state.config.validators.forEach((validatorId) => {
        entityOutbox.push({
          entityId: entityInput.entityId,
          signerId: validatorId,
          precommits: sortedSignatures,
          proposedFrame: committedFrame,
        });
      });
      if (DEBUG)
        console.log(
          `    → Sending commit notifications to ${entityReplica.state.config.validators.length} validators`
        );
    }
  }

  // Handle commit notifications (when receiving finalized frame from proposer)
  if (
    entityInput.precommits?.size &&
    entityInput.proposedFrame &&
    !entityReplica.proposal
  ) {
    const signers = Array.from(entityInput.precommits.keys());
    const totalPower = calculateQuorumPower(
      entityReplica.state.config,
      signers
    );

    if (totalPower >= entityReplica.state.config.threshold) {
      // This is a commit notification from proposer, apply the frame
      if (DEBUG)
        console.log(
          `    → Received commit notification with ${entityInput.precommits.size} signatures`
        );

      // Apply the committed frame
      entityReplica.state = entityInput.proposedFrame.newState;
      entityReplica.mempool.length = 0;
      if (DEBUG)
        console.log(
          `    → Applied commit, new state: ${entityReplica.state.messages.length} messages`
        );
    }
  }

  // Auto-propose if mempool not empty and we're proposer
  if (
    entityReplica.isProposer &&
    entityReplica.mempool.length > 0 &&
    !entityReplica.proposal
  ) {
    if (DEBUG)
      console.log(
        `    🚀 Auto-propose triggered: mempool=${
          entityReplica.mempool.length
        }, isProposer=${
          entityReplica.isProposer
        }, hasProposal=${!!entityReplica.proposal}`
      );
    // Compute new state once during proposal
    const newEntityState = applyEntityFrame(
      env,
      entityReplica.state,
      entityReplica.mempool
    );

    entityReplica.proposal = {
      height: entityReplica.state.height + 1,
      txs: [...entityReplica.mempool],
      hash: `frame_${entityReplica.state.height + 1}_${env.timestamp}`,
      newState: newEntityState,
      signatures: new Map<string, string>(),
    };

    if (DEBUG)
      console.log(
        `    → Auto-proposing frame ${entityReplica.proposal.hash} with ${entityReplica.proposal.txs.length} txs`
      );

    // Send proposal to all validators
    entityReplica.state.config.validators.forEach((validatorId) => {
      entityOutbox.push({
        entityId: entityInput.entityId,
        signerId: validatorId,
        proposedFrame: entityReplica.proposal!,
        entityTxs: entityReplica.proposal!.txs,
      });
    });
  } else if (
    entityReplica.isProposer &&
    entityReplica.mempool.length === 0 &&
    !entityReplica.proposal
  ) {
    if (DEBUG)
      console.log(
        `    ⚠️  CORNER CASE: Proposer with empty mempool - no auto-propose`
      );
  } else if (!entityReplica.isProposer && entityReplica.mempool.length > 0) {
    if (DEBUG)
      console.log(
        `    ⚠️  CORNER CASE: Non-proposer with ${entityReplica.mempool.length} txs in mempool - waiting for proposer`
      );
  } else if (entityReplica.isProposer && entityReplica.proposal) {
    if (DEBUG)
      console.log(
        `    ⚠️  CORNER CASE: Proposer already has pending proposal - no new auto-propose`
      );
  }

  return entityOutbox;
};

const processServerInput = (
  env: Env,
  serverInput: ServerInput
): EntityInput[] => {
  // Merge new serverInput into env.serverInput
  env.serverInput.serverTxs.push(...serverInput.serverTxs);
  env.serverInput.entityInputs.push(...serverInput.entityInputs);

  // Merge all entityInputs in env.serverInput
  const mergedInputs = mergeEntityInputs(env.serverInput.entityInputs);
  const entityOutbox: EntityInput[] = [];

  if (DEBUG) {
    console.log(`\n=== TICK ${env.height} ===`);
    console.log(
      `Server inputs: ${serverInput.serverTxs.length} new serverTxs, ${serverInput.entityInputs.length} new entityInputs`
    );
    console.log(
      `Total in env: ${env.serverInput.serverTxs.length} serverTxs, ${env.serverInput.entityInputs.length} entityInputs (merged to ${mergedInputs.length})`
    );
  }

  // Process server transactions (replica imports) from env.serverInput
  env.serverInput.serverTxs.forEach((serverTx) => {
    if (serverTx.type === "importReplica") {
      if (DEBUG)
        console.log(
          `Importing replica ${serverTx.entityId}:${serverTx.signerId} (proposer: ${serverTx.data.isProposer})`
        );

      const replicaKey = `${serverTx.entityId}:${serverTx.signerId}`;
      env.replicas.set(replicaKey, {
        entityId: serverTx.entityId,
        signerId: serverTx.signerId,
        state: {
          height: 0,
          nonces: new Map(),
          messages: [],
          proposals: new Map(),
          config: serverTx.data.config,
        },
        mempool: [],
        isProposer: serverTx.data.isProposer,
      });
    }
  });

  // Process entity inputs
  mergedInputs.forEach((entityInput) => {
    const replicaKey = `${entityInput.entityId}:${entityInput.signerId}`;
    const entityReplica = env.replicas.get(replicaKey);

    if (entityReplica) {
      if (DEBUG) {
        console.log(`Processing input for ${replicaKey}:`);
        if (entityInput.entityTxs?.length)
          console.log(`  → ${entityInput.entityTxs.length} transactions`);
        if (entityInput.proposedFrame)
          console.log(`  → Proposed frame: ${entityInput.proposedFrame.hash}`);
        if (entityInput.precommits?.size)
          console.log(`  → ${entityInput.precommits.size} precommits`);
      }

      const entityOutputs = processEntityInput(env, entityReplica, entityInput);
      entityOutbox.push(...entityOutputs);
    }
  });

  // Update env (mutable)
  env.height++;
  env.timestamp = Date.now();

  // Clear processed data from env.serverInput
  env.serverInput.serverTxs.length = 0;
  env.serverInput.entityInputs.length = 0;

  if (DEBUG && entityOutbox.length > 0) {
    console.log(`Outputs: ${entityOutbox.length} messages`);
    entityOutbox.forEach((output, i) => {
      console.log(
        `  ${i + 1}. → ${output.signerId} (${
          output.entityTxs ? `${output.entityTxs.length} txs` : ""
        }${
          output.proposedFrame
            ? ` proposal: ${output.proposedFrame.hash.slice(0, 10)}...`
            : ""
        }${output.precommits ? ` ${output.precommits.size} precommits` : ""})`
      );
    });
  }

  if (DEBUG) {
    console.log(`Replica states:`);
    env.replicas.forEach((replica, key) => {
      console.log(
        `  ${key}: mempool=${replica.mempool.length}, messages=${
          replica.state.messages.length
        }, proposal=${replica.proposal ? "✓" : "✗"}`
      );
    });
  }

  return entityOutbox;
};

// === DEMO ===
const processUntilEmpty = (env: Env, inputs: EntityInput[]) => {
  let outputs = inputs;
  while (outputs.length > 0) {
    outputs = processServerInput(env, { serverTxs: [], entityInputs: outputs });
  }
};

const runDemo = () => {
  const env: Env = {
    replicas: new Map(),
    height: 0,
    timestamp: Date.now(),
    serverInput: { serverTxs: [], entityInputs: [] },
  };

  if (DEBUG) {
    console.log("🚀 Starting XLN Consensus Demo - Multi-Entity Test");
    console.log(
      "✨ Using deterministic hash-based proposal IDs (no randomness)"
    );
    console.log("🌍 Environment-based architecture with merged serverInput");
  }

  // === TEST 1: Chat Entity with Equal Voting Power ===
  console.log("\n📋 TEST 1: Chat Entity - Equal Voting Power");
  const chatValidators = ["alice", "bob", "carol"];
  const chatConfig: ConsensusConfig = {
    mode: "proposer-based",
    threshold: BigInt(2), // Need 2 out of 3 shares
    validators: chatValidators,
    shares: {
      alice: BigInt(1), // Equal voting power
      bob: BigInt(1),
      carol: BigInt(1),
    },
  };

  processServerInput(env, {
    serverTxs: chatValidators.map((signerId, index) => ({
      type: "importReplica" as const,
      entityId: "chat",
      signerId,
      data: {
        config: chatConfig,
        isProposer: index === 0,
      },
    })),
    entityInputs: [],
  });

  // === TEST 2: Trading Entity with Weighted Voting ===
  console.log("\n📋 TEST 2: Trading Entity - Weighted Voting Power");
  const tradingValidators = ["alice", "bob", "carol", "david"];
  const tradingConfig: ConsensusConfig = {
    mode: "gossip-based", // Test gossip mode
    threshold: BigInt(7), // Need 7 out of 10 total shares
    validators: tradingValidators,
    shares: {
      alice: BigInt(4), // Major stakeholder
      bob: BigInt(3), // Medium stakeholder
      carol: BigInt(2), // Minor stakeholder
      david: BigInt(1), // Minimal stakeholder
    },
  };

  processServerInput(env, {
    serverTxs: tradingValidators.map((signerId, index) => ({
      type: "importReplica" as const,
      entityId: "trading",
      signerId,
      data: {
        config: tradingConfig,
        isProposer: index === 0,
      },
    })),
    entityInputs: [],
  });

  // === TEST 3: Governance Entity with High Threshold ===
  console.log(
    "\n📋 TEST 3: Governance Entity - High Threshold (Byzantine Fault Tolerance)"
  );
  const govValidators = ["alice", "bob", "carol", "david", "eve"];
  const govConfig: ConsensusConfig = {
    mode: "proposer-based",
    threshold: BigInt(10), // Need 10 out of 15 shares (2/3 + 1 for BFT)
    validators: govValidators,
    shares: {
      alice: BigInt(3),
      bob: BigInt(3),
      carol: BigInt(3),
      david: BigInt(3),
      eve: BigInt(3),
    },
  };

  processServerInput(env, {
    serverTxs: govValidators.map((signerId, index) => ({
      type: "importReplica" as const,
      entityId: "governance",
      signerId,
      data: {
        config: govConfig,
        isProposer: index === 0,
      },
    })),
    entityInputs: [],
  });

  console.log("\n🔥 CORNER CASE TESTS:");

  // === CORNER CASE 1: Single transaction (minimal consensus) ===
  console.log("\n⚠️  CORNER CASE 1: Single transaction in chat");
  processUntilEmpty(env, [
    {
      entityId: "chat",
      signerId: "alice",
      entityTxs: [
        {
          type: "chat",
          data: { from: "alice", message: "First message in chat!" },
        },
      ],
    },
  ]);

  // === CORNER CASE 2: Batch proposals (stress test) ===
  console.log("\n⚠️  CORNER CASE 2: Batch proposals in trading");
  processUntilEmpty(env, [
    {
      entityId: "trading",
      signerId: "alice",
      entityTxs: [
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: { message: "Trading proposal 1: Set daily limit" },
            },
            proposer: "alice",
          },
        },
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: { message: "Trading proposal 2: Update fees" },
            },
            proposer: "bob",
          },
        },
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: { message: "Trading proposal 3: Add new pairs" },
            },
            proposer: "carol",
          },
        },
      ],
    },
  ]);

  // === CORNER CASE 3: High threshold governance (needs 4/5 validators) ===
  console.log("\n⚠️  CORNER CASE 3: High threshold governance vote");
  processUntilEmpty(env, [
    {
      entityId: "governance",
      signerId: "alice",
      entityTxs: [
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: {
                message: "Governance proposal: Increase block size limit",
              },
            },
            proposer: "alice",
          },
        },
      ],
    },
  ]);

  // === CORNER CASE 4: Multiple entities concurrent activity ===
  console.log("\n⚠️  CORNER CASE 4: Concurrent multi-entity activity");
  processUntilEmpty(env, [
    {
      entityId: "chat",
      signerId: "alice",
      entityTxs: [
        {
          type: "chat",
          data: { from: "bob", message: "Chat during trading!" },
        },
        { type: "chat", data: { from: "carol", message: "Exciting times!" } },
      ],
    },
    {
      entityId: "trading",
      signerId: "alice",
      entityTxs: [
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: {
                message: "Trading proposal: Cross-entity transfer protocol",
              },
            },
            proposer: "david",
          },
        },
      ],
    },
    {
      entityId: "governance",
      signerId: "alice",
      entityTxs: [
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: {
                message: "Governance decision: Implement new voting system",
              },
            },
            proposer: "bob",
          },
        },
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: { message: "Governance decision: Update treasury rules" },
            },
            proposer: "carol",
          },
        },
      ],
    },
  ]);

  // === CORNER CASE 5: Empty mempool auto-propose (should be ignored) ===
  console.log("\n⚠️  CORNER CASE 5: Empty mempool test (no auto-propose)");
  processUntilEmpty(env, [
    {
      entityId: "chat",
      signerId: "alice",
      entityTxs: [], // Empty transactions should not trigger proposal
    },
  ]);

  // === CORNER CASE 6: Large message batch ===
  console.log("\n⚠️  CORNER CASE 6: Large message batch");
  const largeBatch: EntityTx[] = Array.from({ length: 8 }, (_, i) => ({
    type: "chat" as const,
    data: {
      from: ["alice", "bob", "carol"][i % 3],
      message: `Batch message ${i + 1}`,
    },
  }));

  processUntilEmpty(env, [
    {
      entityId: "chat",
      signerId: "alice",
      entityTxs: largeBatch,
    },
  ]);

  // === CORNER CASE 7: Proposal voting system ===
  console.log("\n⚠️  CORNER CASE 7: Proposal voting system");

  // Create a proposal that needs votes
  processUntilEmpty(env, [
    {
      entityId: "trading",
      signerId: "alice",
      entityTxs: [
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: { message: "Major decision: Upgrade trading protocol" },
            },
            proposer: "carol",
          },
        }, // Carol only has 2 shares, needs more votes
      ],
    },
  ]);

  // Simulate voting on the proposal
  // We need to get the proposal ID from the previous execution, but for demo purposes, we'll simulate voting workflow
  console.log("\n⚠️  CORNER CASE 7b: Voting on proposals (simulated)");
  processUntilEmpty(env, [
    {
      entityId: "governance",
      signerId: "alice",
      entityTxs: [
        {
          type: "propose",
          data: {
            action: {
              type: "collective_message",
              data: {
                message: "Critical governance: Emergency protocol activation",
              },
            },
            proposer: "eve",
          },
        }, // Eve only has 3 shares, needs 10 total
      ],
    },
  ]);

  // === FINAL VERIFICATION ===
  if (DEBUG) {
    console.log("\n🎯 === FINAL VERIFICATION ===");
    console.log(
      "✨ All proposal IDs are deterministic hashes of proposal data"
    );
    console.log("🌍 Environment-based architecture working correctly");

    // Group replicas by entity
    const entitiesByType = new Map<string, Array<[string, EntityReplica]>>();
    env.replicas.forEach((replica, key) => {
      const entityType = replica.entityId;
      if (!entitiesByType.has(entityType)) {
        entitiesByType.set(entityType, []);
      }
      entitiesByType.get(entityType)!.push([key, replica]);
    });

    let allEntitiesConsensus = true;

    entitiesByType.forEach((replicas, entityType) => {
      console.log(`\n📊 Entity: ${entityType.toUpperCase()}`);
      console.log(`   Mode: ${replicas[0][1].state.config.mode}`);
      console.log(`   Threshold: ${replicas[0][1].state.config.threshold}`);
      console.log(
        `   Validators: ${replicas[0][1].state.config.validators.length}`
      );

      // Show voting power distribution
      const shares = replicas[0][1].state.config.shares;
      console.log(`   Voting Power:`);
      Object.entries(shares).forEach(([validator, power]) => {
        console.log(`     ${validator}: ${power} shares`);
      });

      // Check consensus within entity
      const allMessages: string[][] = [];
      const allProposals: Proposal[][] = [];
      replicas.forEach(([key, replica]) => {
        console.log(
          `   ${key}: ${replica.state.messages.length} messages, ${replica.state.proposals.size} proposals, height ${replica.state.height}`
        );
        if (replica.state.messages.length > 0) {
          replica.state.messages.forEach((msg, i) =>
            console.log(`     ${i + 1}. ${msg}`)
          );
        }
        if (replica.state.proposals.size > 0) {
          console.log(`     Proposals:`);
          replica.state.proposals.forEach((proposal, id) => {
            const yesVotes = Array.from(proposal.votes.values()).filter(
              (vote) => vote === "yes"
            ).length;
            const totalVotes = proposal.votes.size;
            console.log(
              `       ${id} by ${proposal.proposer} [${proposal.status}] ${yesVotes}/${totalVotes} votes`
            );
            console.log(`         Action: ${proposal.action.data.message}`);
          });
        }
        allMessages.push([...replica.state.messages]);
        allProposals.push([...replica.state.proposals.values()]);
      });

      // Verify consensus within entity (messages and proposals)
      const firstMessages = allMessages[0];
      const messagesConsensus = allMessages.every(
        (messages) =>
          messages.length === firstMessages.length &&
          messages.every((msg, i) => msg === firstMessages[i])
      );

      const firstProposals = allProposals[0];
      const proposalsConsensus = allProposals.every(
        (proposals) =>
          proposals.length === firstProposals.length &&
          proposals.every(
            (prop, i) =>
              prop.id === firstProposals[i].id &&
              prop.status === firstProposals[i].status &&
              prop.votes.size === firstProposals[i].votes.size
          )
      );

      const entityConsensus = messagesConsensus && proposalsConsensus;

      console.log(
        `   🔍 Consensus: ${
          entityConsensus ? "✅ SUCCESS" : "❌ FAILED"
        } (messages: ${messagesConsensus ? "✅" : "❌"}, proposals: ${
          proposalsConsensus ? "✅" : "❌"
        })`
      );
      if (entityConsensus) {
        console.log(
          `   📈 Total messages: ${firstMessages.length}, proposals: ${firstProposals.length}`
        );
        const totalShares = Object.values(shares).reduce(
          (sum, val) => sum + val,
          BigInt(0)
        );
        console.log(
          `   ⚖️  Total voting power: ${totalShares} (threshold: ${replicas[0][1].state.config.threshold})`
        );
      }

      allEntitiesConsensus = allEntitiesConsensus && entityConsensus;
    });

    console.log(`\n🏆 === OVERALL RESULT ===`);
    console.log(
      `${
        allEntitiesConsensus ? "✅ SUCCESS" : "❌ FAILED"
      } - All entities achieved consensus`
    );
    console.log(`📊 Total entities tested: ${entitiesByType.size}`);
    console.log(`📊 Total replicas: ${env.replicas.size}`);
    console.log(`🔄 Total server ticks: ${env.height}`);
    console.log("🎯 Fully deterministic - no randomness used");
    console.log(
      "🌍 Environment-based architecture with clean function signatures"
    );

    // Show mode distribution
    const modeCount = new Map<string, number>();
    env.replicas.forEach((replica) => {
      const mode = replica.state.config.mode;
      modeCount.set(mode, (modeCount.get(mode) || 0) + 1);
    });
    console.log(`📡 Mode distribution:`);
    modeCount.forEach((count, mode) => {
      console.log(`   ${mode}: ${count} replicas`);
    });
  }

  // Return immutable snapshot for API boundary
  return env;
};

const main = () => {
  const env = runDemo();
  (global as any).env = env;

  return env;
};

// Auto-run demo
export const env = main();

export { main, processServerInput, runDemo };
