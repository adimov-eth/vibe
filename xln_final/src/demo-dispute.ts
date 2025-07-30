#!/usr/bin/env bun
// Demo: Dispute resolution in payment channels

import type { DisputeChannel, ProposedEvent } from './core/dispute'
import {
  proposeEvent,
  acceptProposedEvents,
  rejectProposedEvents,
  hasActiveDispute,
  getDisputeStatus,
  calculateDisputeTimeout
} from './core/dispute'
import { wallet, address, sign, type Address, type Signature } from './core/crypto'

// Create test channel with dispute support
const createTestChannel = (): DisputeChannel => {
  const alice = address(wallet('alice'))
  const bob = address(wallet('bob'))
  
  return {
    participants: [alice, bob],
    balance: 0n,
    leftCreditLimit: 1000n,
    rightCreditLimit: 500n,
    collateral: 2000n,
    ondelta: 2000n,
    offdelta: 0n,
    nonce: 0n,
    disputeNonce: 0n,
    proposedEvents: [],
    proposedBy: undefined
  }
}

// Demo: Cooperative state update
const demoCooperativeUpdate = async () => {
  console.log('\n=== Cooperative State Update ===')
  
  let channel = createTestChannel()
  const [alice, bob] = channel.participants
  
  // Alice proposes a payment
  const timestamp = BigInt(Date.now())
  const eventData = `payment:100:${alice}:${bob}:${timestamp}`
  const paymentEvent: ProposedEvent = {
    type: 'payment',
    amount: 100n,
    from: alice,
    to: bob,
    timestamp,
    signature: await sign(wallet('alice'), eventData)
  }
  
  console.log('Initial state:', {
    balance: channel.balance.toString(),
    nonce: channel.nonce.toString(),
    hasDispute: hasActiveDispute(channel)
  })
  
  // Alice proposes the payment
  channel = proposeEvent(channel, paymentEvent, alice)
  console.log('\nAfter Alice proposes:', getDisputeStatus(channel))
  
  // Bob accepts the proposal
  channel = acceptProposedEvents(channel, bob)
  console.log('\nAfter Bob accepts:', {
    balance: channel.balance.toString(),
    nonce: channel.nonce.toString(),
    hasDispute: hasActiveDispute(channel)
  })
}

// Demo: Disputed state with counter-proposal
const demoDisputedUpdate = async () => {
  console.log('\n=== Disputed State Update ===')
  
  let channel = createTestChannel()
  const [alice, bob] = channel.participants
  
  // Alice proposes a large withdrawal
  const timestamp1 = BigInt(Date.now())
  const withdrawData = `withdraw:1500:${alice}:${alice}:${timestamp1}`
  const withdrawEvent: ProposedEvent = {
    type: 'withdraw',
    amount: 1500n,
    from: alice,
    to: alice,
    timestamp: timestamp1,
    signature: await sign(wallet('alice'), withdrawData)
  }
  
  channel = proposeEvent(channel, withdrawEvent, alice)
  console.log('Alice proposes:', getDisputeStatus(channel))
  console.log('Dispute timeout:', calculateDisputeTimeout(channel).toString(), 'seconds')
  
  // Bob rejects and counter-proposes smaller amount
  const timestamp2 = BigInt(Date.now())
  const counterData = `withdraw:500:${alice}:${alice}:${timestamp2}`
  const counterProposal: ProposedEvent = {
    type: 'withdraw',
    amount: 500n,
    from: alice,
    to: alice,
    timestamp: timestamp2,
    signature: await sign(wallet('bob'), counterData)
  }
  
  channel = rejectProposedEvents(channel, bob, counterProposal)
  console.log('\nBob rejects and counter-proposes:', getDisputeStatus(channel))
  console.log('Dispute nonce increased to:', channel.disputeNonce.toString())
  
  // Alice accepts Bob's counter-proposal
  channel = acceptProposedEvents(channel, alice)
  console.log('\nAlice accepts counter-proposal:', {
    collateral: channel.collateral.toString(),
    ondelta: channel.ondelta.toString(),
    hasDispute: hasActiveDispute(channel)
  })
}

// Demo: Multiple proposals batched
const demoMultipleProposals = async () => {
  console.log('\n=== Multiple Proposals Batched ===')
  
  let channel = createTestChannel()
  const [alice, bob] = channel.participants
  
  // Alice proposes multiple operations
  const events: ProposedEvent[] = [
    {
      type: 'payment',
      amount: 50n,
      from: alice,
      to: bob,
      timestamp: BigInt(Date.now()),
      signature: await sign(wallet('alice'), 'payment1')
    },
    {
      type: 'payment',
      amount: 75n,
      from: alice,
      to: bob,
      timestamp: BigInt(Date.now() + 1),
      signature: await sign(wallet('alice'), 'payment2')
    },
    {
      type: 'deposit',
      amount: 200n,
      from: alice,
      to: alice,
      timestamp: BigInt(Date.now() + 2),
      signature: await sign(wallet('alice'), 'deposit')
    }
  ]
  
  // Propose all events
  for (const event of events) {
    channel = proposeEvent(channel, event, alice)
  }
  
  console.log('Alice proposes batch:', getDisputeStatus(channel))
  console.log('Total proposed events:', channel.proposedEvents.length)
  
  // Bob accepts all
  const before = {
    balance: channel.balance,
    collateral: channel.collateral
  }
  
  channel = acceptProposedEvents(channel, bob)
  
  console.log('\nAfter Bob accepts all:')
  console.log('- Balance changed by:', (channel.balance - before.balance).toString())
  console.log('- Collateral changed by:', (channel.collateral - before.collateral).toString())
  console.log('- Channel nonce:', channel.nonce.toString())
}

// Demo: Escalating disputes
const demoEscalatingDisputes = async () => {
  console.log('\n=== Escalating Disputes ===')
  
  let channel = createTestChannel()
  const [alice, bob] = channel.participants
  
  // Simulate multiple dispute rounds
  for (let i = 0; i < 5; i++) {
    const event: ProposedEvent = {
      type: 'payment',
      amount: BigInt(100 * (i + 1)),
      from: alice,
      to: bob,
      timestamp: BigInt(Date.now() + i),
      signature: await sign(wallet(i % 2 === 0 ? 'alice' : 'bob'), `dispute${i}`)
    }
    
    // Alternating proposals and rejections
    if (i % 2 === 0) {
      channel = proposeEvent(channel, event, alice)
      channel = rejectProposedEvents(channel, bob)
    } else {
      channel = proposeEvent(channel, event, bob)
      channel = rejectProposedEvents(channel, alice)
    }
  }
  
  console.log('After 5 dispute rounds:')
  console.log('- Dispute nonce:', channel.disputeNonce.toString())
  console.log('- Timeout:', calculateDisputeTimeout(channel).toString(), 'seconds')
  console.log('- Status:', hasActiveDispute(channel) ? 'Active dispute' : 'No dispute')
}

// Run all demos
const main = async () => {
  console.log('XLN Dispute Resolution Demo')
  console.log('===========================')
  
  await demoCooperativeUpdate()
  await demoDisputedUpdate()
  await demoMultipleProposals()
  await demoEscalatingDisputes()
  
  console.log('\n✓ Dispute resolution enables:')
  console.log('  - Asynchronous state proposals')
  console.log('  - Cooperative agreement on changes')
  console.log('  - Counter-proposals for negotiation')
  console.log('  - Batched operations for efficiency')
  console.log('  - Escalation tracking for on-chain fallback')
}

main()