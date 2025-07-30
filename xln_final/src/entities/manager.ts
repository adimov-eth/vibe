// Entity Manager - Track participants and their channel activity
// Separate layer that observes but doesn't modify channels

import type { Address, Channel } from '../core/channels.js'

export interface Entity {
  readonly address: Address
  readonly name?: string
  readonly metadata?: Record<string, any>
  readonly channelIds: readonly string[]
  readonly stats: EntityStats
}

export interface EntityStats {
  readonly totalChannels: number
  readonly totalPaymentsSent: number
  readonly totalPaymentsReceived: number
  readonly totalVolumeSent: bigint
  readonly totalVolumeReceived: bigint
  readonly successRate: number
  readonly avgPaymentSize: bigint
  readonly creditUtilization: number  // Average % of credit limit used
  readonly collateralEfficiency: number  // Volume moved per unit collateral
}

export interface ChannelActivity {
  readonly channelId: string
  readonly payment: {
    readonly from: Address
    readonly to: Address
    readonly amount: bigint
    readonly timestamp: number
    readonly success: boolean
  }
}

export class EntityManager {
  private entities: Map<Address, Entity> = new Map()
  private channelActivity: ChannelActivity[] = []
  
  // Register a new entity
  registerEntity(address: Address, name?: string, metadata?: Record<string, any>): Entity {
    const entity: Entity = {
      address,
      name,
      metadata,
      channelIds: [],
      stats: {
        totalChannels: 0,
        totalPaymentsSent: 0,
        totalPaymentsReceived: 0,
        totalVolumeSent: 0n,
        totalVolumeReceived: 0n,
        successRate: 1.0,
        avgPaymentSize: 0n,
        creditUtilization: 0,
        collateralEfficiency: 0
      }
    }
    this.entities.set(address, entity)
    return entity
  }
  
  // Track when an entity joins a channel
  trackChannelParticipation(address: Address, channelId: string, channel: Channel): void {
    let entity = this.entities.get(address)
    if (!entity) {
      entity = this.registerEntity(address)
    }
    
    // Add channel if not already tracked
    if (!entity.channelIds.includes(channelId)) {
      this.entities.set(address, {
        ...entity,
        channelIds: [...entity.channelIds, channelId],
        stats: {
          ...entity.stats,
          totalChannels: entity.stats.totalChannels + 1
        }
      })
    }
  }
  
  // Track payment activity
  trackPayment(
    channelId: string,
    from: Address,
    to: Address,
    amount: bigint,
    success: boolean = true
  ): void {
    const activity: ChannelActivity = {
      channelId,
      payment: {
        from,
        to,
        amount,
        timestamp: Date.now(),
        success
      }
    }
    this.channelActivity.push(activity)
    
    // Update sender stats
    this.updateEntityStats(from, 'sent', amount, success)
    
    // Update receiver stats
    this.updateEntityStats(to, 'received', amount, success)
  }
  
  private updateEntityStats(
    address: Address,
    direction: 'sent' | 'received',
    amount: bigint,
    success: boolean
  ): void {
    let entity = this.entities.get(address)
    if (!entity) {
      entity = this.registerEntity(address)
    }
    
    const stats = entity.stats
    const isSending = direction === 'sent'
    
    // Calculate new totals
    const newPaymentCount = isSending 
      ? stats.totalPaymentsSent + 1
      : stats.totalPaymentsReceived + 1
    
    const newVolume = isSending
      ? stats.totalVolumeSent + amount
      : stats.totalVolumeReceived + amount
    
    // Calculate success rate (exponential moving average)
    const alpha = 0.1  // Weight for new observation
    const newSuccessRate = stats.successRate * (1 - alpha) + (success ? 1 : 0) * alpha
    
    // Calculate average payment size
    const totalPayments = stats.totalPaymentsSent + stats.totalPaymentsReceived + 1
    const totalVolume = stats.totalVolumeSent + stats.totalVolumeReceived + amount
    const avgPaymentSize = totalPayments > 0 ? totalVolume / BigInt(totalPayments) : 0n
    
    this.entities.set(address, {
      ...entity,
      stats: {
        ...stats,
        totalPaymentsSent: isSending ? newPaymentCount : stats.totalPaymentsSent,
        totalPaymentsReceived: !isSending ? newPaymentCount : stats.totalPaymentsReceived,
        totalVolumeSent: isSending ? newVolume : stats.totalVolumeSent,
        totalVolumeReceived: !isSending ? newVolume : stats.totalVolumeReceived,
        successRate: newSuccessRate,
        avgPaymentSize
      }
    })
  }
  
  // Calculate credit utilization for an entity across all channels
  updateCreditUtilization(address: Address, channels: Map<string, Channel>): void {
    const entity = this.entities.get(address)
    if (!entity) return
    
    let totalCreditLimit = 0n
    let totalUtilization = 0n
    let totalCollateral = 0n
    let channelCount = 0
    
    for (const channelId of entity.channelIds) {
      const channel = channels.get(channelId)
      if (!channel) continue
      
      const isLeft = channel.participants[0] === address
      const creditLimit = isLeft ? channel.leftCreditLimit : channel.rightCreditLimit
      const balance = isLeft ? channel.balance : -channel.balance
      
      if (creditLimit > 0n) {
        totalCreditLimit += creditLimit
        // Utilization is how much of credit limit is used
        if (balance < 0n) {
          totalUtilization += -balance  // Using credit
        }
        channelCount++
      }
      
      // Track collateral
      totalCollateral += channel.collateral / 2n  // Assume equal contribution
    }
    
    // Calculate average utilization percentage
    const creditUtilization = totalCreditLimit > 0n
      ? Number(totalUtilization * 100n / totalCreditLimit) / 100
      : 0
    
    // Calculate collateral efficiency (volume per unit collateral)
    const totalVolume = entity.stats.totalVolumeSent + entity.stats.totalVolumeReceived
    const collateralEfficiency = totalCollateral > 0n
      ? Number(totalVolume / totalCollateral)
      : 0
    
    this.entities.set(address, {
      ...entity,
      stats: {
        ...entity.stats,
        creditUtilization,
        collateralEfficiency
      }
    })
  }
  
  // Get entity by address
  getEntity(address: Address): Entity | undefined {
    return this.entities.get(address)
  }
  
  // Get all entities
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values())
  }
  
  // Get entities sorted by reputation score
  getEntitiesByReputation(): Array<Entity & { reputationScore: number }> {
    return this.getAllEntities()
      .map(entity => ({
        ...entity,
        reputationScore: this.calculateReputationScore(entity)
      }))
      .sort((a, b) => b.reputationScore - a.reputationScore)
  }
  
  // Calculate reputation score based on activity
  calculateReputationScore(entity: Entity): number {
    const stats = entity.stats
    
    // Weighted factors for reputation
    const factors = {
      successRate: stats.successRate * 40,  // 40% weight
      activityScore: Math.min(
        (stats.totalPaymentsSent + stats.totalPaymentsReceived) / 100,
        1
      ) * 20,  // 20% weight
      volumeScore: Math.min(
        Number(stats.totalVolumeSent + stats.totalVolumeReceived) / 1_000_000,
        1
      ) * 20,  // 20% weight
      efficiencyScore: Math.min(stats.collateralEfficiency / 10, 1) * 10,  // 10% weight
      utilizationScore: (1 - Math.abs(stats.creditUtilization - 0.5) * 2) * 10  // 10% weight (optimal at 50%)
    }
    
    return Object.values(factors).reduce((sum, score) => sum + score, 0)
  }
  
  // Get channel activity for an entity
  getEntityActivity(address: Address, limit?: number): ChannelActivity[] {
    const activities = this.channelActivity.filter(
      activity => 
        activity.payment.from === address || 
        activity.payment.to === address
    )
    
    if (limit) {
      return activities.slice(-limit)  // Return last N activities
    }
    return activities
  }
  
  // Get recent network activity
  getRecentActivity(limit: number = 10): ChannelActivity[] {
    return this.channelActivity.slice(-limit)
  }
  
  // Export stats for analysis
  exportStats(): {
    entities: Entity[]
    activity: ChannelActivity[]
    networkStats: {
      totalEntities: number
      totalPayments: number
      totalVolume: bigint
      avgSuccessRate: number
    }
  } {
    const entities = this.getAllEntities()
    const totalPayments = this.channelActivity.length
    const totalVolume = this.channelActivity.reduce(
      (sum, activity) => sum + activity.payment.amount,
      0n
    )
    const avgSuccessRate = entities.reduce(
      (sum, entity) => sum + entity.stats.successRate,
      0
    ) / Math.max(entities.length, 1)
    
    return {
      entities,
      activity: this.channelActivity,
      networkStats: {
        totalEntities: entities.length,
        totalPayments,
        totalVolume,
        avgSuccessRate
      }
    }
  }
}

// Create singleton instance
export const entityManager = new EntityManager()