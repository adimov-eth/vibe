// XLN Collateral Management - On-chain/Off-chain State Split
// Tracks on-chain collateral separately from off-chain channel state

import type { Address, Hash } from './channels.js'
import type { MultiAssetChannel, AssetId, Delta } from './multi-asset-channels.js'

// Collateral operation types
export interface DepositCollateral {
  readonly channel: MultiAssetChannel
  readonly participant: Address
  readonly tokenId: AssetId
  readonly amount: bigint
}

export interface WithdrawCollateral {
  readonly channel: MultiAssetChannel
  readonly participant: Address
  readonly tokenId: AssetId
  readonly amount: bigint
}

// Deposit collateral on-chain (increases ondelta)
export const depositCollateral = (params: DepositCollateral): MultiAssetChannel | null => {
  const { channel, participant, tokenId, amount } = params
  
  // Validate participant
  const participantIdx = channel.participants.indexOf(participant)
  if (participantIdx === -1) return null
  
  // Find asset delta
  const deltaIdx = channel.deltas.findIndex(d => d.tokenId === tokenId)
  if (deltaIdx === -1) return null
  
  // Update ondelta for this participant
  const delta = channel.deltas[deltaIdx]
  const newOndelta = participantIdx === 0 
    ? delta.ondelta + amount  // Left participant deposits
    : delta.ondelta - amount  // Right participant deposits (negative)
  
  // Create new delta with updated ondelta
  const newDelta: Delta = {
    ...delta,
    ondelta: newOndelta,
    collateral: delta.collateral + amount  // Total collateral increases
  }
  
  // Update channel
  const newDeltas = [...channel.deltas]
  newDeltas[deltaIdx] = newDelta
  
  return {
    ...channel,
    deltas: newDeltas,
    nonce: channel.nonce + 1n,
    signatures: [undefined, undefined]  // Reset signatures
  }
}

// Withdraw collateral (decreases ondelta)
export const withdrawCollateral = (params: WithdrawCollateral): MultiAssetChannel | null => {
  const { channel, participant, tokenId, amount } = params
  
  // Validate participant
  const participantIdx = channel.participants.indexOf(participant)
  if (participantIdx === -1) return null
  
  // Find asset delta
  const deltaIdx = channel.deltas.findIndex(d => d.tokenId === tokenId)
  if (deltaIdx === -1) return null
  
  const delta = channel.deltas[deltaIdx]
  
  // Check if withdrawal is safe
  // Can only withdraw if it doesn't make channel undercollateralized
  const participantOndelta = participantIdx === 0 ? delta.ondelta : -delta.ondelta
  if (participantOndelta < amount) return null  // Not enough collateral
  
  // Check that remaining collateral covers off-chain obligations
  const newOndelta = participantIdx === 0 
    ? delta.ondelta - amount
    : delta.ondelta + amount
    
  // Ensure channel remains solvent after withdrawal
  const totalCollateralAfter = delta.collateral - amount
  const maxPossibleDebt = delta.leftCreditLimit > delta.rightCreditLimit 
    ? delta.leftCreditLimit 
    : delta.rightCreditLimit
  
  if (totalCollateralAfter < 0n) return null  // Can't have negative collateral
  
  // Create new delta
  const newDelta: Delta = {
    ...delta,
    ondelta: newOndelta,
    collateral: totalCollateralAfter
  }
  
  // Update channel
  const newDeltas = [...channel.deltas]
  newDeltas[deltaIdx] = newDelta
  
  return {
    ...channel,
    deltas: newDeltas,
    nonce: channel.nonce + 1n,
    signatures: [undefined, undefined]
  }
}

// Get available balance including collateral
export const getAvailableBalance = (
  channel: MultiAssetChannel,
  participant: Address,
  tokenId: AssetId
): bigint => {
  const participantIdx = channel.participants.indexOf(participant)
  if (participantIdx === -1) return 0n
  
  const delta = channel.deltas.find(d => d.tokenId === tokenId)
  if (!delta) return 0n
  
  // Available = on-chain collateral + off-chain balance + credit limit
  const ondeltaForParticipant = participantIdx === 0 ? delta.ondelta : -delta.ondelta
  const offdeltaForParticipant = participantIdx === 0 ? delta.offdelta : -delta.offdelta
  const creditLimit = participantIdx === 0 ? delta.rightCreditLimit : delta.leftCreditLimit
  
  return ondeltaForParticipant + offdeltaForParticipant + creditLimit
}

// Check if channel is fully collateralized
export const isFullyCollateralized = (
  channel: MultiAssetChannel,
  tokenId: AssetId
): boolean => {
  const delta = channel.deltas.find(d => d.tokenId === tokenId)
  if (!delta) return false
  
  // Channel is fully collateralized if total collateral covers all possible debts
  const maxDebt = delta.leftCreditLimit + delta.rightCreditLimit
  return delta.collateral >= maxDebt
}

// Get collateralization ratio (collateral / credit extended)
export const getCollateralizationRatio = (
  channel: MultiAssetChannel,
  tokenId: AssetId
): number => {
  const delta = channel.deltas.find(d => d.tokenId === tokenId)
  if (!delta) return 0
  
  const totalCredit = delta.leftCreditLimit + delta.rightCreditLimit
  if (totalCredit === 0n) return Infinity
  
  return Number(delta.collateral * 100n / totalCredit) / 100
}

// Settlement: Move off-chain state to on-chain
export const settleChannel = (
  channel: MultiAssetChannel,
  tokenId: AssetId
): MultiAssetChannel | null => {
  const deltaIdx = channel.deltas.findIndex(d => d.tokenId === tokenId)
  if (deltaIdx === -1) return null
  
  const delta = channel.deltas[deltaIdx]
  
  // Settlement moves offdelta to ondelta
  const newDelta: Delta = {
    ...delta,
    ondelta: delta.ondelta + delta.offdelta,
    offdelta: 0n  // Reset off-chain balance after settlement
  }
  
  const newDeltas = [...channel.deltas]
  newDeltas[deltaIdx] = newDelta
  
  return {
    ...channel,
    deltas: newDeltas,
    nonce: channel.nonce + 1n,
    signatures: [undefined, undefined]
  }
}