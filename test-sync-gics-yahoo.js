// Test syncing GIC & Yahoo data from Google Drive

async function testGicsYahooSync() {
  console.log('\n' + '='.repeat(70))
  console.log('Testing Google Drive Sync: GIC & Yahoo')
  console.log('='.repeat(70) + '\n')

  const startTime = Date.now()

  console.log('📋 Sending sync request to /api/google-sync...')
  console.log('   File Type: gic_yahoo')
  console.log('   Dry Run: false\n')

  try {
    const response = await fetch('http://localhost:3001/api/google-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileType: 'gic_yahoo',
        dryRun: false,
      }),
    })

    const duration = Date.now() - startTime
    console.log(`Response Status: ${response.status} ${response.statusText}`)
    console.log(`Duration: ${duration}ms\n`)

    const data = await response.json()

    if (!response.ok) {
      console.log('='.repeat(70))
      console.log('❌ SYNC FAILED')
      console.log('='.repeat(70) + '\n')
      console.log('Error:', data.error || 'Unknown error')
      if (data.details) {
        console.log('\nDetails:')
        for (const [key, value] of Object.entries(data.details)) {
          console.log(`  ${key}:`)
          console.log(`    Status: ${value.status}`)
          if (value.error) console.log(`    Error: ${value.error}`)
        }
      }
      console.log('\n' + '='.repeat(70))
      console.log('Troubleshooting:')
      console.log('='.repeat(70))
      console.log('1. Check the dev server logs for errors')
      console.log('2. Verify Google Drive credentials in .env.local')
      console.log('3. Make sure gics_yahoo_finance table exists in Supabase')
      console.log('4. Check browser console at http://localhost:3001/data-sync\n')
      process.exit(1)
    }

    console.log('='.repeat(70))
    console.log('✅ SYNC SUCCESSFUL')
    console.log('='.repeat(70) + '\n')

    // Display results
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((result, index) => {
        console.log(`File ${index + 1}: ${result.file}`)
        console.log(`  Tab: ${result.tab}`)
        console.log(`  Status: ${result.status === 'success' ? '✓ SUCCESS' : '✗ FAILED'}`)
        if (result.status === 'success') {
          console.log(`  Rows Processed: ${result.rowsProcessed}`)
        } else {
          console.log(`  Error: ${result.error}`)
        }
        console.log()
      })
    }

    if (data.summary) {
      console.log('Summary:')
      console.log(`  Total Files: ${data.summary.totalFiles}`)
      console.log(`  Successful: ${data.summary.successfulFiles}`)
      console.log(`  Failed: ${data.summary.failedFiles}`)
      console.log(`  Total Rows: ${data.summary.totalRows}`)
      console.log(`  Duration: ${data.summary.durationMs}ms (${(data.summary.durationMs/1000).toFixed(1)}s)`)
      console.log(`  Timestamp: ${data.summary.timestamp}`)
    }

    console.log('\n' + '='.repeat(70))
    console.log('Next Steps:')
    console.log('='.repeat(70))
    console.log('1. Check Supabase gics_yahoo_finance table')
    console.log('2. Run verify-gics-yahoo.js to check data')
    console.log('3. Check UI at http://localhost:3001/data-sync\n')

  } catch (error) {
    console.error('❌ Request failed:', error.message)
    console.error('\nMake sure:')
    console.error('1. Dev server is running (npm run dev)')
    console.error('2. Server is listening on http://localhost:3001')
    console.error('3. Google Drive credentials are correct in .env.local\n')
    process.exit(1)
  }
}

testGicsYahooSync()
