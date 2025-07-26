// Simple crypto utilities for XLN Final
// Replaces ethers.js dependency with Node.js crypto

import { createHash } from 'crypto'

export const keccak256 = (data: string): string => {
  // Use SHA-256 as fallback for keccak256 in demo
  // TODO: Use proper keccak256 implementation for production
  return '0x' + createHash('sha256').update(data, 'utf8').digest('hex')
}

export const sha256 = (data: string): string => {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

export const generateProposalId = (action: any, proposer: string, timestamp: number): string => {
  const proposalData = JSON.stringify({
    type: action.type,
    data: action.data,
    proposer,
    timestamp
  })
  
  const hash = sha256(proposalData)
  return `prop_${hash.slice(0, 12)}`
}

export const hashBoard = (encodedBoard: string): string => {
  return keccak256(encodedBoard)
}