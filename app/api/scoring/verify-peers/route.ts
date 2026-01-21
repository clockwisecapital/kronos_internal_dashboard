import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const runtime = 'nodejs'

interface PeerVerification {
  ticker: string
  assignedBenchmark: string | null
  benchmarkName: string
  constituentCount: number
  samplePeers: string[]
  isAppropriate: 'YES' | 'NO' | 'UNKNOWN'
  reasoning: string
}

async function fetchBenchmarkConstituents(
  supabase: any,
  benchmarkTicker: string
): Promise<string[]> {
  const normalizedTicker = benchmarkTicker.toUpperCase()
  
  const columnMap: Record<string, string> = {
    'SPY': 'SPY', 'QQQ': 'QQQ', 'SOXX': 'SOXX', 'SMH': 'SMH',
    'ARKK': 'ARKK', 'XLK': 'XLK', 'XLF': 'XLF', 'XLC': 'XLC',
    'XLY': 'XLY', 'XLP': 'XLP', 'XLE': 'XLE', 'XLV': 'XLV',
    'XLI': 'XLI', 'XLB': 'XLB', 'XLRE': 'XLRE', 'XLU': 'XLU',
    'IGV': 'IGV', 'ITA': 'ITA'
  }
  
  const columnName = columnMap[normalizedTicker]
  if (!columnName) return []
  
  try {
    const { data } = await supabase
      .from('weightings_universe')
      .select(`"Ticker", "${columnName}"`)
      .not(columnName, 'is', null)
    
    return (data || [])
      .filter((row: any) => row[columnName] && row[columnName] !== '-')
      .map((row: any) => row.Ticker)
  } catch {
    return []
  }
}

const benchmarkDescriptions: Record<string, string> = {
  'SPY': 'S&P 500 (Large-cap US stocks)',
  'QQQ': 'Nasdaq-100 (Large-cap tech/growth)',
  'XLK': 'Technology Select Sector',
  'XLF': 'Financial Select Sector',
  'XLC': 'Communication Services Select Sector',
  'XLY': 'Consumer Discretionary Select Sector',
  'XLP': 'Consumer Staples Select Sector',
  'XLE': 'Energy Select Sector',
  'XLV': 'Health Care Select Sector',
  'XLI': 'Industrials Select Sector',
  'XLB': 'Materials Select Sector',
  'XLRE': 'Real Estate Select Sector',
  'XLU': 'Utilities Select Sector',
  'SOXX': 'Semiconductor ETF',
  'SMH': 'Semiconductor ETF',
  'IGV': 'Software ETF',
  'ARKK': 'ARK Innovation ETF',
  'ITA': 'Aerospace & Defense ETF'
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const benchmarkColumn = searchParams.get('benchmark') || 'BENCHMARK1'
    
    const supabase = createServiceRoleClient()
    
    // Fetch holdings
    const { data: holdingsDateData } = await supabase
      .from('holdings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
    
    if (!holdingsDateData || holdingsDateData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No holdings data available'
      }, { status: 404 })
    }
    
    const latestDate = holdingsDateData[0].date
    
    const { data: holdings } = await supabase
      .from('holdings')
      .select('stock_ticker, shares, market_value')
      .eq('date', latestDate)
    
    const uniqueHoldings = new Map()
    holdings?.forEach((h: any) => {
      if (!uniqueHoldings.has(h.stock_ticker)) {
        uniqueHoldings.set(h.stock_ticker, h)
      }
    })
    
    const tickers = Array.from(uniqueHoldings.keys())
    
    // Fetch benchmark assignments
    const { data: gicsBenchmarkData } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "BENCHMARK1", "BENCHMARK2", "BENCHMARK3", "BENCHMARK_CUSTOM"')
      .in('"Ticker"', tickers)
    
    const gicsBenchmarkMap = new Map()
    gicsBenchmarkData?.forEach((g: any) => {
      gicsBenchmarkMap.set(g.Ticker.toUpperCase(), g)
    })
    
    // Build verification results
    const verifications: PeerVerification[] = []
    
    for (const ticker of tickers) {
      const upperTicker = ticker.toUpperCase()
      const gicsData = gicsBenchmarkMap.get(upperTicker)
      
      let assignedBenchmark: string | null = null
      if (gicsData) {
        switch (benchmarkColumn) {
          case 'BENCHMARK1': assignedBenchmark = gicsData.BENCHMARK1; break
          case 'BENCHMARK2': assignedBenchmark = gicsData.BENCHMARK2; break
          case 'BENCHMARK3': assignedBenchmark = gicsData.BENCHMARK3; break
          case 'BENCHMARK_CUSTOM': assignedBenchmark = gicsData.BENCHMARK_CUSTOM; break
        }
      }
      
      if (!assignedBenchmark) {
        verifications.push({
          ticker,
          assignedBenchmark: null,
          benchmarkName: 'None (Universe-wide ranking)',
          constituentCount: 0,
          samplePeers: [],
          isAppropriate: 'UNKNOWN',
          reasoning: 'No benchmark assigned - will be ranked against entire universe (~2,300 stocks)'
        })
        continue
      }
      
      const constituents = await fetchBenchmarkConstituents(supabase, assignedBenchmark)
      const samplePeers = constituents.slice(0, 10)
      const benchmarkName = benchmarkDescriptions[assignedBenchmark.toUpperCase()] || assignedBenchmark
      
      // Simple appropriateness check
      let isAppropriate: 'YES' | 'NO' | 'UNKNOWN' = 'YES'
      let reasoning = `Comparing against ${constituents.length} peers in ${benchmarkName}`
      
      if (constituents.length < 10) {
        isAppropriate = 'NO'
        reasoning = `Only ${constituents.length} peers - too few for accurate ranking. Will fall back to universe-wide.`
      } else if (constituents.length === 0) {
        isAppropriate = 'NO'
        reasoning = 'Benchmark not found in weightings_universe table'
      }
      
      verifications.push({
        ticker,
        assignedBenchmark,
        benchmarkName,
        constituentCount: constituents.length,
        samplePeers,
        isAppropriate,
        reasoning
      })
    }
    
    // Sort by benchmark for easier reading
    verifications.sort((a, b) => {
      if (!a.assignedBenchmark) return 1
      if (!b.assignedBenchmark) return -1
      return a.assignedBenchmark.localeCompare(b.assignedBenchmark)
    })
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      benchmark: benchmarkColumn,
      verifications
    })
    
  } catch (error) {
    console.error('Peer verification error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to verify peers'
      },
      { status: 500 }
    )
  }
}
