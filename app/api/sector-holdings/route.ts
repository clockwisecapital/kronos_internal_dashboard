// Sector Holdings API - Fetches top holdings for a given sector/index ETF
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Map sector ticker to the column name in weightings_universe table (capitalized)
const SECTOR_COLUMN_MAP: Record<string, string> = {
  'SPY': 'SPY',
  'QQQ': 'QQQ',
  'DIA': 'DIA',
  'XLK': 'XLK',
  'XLF': 'XLF',
  'XLC': 'XLC',
  'XLY': 'XLY',
  'XLP': 'XLP',
  'XLE': 'XLE',
  'XLV': 'XLV',
  'XLI': 'XLI',
  'XLB': 'XLB',
  'XLRE': 'XLRE',
  'XLU': 'XLU',
  'SOXX': 'SOXX',
  'SMH': 'SMH',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sector = searchParams.get('sector')
    
    if (!sector) {
      return NextResponse.json({
        success: false,
        message: 'Sector parameter is required'
      }, { status: 400 })
    }

    const columnName = SECTOR_COLUMN_MAP[sector]
    if (!columnName) {
      return NextResponse.json({
        success: false,
        message: `Invalid sector: ${sector}`
      }, { status: 400 })
    }

    console.log(`Fetching top 50 holdings for sector ${sector} (column: ${columnName})...`)
    const supabase = createServiceRoleClient()

    // Note: weightings_universe has capitalized column names
    // Filter out null, empty string, and "-" (dash placeholder for no weight)
    const { data: weightingsData, error: weightingsError } = await supabase
      .from('weightings_universe')
      .select(`"Ticker", "Name", "${columnName}"`)
      .not(columnName, 'is', null)
      .neq(columnName, '')
      .neq(columnName, '-')
      .order(columnName, { ascending: false })
      .limit(50)

    if (weightingsError) {
      console.error('Error fetching sector holdings:', weightingsError)
      throw weightingsError
    }

    console.log(`Fetched ${weightingsData?.length || 0} holdings for ${sector}`)

    const { data: dateData } = await supabase
      .from('holdings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)

    let clockwiseTickers = new Set<string>()
    
    if (dateData && dateData.length > 0) {
      const latestDate = dateData[0].date
      
      const { data: holdingsData } = await supabase
        .from('holdings')
        .select('stock_ticker')
        .eq('date', latestDate)

      if (holdingsData) {
        clockwiseTickers = new Set(holdingsData.map(h => h.stock_ticker.toUpperCase()))
      }
    }

    const formattedHoldings = (weightingsData || []).map((item: any) => {
      // Parse weight as number (stored as text in DB)
      const weightValue = parseFloat(item[columnName]) || 0
      
      return {
        ticker: item.Ticker,
        name: item.Name,
        weight: weightValue,
        isClockwiseHolding: clockwiseTickers.has(item.Ticker.toUpperCase())
      }
    })

    return NextResponse.json({
      success: true,
      data: formattedHoldings,
      sector,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Sector Holdings API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch sector holdings',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

