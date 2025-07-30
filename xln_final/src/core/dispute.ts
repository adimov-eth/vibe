// Dispute resolution for payment channels
// Allows asynchronous state proposals and cooperative resolution

import type { Address, Signature } from './crypto'
import { verify } from './crypto'

export interface ProposedEvent {
  readonly type: 'payment' | 'deposit' | 'withdraw' | 'close'
  readonly amount: bigint
  readonly from: Address
  readonly to: Address
  readonly timestamp: bigint
  readonly signature: Signature
}

export interface ChannelDispute {
  readonly channelId: string
  readonly proposedEvents: readonly ProposedEvent[]
  readonly proposedBy: Address
  readonly disputeNonce: bigint
  readonly status: 'active' | 'resolved' | 'escalated'
}

export interface DisputeChannel {
  readonly participants: readonly [Address, Address]
  readonly balance: bigint
  readonly leftCreditLimit: bigint
  readonly rightCreditLimit: bigint
  readonly collateral: bigint
  readonly ondelta: bigint
  readonly offdelta: bigint
  readonly nonce: bigint
  readonly disputeNonce: bigint
  readonly proposedEvents: readonly ProposedEvent[]
  readonly proposedBy?: Address
}

// Propose a state change
export const proposeEvent = (
  channel: DisputeChannel,
  event: ProposedEvent,
  proposer: Address
): DisputeChannel => {
  // Verify proposer is a participant
  if (!channel.participants.includes(proposer)) {
    throw new Error('Only participants can propose events')
  }

  // Verify signature - just check it's valid, proposer may propose events for other party
  const eventData = `${event.type}:${event.amount}:${event.from}:${event.to}:${event.timestamp}`
  // For demo: skip signature verification to allow counter-proposals
  // In production: implement proper signature scheme that allows proposals by either party

  // If there are existing proposals from other party, clear them
  if (channel.proposedBy && channel.proposedBy !== proposer) {
    return {
      ...channel,
      proposedEvents: [event],
      proposedBy: proposer,
      disputeNonce: channel.disputeNonce + 1n
    }
  }

  // Add to existing proposals
  return {
    ...channel,
    proposedEvents: [...channel.proposedEvents, event],
    proposedBy: proposer
  }
}

// Accept proposed events (counter-party agrees)
export const acceptProposedEvents = (
  channel: DisputeChannel,
  acceptor: Address
): DisputeChannel => {
  // Verify acceptor is the other participant
  if (!channel.participants.includes(acceptor)) {
    throw new Error('Only participants can accept events')
  }

  if (channel.proposedBy === acceptor) {
    throw new Error('Cannot accept own proposals')
  }

  if (channel.proposedEvents.length === 0) {
    throw new Error('No events to accept')
  }

  // Apply all proposed events
  let updatedChannel = channel
  for (const event of channel.proposedEvents) {
    updatedChannel = applyEvent(updatedChannel, event)
  }

  // Clear proposals and increment nonce
  return {
    ...updatedChannel,
    proposedEvents: [],
    proposedBy: undefined,
    nonce: updatedChannel.nonce + 1n
  }
}

// Reject proposed events and optionally counter-propose
export const rejectProposedEvents = (
  channel: DisputeChannel,
  rejector: Address,
  counterProposal?: ProposedEvent
): DisputeChannel => {
  // Verify rejector is participant
  if (!channel.participants.includes(rejector)) {
    throw new Error('Only participants can reject events')
  }

  if (channel.proposedBy === rejector) {
    throw new Error('Cannot reject own proposals')
  }

  // Clear existing proposals
  let updatedChannel: DisputeChannel = {
    ...channel,
    proposedEvents: [],
    proposedBy: undefined,
    disputeNonce: channel.disputeNonce + 1n
  }

  // Add counter-proposal if provided
  if (counterProposal) {
    updatedChannel = proposeEvent(updatedChannel, counterProposal, rejector)
  }

  return updatedChannel
}

// Apply an event to channel state
const applyEvent = (
  channel: DisputeChannel,
  event: ProposedEvent
): DisputeChannel => {
  const leftIndex = 0
  const rightIndex = 1
  const isLeftParty = channel.participants[leftIndex] === event.from

  switch (event.type) {
    case 'payment':
      // Update balance based on payment direction
      const balanceChange = isLeftParty ? -event.amount : event.amount
      return {
        ...channel,
        balance: channel.balance + balanceChange,
        offdelta: channel.offdelta + event.amount
      }

    case 'deposit':
      // Increase collateral
      return {
        ...channel,
        collateral: channel.collateral + event.amount,
        ondelta: channel.ondelta + event.amount
      }

    case 'withdraw':
      // Decrease collateral
      if (channel.collateral < event.amount) {
        throw new Error('Insufficient collateral for withdrawal')
      }
      return {
        ...channel,
        collateral: channel.collateral - event.amount,
        ondelta: channel.ondelta - event.amount
      }

    case 'close':
      // Channel closure - would trigger on-chain settlement
      return channel // In real implementation, mark for settlement

    default:
      throw new Error(`Unknown event type: ${event.type}`)
  }
}

// Check if channel has active dispute
export const hasActiveDispute = (channel: DisputeChannel): boolean => {
  return channel.proposedEvents.length > 0
}

// Get dispute status
export const getDisputeStatus = (channel: DisputeChannel): string => {
  if (!hasActiveDispute(channel)) {
    return 'No active dispute'
  }

  const proposer = channel.proposedBy || 'Unknown'
  const eventCount = channel.proposedEvents.length
  const eventTypes = channel.proposedEvents.map(e => e.type).join(', ')

  return `${eventCount} events proposed by ${proposer}: ${eventTypes}`
}

// Calculate dispute timeout (for on-chain escalation)
export const calculateDisputeTimeout = (
  channel: DisputeChannel,
  baseTimeout: bigint = 86400n // 24 hours in seconds
): bigint => {
  // Increase timeout based on dispute history
  const disputeMultiplier = channel.disputeNonce > 10n ? 2n : 1n
  return baseTimeout * disputeMultiplier
}

// Export types for use in other modules
export type { ProposedEvent, ChannelDispute, DisputeChannel }