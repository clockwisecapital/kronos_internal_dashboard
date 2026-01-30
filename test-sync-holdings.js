// Test syncing DAILY HOLDINGS file
// Run with: node test-sync-holdings.js

const fetch = require('node:fetch')

async function testHoldingsSync() {
  console.log('\n' + '='.repeat(60))
  console.log('Testing Holdings Sync from Google Drive')
  console.log('='.repeat(60) + '\n')

  try {
    console.log('📋 Sending sync request to /api/google-sync...\n')
    
    const response = await fetch('http://localhost:3000/api/google-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileType: 'holdings',
        dryRun: false,
      }),
    })

    console.log(`Response status: ${response.status} ${response.statusText}\n`)

    const data = await response.json()
    
    if (data.success) {
      console.log('✓ SYNC SUCCESSFUL\n')
      console.log('Results:')
      data.synced.forEach(result => {
        console.log(`\n  File: ${result.file}`)
        console.log(`  Tab: ${result.tab}`)
        console.log(`  Rows: ${result.rowsProcessed}`)
        console.log(`  Status: ${result.status}`)
        if (result.error) {
          console.log(`  Error: ${result.error}`)
        }
      })
      console.log(`\nTimestamp: ${data.timestamp}`)
    } else {
      console.log('✗ SYNC FAILED\n')
      console.log('Error:', data.error || 'Unknown error')
      if (data.synced && data.synced.length > 0) {
        console.log('\nDetails:')
        data.synced.forEach(result => {
          console.log(`  ${result.file}: ${result.error || result.status}`)
        })
      }
    }

    console.log('\n' + '='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ TEST FAILED\n')
    console.error('Error:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nMake sure the dev server is running:')
      console.error('  npm run dev')
    }
    
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

testHoldingsSync()
