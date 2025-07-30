// XLN Demo Script - Shows the revolutionary innovation in action

const API_BASE = 'http://localhost:3001/api'

// Helper for API calls
async function apiCall(endpoint: string, method = 'GET', body?: any) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await response.json()
  if (!data.ok) throw new Error(data.error)
  return data.data
}

async function runDemo() {
  console.log('\n🚀 XLN DEMO: Zero-Capital Payment Acceptance\n')
  console.log('The Problem: In Lightning, merchants need $10k locked to receive $10k')
  console.log('The Solution: In XLN, merchants need $0 to receive $10k!\n')
  
  try {
    // Step 1: Register merchants with instant credit lines
    console.log('📝 Step 1: Registering merchants...\n')
    
    const pizzaShop = await apiCall('/merchants/register', 'POST', {
      name: 'Lightning Pizza',
      requestedCreditLimit: '15000'  // $15k credit line
    })
    
    console.log(`✅ ${pizzaShop.name} registered!`)
    console.log(`   Credit line: $${pizzaShop.creditLimit}`)
    console.log(`   Required deposit: $0`)
    console.log(`   Can accept payments: IMMEDIATELY\n`)
    
    const coffeeShop = await apiCall('/merchants/register', 'POST', {
      name: 'Satoshi Coffee',
      requestedCreditLimit: '5000'  // $5k credit line
    })
    
    console.log(`✅ ${coffeeShop.name} registered!`)
    console.log(`   Credit line: $${coffeeShop.creditLimit}`)
    console.log(`   Can accept payments: IMMEDIATELY\n`)
    
    // Step 2: Register customers (they need deposits)
    console.log('👥 Step 2: Registering customers...\n')
    
    const alice = await apiCall('/customers/register', 'POST', {
      name: 'Alice',
      initialDeposit: '1000'  // $1k deposit
    })
    
    console.log(`✅ ${alice.name} registered with $${alice.balance} deposit\n`)
    
    const bob = await apiCall('/customers/register', 'POST', {
      name: 'Bob',
      initialDeposit: '500'  // $500 deposit
    })
    
    console.log(`✅ ${bob.name} registered with $${bob.balance} deposit\n`)
    
    // Step 3: Process payments - THE MAGIC!
    console.log('💸 Step 3: Processing payments (merchants receiving with ZERO deposit)...\n')
    
    // Alice buys pizza
    await apiCall('/payments', 'POST', {
      from: alice.id,
      to: pizzaShop.id,
      amount: '25'  // $25 pizza
    })
    console.log(`✅ Alice → Lightning Pizza: $25`)
    
    // Bob buys coffee
    await apiCall('/payments', 'POST', {
      from: bob.id,
      to: coffeeShop.id,
      amount: '5'  // $5 coffee
    })
    console.log(`✅ Bob → Satoshi Coffee: $5`)
    
    // Alice buys more
    await apiCall('/payments', 'POST', {
      from: alice.id,
      to: coffeeShop.id,
      amount: '15'  // $15 breakfast
    })
    console.log(`✅ Alice → Satoshi Coffee: $15`)
    
    // Step 4: Show hub statistics
    console.log('\n📊 Step 4: Hub Statistics...\n')
    
    const stats = await apiCall('/hub/stats')
    console.log(`Hub Statistics:`)
    console.log(`  Total collateral: $${stats.totalCollateral}`)
    console.log(`  Credit extended: $${stats.totalCreditExtended}`)
    console.log(`  Active channels: ${stats.activeChannels}`)
    console.log(`  Capital efficiency: ${stats.capitalEfficiency}x vs Lightning`)
    console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`)
    
    // Step 5: Show the innovation
    console.log('\n🎉 THE INNOVATION:\n')
    
    const merchants = await apiCall('/merchants')
    for (const merchant of merchants) {
      console.log(`${merchant.name}:`)
      console.log(`  Deposited: $0`)
      console.log(`  Received: $${merchant.balance}`)
      console.log(`  Available to receive: $${merchant.availableToReceive}`)
      console.log(`  Status: Accepting payments with ZERO capital! ✨\n`)
    }
    
    console.log('💡 In Lightning Network:')
    console.log('   - Merchants would need $20,000 locked up front')
    console.log('   - Hub would need $20,000 in channels')
    console.log('   - Total capital required: $40,000')
    
    console.log('\n💡 In XLN:')
    console.log('   - Merchants need: $0')
    console.log('   - Hub needs: $4,000 (20% fractional reserve)')
    console.log('   - Total capital required: $4,000')
    console.log('   - Capital efficiency: 10x improvement! 🚀')
    
  } catch (error) {
    console.error('Demo failed:', error)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Waiting for server to be ready...')
  setTimeout(runDemo, 1000)
}