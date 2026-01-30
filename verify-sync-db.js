// Verify sync data in Supabase database
// Run with: node verify-sync-db.js

const { createClient } = require('@supabase/supabase-js')

// Load env vars
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const envVars = {}
  
  let currentKey = null
  let currentValue = ''
  let inMultiline = false
  
  const lines = envContent.split('\n')
  
  for (const line of lines) {
    // Skip comments
    if (!inMultiline && line.trim().startsWith('#')) continue
    
    if (inMultiline) {
      if (line.endsWith('"')) {
        currentValue += '\n' + line.slice(0, -1)
        envVars[currentKey] = currentValue
        inMultiline = false
        currentKey = null
        currentValue = ''
      } else {
        currentValue += '\n' + line
      }
      continue
    }
    
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      if (currentKey) {
        envVars[currentKey] = currentValue
      }
      
      currentKey = match[1].trim()
      currentValue = match[2].trim()
      
      if (currentValue.startsWith('"') && !currentValue.endsWith('"')) {
        inMultiline = true
        currentValue = currentValue.slice(1)
      } else if (currentValue.startsWith('"') && currentValue.endsWith('"')) {
        currentValue = currentValue.slice(1, -1)
        envVars[currentKey] = currentValue
        currentKey = null
        currentValue = ''
      } else {
        envVars[currentKey] = currentValue
        currentKey = null
        currentValue = ''
      }
    }
  }
  
  if (currentKey) {
    envVars[currentKey] = currentValue
  }
  
  return envVars
}

// Hardcoded from .env.local for testing
const SUPABASE_URL = 'https://vdcxwfaxmaursaocyvfw.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkY3h3ZmF4bWF1cnNhb2N5dmZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE4NTk5NywiZXhwIjoyMDc2NzYxOTk3fQ.eTJ4ZeEXy-jecUn8D6d9jXpy98x_6NA7zJ5pSZ1EBLI'

async function verifySync() {
  console.log('\n' + '='.repeat(70))
  console.log('Verifying Sync Data in Supabase')
  console.log('='.repeat(70) + '\n')

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log('📊 Checking Holdings Table...\n')
    
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')
      .order('stock_ticker', { ascending: true })

    if (holdingsError) throw holdingsError

    console.log(`✓ Holdings Table: ${holdings.length} records`)
    if (holdings.length > 0) {
      console.log(`  Sample records:`)
      holdings.slice(0, 5).forEach(h => {
        console.log(`    ${h.stock_ticker} - ${h.security_name} - ${h.shares} shares - $${h.market_value?.toLocaleString()}`)
      })
      if (holdings.length > 5) {
        console.log(`    ... and ${holdings.length - 5} more`)
      }
    }

    console.log('\n📊 Checking Weightings Table...\n')
    
    const { data: weightings, error: weightingsError } = await supabase
      .from('weightings')
      .select('*')
      .order('ticker', { ascending: true })

    if (weightingsError) throw weightingsError

    console.log(`✓ Weightings Table: ${weightings.length} records`)
    if (weightings.length > 0) {
      console.log(`  Sample records:`)
      weightings.slice(0, 5).forEach(w => {
        console.log(`    ${w.ticker} - ${w.name} - QQQ: ${w.qqq || 'N/A'}% - SPY: ${w.spy || 'N/A'}%`)
      })
      if (weightings.length > 5) {
        console.log(`    ... and ${weightings.length - 5} more`)
      }
    }

    console.log('\n📊 Checking Sync History Table...\n')
    
    const { data: history, error: historyError } = await supabase
      .from('sync_history')
      .select('*')
      .order('sync_date', { ascending: false })
      .limit(1)

    if (historyError) {
      console.log(`⚠ Sync History Table Error: ${historyError.message}`)
      console.log(`  Note: You may need to create the table with supabase-sync-history-table.sql`)
    } else if (history && history.length > 0) {
      const latest = history[0]
      console.log(`✓ Sync History Table: Latest sync found`)
      console.log(`  Date: ${new Date(latest.sync_date).toLocaleString()}`)
      console.log(`  Type: ${latest.sync_type}`)
      console.log(`  File Type: ${latest.file_type}`)
      console.log(`  Status: ${latest.status}`)
      console.log(`  Total Rows: ${latest.total_rows}`)
      console.log(`  Duration: ${latest.duration_ms}ms`)
      console.log(`  Files Synced:`)
      if (latest.files_synced) {
        latest.files_synced.forEach(f => {
          console.log(`    - ${f.file}: ${f.rowsProcessed} rows (${f.status})`)
        })
      }
    } else {
      console.log(`⚠ No sync history found`)
      console.log(`  Note: History logging may not be working, or table doesn't exist`)
    }

    console.log('\n' + '='.repeat(70))
    console.log('✅ VERIFICATION COMPLETE')
    console.log('='.repeat(70))
    console.log(`\nSummary:`)
    console.log(`  Holdings: ${holdings.length} records`)
    console.log(`  Weightings: ${weightings.length} records`)
    console.log(`  Sync History: ${history?.length || 0} records`)
    console.log()
    console.log(`View in UI: http://localhost:3001/holdings`)
    console.log(`Sync Page: http://localhost:3001/data-sync`)
    console.log()

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED\n')
    console.error('Error:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

verifySync()
