// Entity management system demo
// Tests all three entity types: lazy, numbered, named

import { 
  createEntity, 
  resolveEntityIdentifier, 
  getEntityRequirements,
  validateEntityConfig
} from '../entities/manager.js'

const runEntityDemo = async () => {
  console.log('🏗️ XLN Entity Management Demo')
  console.log('===============================')

  // Test configuration validation
  console.log('🔍 Testing entity configuration validation:')
  const validConfig = validateEntityConfig(['alice', 'bob', 'charlie'], BigInt(2))
  console.log(`  Valid config: ${validConfig.valid ? '✅' : '❌'}`)
  
  const invalidConfig = validateEntityConfig(['alice'], BigInt(3))
  console.log(`  Invalid config: ${invalidConfig.valid ? '❌' : '✅'}`)
  console.log(`  Errors: ${invalidConfig.errors.join(', ')}`)
  console.log('')

  // Test entity requirements
  console.log('📋 Entity type requirements:')
  const types = ['lazy', 'numbered', 'named'] as const
  types.forEach(type => {
    const req = getEntityRequirements(type)
    console.log(`  ${type}: ${req.cost}, ${req.speed}`)
    console.log(`    → ${req.description}`)
  })
  console.log('')

  // Test lazy entity creation
  console.log('🔒 Creating lazy entity:')
  const lazyEntity = await createEntity('lazy', {
    name: 'XLN Demo Chat',
    validators: ['alice', 'bob', 'charlie'],
    threshold: BigInt(2)
  })
  console.log(`  ✅ Created: ${lazyEntity.entityId}`)
  console.log(`  Type: ${lazyEntity.type}`)
  console.log(`  Validators: ${lazyEntity.config.validators.length}`)
  console.log('')

  // Test numbered entity creation
  console.log('🔢 Creating numbered entity:')
  const numberedEntity = await createEntity('numbered', {
    validators: ['alice', 'bob', 'charlie'],
    threshold: BigInt(2)
  })
  console.log(`  ✅ Created: ${numberedEntity.entityId}`)
  console.log(`  Number: ${numberedEntity.metadata?.number}`)
  console.log('')

  // Test named entity creation
  console.log('🏷️ Creating named entity:')
  const namedEntity = await createEntity('named', {
    name: 'premium-chat',
    validators: ['alice', 'bob', 'charlie'],
    threshold: BigInt(2)
  })
  console.log(`  ✅ Created: ${namedEntity.entityId}`)
  console.log(`  Name: ${namedEntity.metadata?.name}`)
  console.log('')

  // Test entity resolution
  console.log('🔍 Testing entity resolution:')
  const entities = [lazyEntity, numberedEntity, namedEntity]
  
  for (const entity of entities) {
    const resolution = await resolveEntityIdentifier(entity.entityId)
    console.log(`  ${entity.entityId.slice(0, 20)}... → ${resolution.type}`)
  }
  console.log('')

  console.log('✅ Entity management system working!')
  console.log('📋 Next: Add payment channel data structures')
}

// Run if called directly
if (import.meta.main) {
  runEntityDemo()
}

export { runEntityDemo }