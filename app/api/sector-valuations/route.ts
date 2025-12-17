// Sector Valuations API Route - Fetches from factset_data_v2
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// List of sector ETFs and indices to fetch
const SECTOR_TICKERS = [
  'SPY',    // S&P 500
  'QQQ',    // Nasdaq 100
  'DIA',    // Dow Jones
  'XLK',    // Technology
  'XLF',    // Financials
  'XLC',    // Communication Services
  'XLY',    // Consumer Discretionary
  'XLP',    // Consumer Staples
  'XLE',    // Energy
  'XLV',    // Healthcare
  'XLI',    // Industrials
  'XLB',    // Materials
  'XLRE',   // Real Estate
  'XLU',    // Utilities
  'SOXX',   // Semiconductors (PHLX)
  'SMH'     // Semiconductors (VanEck)
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tickers = searchParams.get('tickers')
    
    console.log('Fetching sector valuations from factset_data_v2...')
    const supabase = createServiceRoleClient()

    // If specific tickers requested, use those; otherwise use default sector list
    const tickersToFetch = tickers ? tickers.split(',') : SECTOR_TICKERS

    // Fetch valuation data for sectors
    const { data, error } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "P/E NTM",
        "3-YR AVG NTM P/E",
        "3-YR MEDIAN NTM P/E",
        "3-YR MIN NTM P/E",
        "3-YR MAX NTM P/E",
        "EV/EBITDA - NTM",
        "3-YR AVG NTM EV/EBITDA",
        "3-YR MEDIAN NTM EV/EBITDA",
        "3-YR MIN NTM EV/EBITDA",
        "3-YR MAX NTM EV/EBITDA",
        "EV/Sales - NTM",
        "3-YR AVG NTM EV/SALES",
        "3-YR MEDIAN NTM EV/SALES",
        "3-YR MIN NTM EV/SALES",
        "3-YR MAX NTM EV/SALES"
      `)
      .in('Ticker', tickersToFetch)

    if (error) {
      console.error('Sector Valuations API error:', error)
      throw error
    }

    console.log(`Sector Valuations API: Loaded ${data?.length || 0} records`)

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Sector Valuations API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch sector valuations',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}


