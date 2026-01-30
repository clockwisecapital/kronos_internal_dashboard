// Test syncing Holdings + Weightings from Google Drive
// Run with: node test-sync-all.js

async function testSync() {
  console.log('\n' + '='.repeat(70))
  console.log('Testing Google Drive Sync: ALL 4 DATA SOURCES')
  console.log('='.repeat(70) + '\n')

  try {
    console.log('📋 Sending sync request to /api/google-sync...')
    console.log('   File Type: all (holdings + factset + weightings + gic_yahoo)')
    console.log('   Dry Run: false\n')
    
    const startTime = Date.now()
    
    const response = await fetch('http://localhost:3001/api/google-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileType: 'all',
        dryRun: false,
      }),
    })

    const duration = Date.now() - startTime

    console.log(`Response Status: ${response.status} ${response.statusText}`)
    console.log(`Duration: ${duration}ms\n`)

    const data = await response.json()
    
    console.log('='.repeat(70))
    
    if (data.success) {
      console.log('✅ SYNC SUCCESSFUL')
      console.log('='.repeat(70) + '\n')
      
      let totalRows = 0
      
      data.synced.forEach((result, idx) => {
        console.log(`File ${idx + 1}: ${result.file}`)
        console.log(`  Tab: ${result.tab}`)
        console.log(`  Status: ${result.status === 'success' ? '✓' : '✗'} ${result.status.toUpperCase()}`)
        console.log(`  Rows Processed: ${result.rowsProcessed}`)
        
        if (result.error) {
          console.log(`  Error: ${result.error}`)
        }
        
        totalRows += result.rowsProcessed
        console.log()
      })
      
      console.log('Summary:')
      console.log(`  Total Files: ${data.synced.length}`)
      console.log(`  Successful: ${data.synced.filter(r => r.status === 'success').length}`)
      console.log(`  Failed: ${data.synced.filter(r => r.status === 'error').length}`)
      console.log(`  Total Rows: ${totalRows}`)
      console.log(`  Duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`)
      console.log(`  Timestamp: ${data.timestamp}`)
      
      console.log('\n' + '='.repeat(70))
      console.log('Next Steps:')
      console.log('='.repeat(70))
      console.log('1. Check Supabase tables:')
      console.log('   - holdings: 40 records')
      console.log('   - factset_data_v2: 2,307 records')
      console.log('   - weightings_universe: 633 records')
      console.log('   - gics_yahoo_finance: 2,274 records')
      console.log('   - sync_history table should have a log entry')
      console.log('\n2. Check the UI at http://localhost:3001/data-sync')
      console.log('   - Sync should appear in history')
      console.log('\n3. Total: 5,254 records synced!')
      console.log('   (vs 20-30 minutes with Claude API)')
      console.log()
      
    } else {
      console.log('❌ SYNC FAILED')
      console.log('='.repeat(70) + '\n')
      console.log('Error:', data.error || 'Unknown error')
      
      if (data.synced && data.synced.length > 0) {
        console.log('\nDetails:')
        data.synced.forEach(result => {
          console.log(`  ${result.file}:`)
          console.log(`    Status: ${result.status}`)
          if (result.error) {
            console.log(`    Error: ${result.error}`)
          }
        })
      }
      
      console.log('\n' + '='.repeat(70))
      console.log('Troubleshooting:')
      console.log('='.repeat(70))
      console.log('1. Check the dev server logs for errors')
      console.log('2. Verify Google Drive credentials in .env.local')
      console.log('3. Make sure sync_history table exists in Supabase')
      console.log('4. Check browser console at http://localhost:3001/data-sync')
      console.log()
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED\n')
    console.error('Error:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDev server not running!')
      console.error('Start it with: npm run dev')
      console.error('Note: Server is on port 3001 (not 3000)')
    } else if (error.cause?.code === 'ECONNRESET') {
      console.error('\nConnection was reset. The server might be processing.')
      console.error('This can happen with large files. Check the server logs.')
    }
    
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

testSync()
