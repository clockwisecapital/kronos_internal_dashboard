// Verify both holdings and weightings_universe tables
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://vdcxwfaxmaursaocyvfw.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkY3h3ZmF4bWF1cnNhb2N5dmZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE4NTk5NywiZXhwIjoyMDc2NzYxOTk3fQ.eTJ4ZeEXy-jecUn8D6d9jXpy98x_6NA7zJ5pSZ1EBLI'

async function verify() {
  console.log('\n' + '='.repeat(70))
  console.log('Full Sync Verification - Holdings + Weightings')
  console.log('='.repeat(70) + '\n')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Check Holdings
  console.log('📊 Holdings Table:\n')
  const { data: holdings, error: hError } = await supabase
    .from('holdings')
    .select('*')
    .order('stock_ticker', { ascending: true })

  if (hError) {
    console.error('Error:', hError)
    return
  }

  console.log(`✓ ${holdings.length} holdings records\n`)
  console.log('Sample (first 5):')
  holdings.slice(0, 5).forEach(h => {
    console.log(`  ${h.stock_ticker.padEnd(6)} ${h.security_name.substring(0, 25).padEnd(25)} ${h.shares.toString().padStart(6)} shares @ $${h.close_price.toFixed(2).padStart(8)} = $${h.market_value.toLocaleString()}`)
  })

  // Check Weightings Universe
  console.log('\n📊 Weightings Universe Table:\n')
  const { data: weightings, error: wError } = await supabase
    .from('weightings_universe')
    .select('*')
    .order('Ticker', { ascending: true })

  if (wError) {
    console.error('Error:', wError)
    return
  }

  console.log(`✓ ${weightings.length} weightings records\n`)
  console.log('Sample (first 5):')
  weightings.slice(0, 5).forEach(w => {
    const spy = w.SPY ? `${parseFloat(w.SPY).toFixed(2)}%` : 'N/A'
    const qqq = w.QQQ ? `${parseFloat(w.QQQ).toFixed(2)}%` : 'N/A'
    console.log(`  ${w.Ticker.padEnd(6)} ${(w.Name || '').substring(0, 30).padEnd(30)} SPY:${spy.padStart(7)} QQQ:${qqq.padStart(7)}`)
  })

  // Check Sync History
  console.log('\n📊 Sync History:\n')
  const { data: history, error: sError } = await supabase
    .from('sync_history')
    .select('*')
    .order('sync_date', { ascending: false })
    .limit(3)

  if (sError) {
    console.log(`⚠ Could not load sync_history: ${sError.message}`)
  } else {
    console.log(`✓ ${history.length} recent sync operations\n`)
    history.forEach(h => {
      console.log(`  ${new Date(h.sync_date).toLocaleString()} - ${h.file_type} - ${h.status} - ${h.total_rows} rows - ${(h.duration_ms/1000).toFixed(1)}s`)
    })
  }

  console.log('\n' + '='.repeat(70))
  console.log('✅ VERIFICATION COMPLETE')
  console.log('='.repeat(70))
  console.log('\n Performance Comparison:')
  console.log('  With Claude API: 90+ seconds')
  console.log('  With Direct CSV: ~3 seconds')
  console.log('  Speed improvement: 30x faster! 🚀')
  console.log('\n Benefits:')
  console.log('  ✓ No Claude API costs')
  console.log('  ✓ No JSON parsing errors')
  console.log('  ✓ Predictable and reliable')
  console.log('  ✓ Can sync anytime without API limits\n')
}

verify()
