// Verify weightings_universe table
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://vdcxwfaxmaursaocyvfw.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkY3h3ZmF4bWF1cnNhb2N5dmZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE4NTk5NywiZXhwIjoyMDc2NzYxOTk3fQ.eTJ4ZeEXy-jecUn8D6d9jXpy98x_6NA7zJ5pSZ1EBLI'

async function verify() {
  console.log('\n' + '='.repeat(70))
  console.log('Verifying weightings_universe Table')
  console.log('='.repeat(70) + '\n')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data, error } = await supabase
    .from('weightings_universe')
    .select('*')
    .order('Ticker', { ascending: true })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`✓ Found ${data.length} records in weightings_universe\n`)

  console.log('Sample records (first 10):\n')
  data.slice(0, 10).forEach(w => {
    console.log(`${w.Ticker.padEnd(6)} - ${w.Name?.substring(0, 30).padEnd(30)} | SPY: ${w.SPY || 'N/A'}% | QQQ: ${w.QQQ || 'N/A'}%`)
  })

  console.log('\n' + '='.repeat(70))
  console.log('Column Check')
  console.log('='.repeat(70))
  
  if (data.length > 0) {
    const columns = Object.keys(data[0])
    console.log(`\nColumns found: ${columns.length}`)
    console.log(columns.join(', '))
    
    // Check for data in each ETF column
    console.log('\n' + '='.repeat(70))
    console.log('ETF Coverage')
    console.log('='.repeat(70) + '\n')
    
    const etfColumns = columns.filter(c => c !== 'Ticker' && c !== 'Name')
    etfColumns.forEach(etf => {
      const count = data.filter(r => r[etf] !== null && r[etf] !== '').length
      const pct = ((count / data.length) * 100).toFixed(1)
      console.log(`${etf.padEnd(6)}: ${count.toString().padStart(3)} tickers (${pct}% coverage)`)
    })
  }

  console.log('\n✓ Verification complete!\n')
}

verify()
