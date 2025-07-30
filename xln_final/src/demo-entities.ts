// Demo: Entity tracking and reputation calculation
// Shows how to track participants across channels without modifying channel code

import { channel, pay, wallet, address } from './core/channels.js'
import { entityManager } from './entities/manager.js'
import { ethers } from 'ethers'

console.log('=== XLN Entity Management Demo ===\n')

// Create wallets for different entities
const alice = wallet('alice')
const bob = wallet('bob')
const charlie = wallet('charlie')
const diana = wallet('diana')
const eve = wallet('eve')

// Register entities with names and metadata
console.log('1. Registering entities with metadata:')
entityManager.registerEntity(address(alice), 'Alice', { 
  type: 'merchant',
  location: 'USA',
  established: 2023
})
entityManager.registerEntity(address(bob), 'Bob', {
  type: 'payment_processor',
  location: 'UK'
})
entityManager.registerEntity(address(charlie), 'Charlie', {
  type: 'individual',
  verified: true
})
entityManager.registerEntity(address(diana), 'Diana', {
  type: 'merchant',
  category: 'e-commerce'
})
entityManager.registerEntity(address(eve), 'Eve', {
  type: 'exchange',
  tier: 'premium'
})

console.log('✓ Registered 5 entities\n')

// Create channels and track participation
console.log('2. Creating channels and tracking participation:')

// Alice <-> Bob (merchant to processor)
const channelAB = channel(
  [address(alice), address(bob)],
  { 
    leftCreditLimit: ethers.parseEther('10'),
    rightCreditLimit: ethers.parseEther('20'),
    collateral: ethers.parseEther('5')
  }
)
const channelIdAB = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address'],
    [address(alice), address(bob)]
  )
)
entityManager.trackChannelParticipation(address(alice), channelIdAB, channelAB)
entityManager.trackChannelParticipation(address(bob), channelIdAB, channelAB)

// Bob <-> Charlie (processor to individual)
const channelBC = channel(
  [address(bob), address(charlie)],
  {
    leftCreditLimit: ethers.parseEther('5'),
    rightCreditLimit: ethers.parseEther('2'),
    collateral: ethers.parseEther('1')
  }
)
const channelIdBC = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address'],
    [address(bob), address(charlie)]
  )
)
entityManager.trackChannelParticipation(address(bob), channelIdBC, channelBC)
entityManager.trackChannelParticipation(address(charlie), channelIdBC, channelBC)

// Charlie <-> Diana (p2p)
const channelCD = channel(
  [address(charlie), address(diana)],
  {
    leftCreditLimit: ethers.parseEther('3'),
    rightCreditLimit: ethers.parseEther('3'),
    collateral: ethers.parseEther('0.5')
  }
)
const channelIdCD = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address'],
    [address(charlie), address(diana)]
  )
)
entityManager.trackChannelParticipation(address(charlie), channelIdCD, channelCD)
entityManager.trackChannelParticipation(address(diana), channelIdCD, channelCD)

// Diana <-> Eve (merchant to exchange)
const channelDE = channel(
  [address(diana), address(eve)],
  {
    leftCreditLimit: ethers.parseEther('15'),
    rightCreditLimit: ethers.parseEther('50'),
    collateral: ethers.parseEther('10')
  }
)
const channelIdDE = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address'],
    [address(diana), address(eve)]
  )
)
entityManager.trackChannelParticipation(address(diana), channelIdDE, channelDE)
entityManager.trackChannelParticipation(address(eve), channelIdDE, channelDE)

console.log('✓ Created 4 channels with entity tracking\n')

// Simulate payment activity
console.log('3. Simulating payment activity:')

// Store channels for credit utilization calculation
const channels = new Map([
  [channelIdAB, channelAB],
  [channelIdBC, channelBC],
  [channelIdCD, channelCD],
  [channelIdDE, channelDE]
])

// Alice sends multiple payments to Bob (merchant activity)
let currentChannelAB = channelAB
for (let i = 0; i < 5; i++) {
  const amount = ethers.parseEther((0.5 + Math.random() * 1.5).toFixed(2))
  const result = pay(currentChannelAB, {
    from: address(alice),
    to: address(bob),
    amount
  })
  const success = result !== null
  entityManager.trackPayment(channelIdAB, address(alice), address(bob), amount, success)
  if (success) {
    currentChannelAB = result
    channels.set(channelIdAB, result)
  }
}

// Bob routes payments to Charlie (processor activity)
for (let i = 0; i < 3; i++) {
  const amount = ethers.parseEther((0.1 + Math.random() * 0.4).toFixed(2))
  const currentChannel = channels.get(channelIdBC)!
  const result = pay(currentChannel, {
    from: address(bob),
    to: address(charlie),
    amount
  })
  const success = result !== null
  entityManager.trackPayment(channelIdBC, address(bob), address(charlie), amount, success)
  if (success) {
    channels.set(channelIdBC, result)
  }
}

// Charlie and Diana exchange payments (p2p activity)
for (let i = 0; i < 4; i++) {
  const amount = ethers.parseEther((0.2 + Math.random() * 0.3).toFixed(2))
  const isCharlieToD = Math.random() > 0.5
  const currentChannel = channels.get(channelIdCD)!
  const result = pay(currentChannel, {
    from: isCharlieToD ? address(charlie) : address(diana),
    to: isCharlieToD ? address(diana) : address(charlie),
    amount
  })
  const success = result !== null
  entityManager.trackPayment(
    channelIdCD,
    isCharlieToD ? address(charlie) : address(diana),
    isCharlieToD ? address(diana) : address(charlie),
    amount,
    success
  )
  if (success) {
    channels.set(channelIdCD, result)
  }
}

// Diana sends large payment to Eve (fails due to credit limit)
const largeAmount = ethers.parseEther('20')
const largePaymentResult = pay(channels.get(channelIdDE)!, {
  from: address(diana),
  to: address(eve),
  amount: largeAmount
})
entityManager.trackPayment(channelIdDE, address(diana), address(eve), largeAmount, largePaymentResult !== null)

// Diana sends reasonable payments to Eve
for (let i = 0; i < 2; i++) {
  const amount = ethers.parseEther((2 + Math.random() * 3).toFixed(2))
  const currentChannel = channels.get(channelIdDE)!
  const result = pay(currentChannel, {
    from: address(diana),
    to: address(eve),
    amount
  })
  const success = result !== null
  entityManager.trackPayment(channelIdDE, address(diana), address(eve), amount, success)
  if (success) {
    channels.set(channelIdDE, result)
  }
}

console.log('✓ Processed 15 payments across the network\n')

// Update credit utilization for all entities
console.log('4. Calculating credit utilization:')
for (const entity of entityManager.getAllEntities()) {
  entityManager.updateCreditUtilization(entity.address, channels)
}
console.log('✓ Updated credit utilization metrics\n')

// Display entity statistics
console.log('5. Entity Statistics:\n')
for (const entity of entityManager.getAllEntities()) {
  console.log(`${entity.name} (${entity.metadata?.type || 'unknown'}):`)
  console.log(`  Address: ${entity.address}`)
  console.log(`  Channels: ${entity.stats.totalChannels}`)
  console.log(`  Payments sent: ${entity.stats.totalPaymentsSent}`)
  console.log(`  Payments received: ${entity.stats.totalPaymentsReceived}`)
  console.log(`  Volume sent: ${ethers.formatEther(entity.stats.totalVolumeSent)} ETH`)
  console.log(`  Volume received: ${ethers.formatEther(entity.stats.totalVolumeReceived)} ETH`)
  console.log(`  Success rate: ${(entity.stats.successRate * 100).toFixed(1)}%`)
  console.log(`  Avg payment size: ${ethers.formatEther(entity.stats.avgPaymentSize)} ETH`)
  console.log(`  Credit utilization: ${(entity.stats.creditUtilization * 100).toFixed(1)}%`)
  console.log(`  Collateral efficiency: ${entity.stats.collateralEfficiency.toFixed(2)}x`)
  console.log()
}

// Display reputation rankings
console.log('6. Reputation Rankings:\n')
const rankedEntities = entityManager.getEntitiesByReputation()
rankedEntities.forEach((entity, index) => {
  console.log(`#${index + 1} ${entity.name}: ${entity.reputationScore.toFixed(1)} points`)
  console.log(`   ${entity.metadata?.type || 'unknown'} | Success: ${(entity.stats.successRate * 100).toFixed(0)}% | Efficiency: ${entity.stats.collateralEfficiency.toFixed(1)}x`)
})

// Show recent network activity
console.log('\n7. Recent Network Activity:')
const recentActivity = entityManager.getRecentActivity(5)
for (const activity of recentActivity) {
  const fromEntity = entityManager.getEntity(activity.payment.from)
  const toEntity = entityManager.getEntity(activity.payment.to)
  const status = activity.payment.success ? '✓' : '✗'
  console.log(`  ${status} ${fromEntity?.name || activity.payment.from.slice(0, 8)} → ${toEntity?.name || activity.payment.to.slice(0, 8)}: ${ethers.formatEther(activity.payment.amount)} ETH`)
}

// Export network statistics
const stats = entityManager.exportStats()
console.log('\n8. Network Summary:')
console.log(`  Total entities: ${stats.networkStats.totalEntities}`)
console.log(`  Total payments: ${stats.networkStats.totalPayments}`)
console.log(`  Total volume: ${ethers.formatEther(stats.networkStats.totalVolume)} ETH`)
console.log(`  Network success rate: ${(stats.networkStats.avgSuccessRate * 100).toFixed(1)}%`)

// Show specific entity activity
console.log('\n9. Bob\'s Recent Activity (Payment Processor):')
const bobActivity = entityManager.getEntityActivity(address(bob), 5)
for (const activity of bobActivity) {
  const role = activity.payment.from === address(bob) ? 'sent to' : 'received from'
  const otherParty = activity.payment.from === address(bob) ? activity.payment.to : activity.payment.from
  const otherEntity = entityManager.getEntity(otherParty)
  console.log(`  ${role} ${otherEntity?.name || otherParty.slice(0, 8)}: ${ethers.formatEther(activity.payment.amount)} ETH`)
}

console.log('\n✓ Entity management demo complete!')
console.log('\nKey insights:')
console.log('- Entities are tracked separately without modifying channel code')
console.log('- Reputation scores consider success rate, activity, volume, and efficiency')
console.log('- Credit utilization and collateral efficiency metrics help assess risk')
console.log('- Activity tracking enables network analysis and participant monitoring')