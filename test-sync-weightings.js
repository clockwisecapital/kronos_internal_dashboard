// Test syncing just Weightings (ETF Weight Matrix) - should get 635+ records
// Run with: node test-sync-weightings.js

async function testWeightingsSync() {
  console.log('\n' + '='.repeat(70))
  console.log('Testing Weightings Sync (ETF Weight Matrix)')
  console.log('Expected: ~635 tickers to weightings_universe table')
  console.log('='.repeat(70) + '\n')

  try {
    console.log('📋 Sending sync request...\n')
    
    const startTime = Date.now()
    
    const response = await fetch('http://localhost:3001/api/google-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileType: 'weightings',
        dryRun: false,
      }),
    })

    const duration = Date.now() - startTime

    console.log(`Response: ${response.status} ${response.statusText}`)
    console.log(`Duration: ${(duration / 1000).toFixed(1)}s\n`)

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ SYNC SUCCESSFUL\n')
      
      data.synced.forEach(result => {
        console.log(`File: ${result.file}`)
        console.log(`Tab: ${result.tab}`)
        console.log(`Status: ${result.status}`)
        console.log(`Rows: ${result.rowsProcessed}`)
        if (result.error) {
          console.log(`Error: ${result.error}`)
        }
      })
      
      console.log('\n' + '='.repeat(70))
      if (data.synced[0].rowsProcessed >= 600) {
        console.log('✓ Got expected number of records (~635)')
      } else {
        console.log(`⚠ Warning: Expected ~635 rows, got ${data.synced[0].rowsProcessed}`)
      }
      console.log('='.repeat(70) + '\n')
      
      console.log('Next: Verify in database with:')
      console.log('  node verify-sync-db.js')
      console.log()
      
    } else {
      console.log('❌ SYNC FAILED\n')
      console.log('Error:', data.error)
      if (data.synced) {
        data.synced.forEach(r => {
          console.log(`  ${r.file}: ${r.error || r.status}`)
        })
      }
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED\n')
    console.error('Error:', error.message)
    if (error.code === 'ECONNREFUSED') {
      console.error('Dev server not running on port 3001')
    }
    process.exit(1)
  }
}

testWeightingsSync()
