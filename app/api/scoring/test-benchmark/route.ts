import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
  calculatePercentileRank,
  type FactSetData,
  type IndividualMetrics
} from '@/lib/calculators/scoring'
import { fetchHistoricalPricesInBatches } from '@/lib/services/yahooFinance'

export const runtime = 'nodejs'
export const maxDuration = 300

interface BenchmarkTestResult {
  success: boolean
  timestamp: string
  testTicker: string
  assignedBenchmark: string | null
  benchmarkConstituents: {
    total: number
    withFactSet: number
    withYahoo: number
    withCompleteData: number
    tickers: string[]
  }
  testTickerMetrics: {
    peRatio: number | null
    evEbitda: number | null
    evSales: number | null
    return3M: number | null
    beta3Yr: number | null
  }
  testTickerScores: {
    peRatioScore: number | null
    evEbitdaScore: number | null
    evSalesScore: number | null
    return3MScore: number | null
    beta3YrScore: number | null
  }
  benchmarkMetricsDistribution: {
    peRatios: Array<{ ticker: string, value: number | null }>
    evEbitdas: Array<{ ticker: string, value: number | null }>
    evSales: Array<{ ticker: string, value: number | null }>
    return3Ms: Array<{ ticker: string, value: number | null }>
    beta3Yrs: Array<{ ticker: string, value: number | null }>
  }
  ranking: {
    peRatio: string
    evEbitda: string
    evSales: string
    return3M: string
    beta3Yr: string
  }
  missingData: {
    noFactSet: string[]
    noYahoo: string[]
    incompleteMetrics: string[]
  }
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const testTicker = searchParams.get('ticker')?.toUpperCase() || 'AAPL'
    const benchmarkColumn = searchParams.get('benchmark') || 'BENCHMARK1'
    
    const supabase = createServiceRoleClient()
    
    console.log(`\n=== Benchmark Test: ${testTicker} ===`)
    
    // Get benchmark assignment for test ticker
    const { data: gicsData } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "BENCHMARK1", "BENCHMARK2", "BENCHMARK3", "BENCHMARK_CUSTOM"')
      .eq('"Ticker"', testTicker)
      .single()
    
    if (!gicsData) {
      return NextResponse.json({
        success: false,
        message: `No benchmark assignment found for ${testTicker}`
      }, { status: 404 })
    }
    
    let assignedBenchmark: string | null = null
    switch (benchmarkColumn) {
      case 'BENCHMARK1': assignedBenchmark = gicsData.BENCHMARK1; break
      case 'BENCHMARK2': assignedBenchmark = gicsData.BENCHMARK2; break
      case 'BENCHMARK3': assignedBenchmark = gicsData.BENCHMARK3; break
      case 'BENCHMARK_CUSTOM': assignedBenchmark = gicsData.BENCHMARK_CUSTOM; break
    }
    
    if (!assignedBenchmark) {
      return NextResponse.json({
        success: false,
        message: `No benchmark assigned to ${testTicker} in column ${benchmarkColumn}`
      }, { status: 404 })
    }
    
    console.log(`${testTicker} is assigned to benchmark: ${assignedBenchmark}`)
    
    // Fetch all constituents of the benchmark
    const constituentTickers = await fetchBenchmarkConstituents(supabase, assignedBenchmark)
    console.log(`Found ${constituentTickers.length} constituents in ${assignedBenchmark}`)
    
    if (constituentTickers.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No constituents found for benchmark ${assignedBenchmark}`
      }, { status: 404 })
    }
    
    // Add test ticker if not already in list
    if (!constituentTickers.includes(testTicker)) {
      constituentTickers.push(testTicker)
    }
    
    // Fetch FactSet data for all constituents + test ticker
    const { data: factsetData } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "P/E NTM",
        "EV/EBITDA - NTM",
        "EV/Sales - NTM",
        "PRICE",
        "1 month volatility",
        "3 yr beta",
        "52 week high"
      `)
      .in('Ticker', constituentTickers)
    
    const factsetMap = new Map<string, any>()
    factsetData?.forEach((row: any) => {
      factsetMap.set(row.Ticker.toUpperCase(), row)
    })
    
    console.log(`Loaded FactSet data for ${factsetMap.size} tickers`)
    
    // Fetch Yahoo historical prices
    console.log('Fetching Yahoo historical prices...')
    const historicalPricesMap = await fetchHistoricalPricesInBatches(
      constituentTickers,
      10,
      500
    )
    
    console.log(`Loaded Yahoo data for ${historicalPricesMap.size} tickers`)
    
    // Extract metrics for all constituents
    const constituentMetrics: Array<{ ticker: string, metrics: IndividualMetrics }> = []
    const noFactSet: string[] = []
    const noYahoo: string[] = []
    const incompleteMetrics: string[] = []
    
    for (const ticker of constituentTickers) {
      const upperTicker = ticker.toUpperCase()
      const factset = factsetMap.get(upperTicker)
      const yahoo = historicalPricesMap.get(upperTicker)
      
      if (!factset) {
        noFactSet.push(ticker)
        continue
      }
      
      if (!yahoo) {
        noYahoo.push(ticker)
        continue
      }
      
      const metrics = extractIndividualMetrics(factset as FactSetData, yahoo)
      
      // Check if metrics are complete
      if (!metrics.peRatio && !metrics.evEbitda && !metrics.evSales) {
        incompleteMetrics.push(ticker)
      }
      
      constituentMetrics.push({ ticker, metrics })
    }
    
    console.log(`Extracted metrics for ${constituentMetrics.length} constituents`)
    
    // Find test ticker metrics
    const testTickerData = constituentMetrics.find(c => c.ticker.toUpperCase() === testTicker)
    
    if (!testTickerData) {
      return NextResponse.json({
        success: false,
        message: `Could not extract metrics for ${testTicker}`
      }, { status: 404 })
    }
    
    const testMetrics = testTickerData.metrics
    
    // Extract metric arrays for percentile calculation
    const peRatios = constituentMetrics.map(c => c.metrics.peRatio)
    const evEbitdas = constituentMetrics.map(c => c.metrics.evEbitda)
    const evSales = constituentMetrics.map(c => c.metrics.evSales)
    const return3Ms = constituentMetrics.map(c => c.metrics.return3M)
    const beta3Yrs = constituentMetrics.map(c => c.metrics.beta3Yr)
    
    // Calculate scores for test ticker
    const testScores = {
      peRatioScore: calculatePercentileRank(testMetrics.peRatio, peRatios, true),
      evEbitdaScore: calculatePercentileRank(testMetrics.evEbitda, evEbitdas, true),
      evSalesScore: calculatePercentileRank(testMetrics.evSales, evSales, true),
      return3MScore: calculatePercentileRank(testMetrics.return3M, return3Ms, false),
      beta3YrScore: calculatePercentileRank(testMetrics.beta3Yr, beta3Yrs, true)
    }
    
    // Build distribution arrays with ticker names
    const peRatiosWithTickers = constituentMetrics
      .map(c => ({ ticker: c.ticker, value: c.metrics.peRatio }))
      .filter(x => x.value !== null)
      .sort((a, b) => a.value! - b.value!)
    
    const evEbitdasWithTickers = constituentMetrics
      .map(c => ({ ticker: c.ticker, value: c.metrics.evEbitda }))
      .filter(x => x.value !== null)
      .sort((a, b) => a.value! - b.value!)
    
    const evSalesWithTickers = constituentMetrics
      .map(c => ({ ticker: c.ticker, value: c.metrics.evSales }))
      .filter(x => x.value !== null)
      .sort((a, b) => a.value! - b.value!)
    
    const return3MsWithTickers = constituentMetrics
      .map(c => ({ ticker: c.ticker, value: c.metrics.return3M }))
      .filter(x => x.value !== null)
      .sort((a, b) => b.value! - a.value!) // Higher is better
    
    const beta3YrsWithTickers = constituentMetrics
      .map(c => ({ ticker: c.ticker, value: c.metrics.beta3Yr }))
      .filter(x => x.value !== null)
      .sort((a, b) => a.value! - b.value!)
    
    // Calculate rankings
    const peRank = peRatiosWithTickers.findIndex(x => x.ticker.toUpperCase() === testTicker) + 1
    const evEbitdaRank = evEbitdasWithTickers.findIndex(x => x.ticker.toUpperCase() === testTicker) + 1
    const evSalesRank = evSalesWithTickers.findIndex(x => x.ticker.toUpperCase() === testTicker) + 1
    const return3MRank = return3MsWithTickers.findIndex(x => x.ticker.toUpperCase() === testTicker) + 1
    const beta3YrRank = beta3YrsWithTickers.findIndex(x => x.ticker.toUpperCase() === testTicker) + 1
    
    const result: BenchmarkTestResult = {
      success: true,
      timestamp: new Date().toISOString(),
      testTicker,
      assignedBenchmark,
      benchmarkConstituents: {
        total: constituentTickers.length,
        withFactSet: constituentTickers.length - noFactSet.length,
        withYahoo: constituentTickers.length - noYahoo.length,
        withCompleteData: constituentMetrics.length,
        tickers: constituentTickers
      },
      testTickerMetrics: {
        peRatio: testMetrics.peRatio,
        evEbitda: testMetrics.evEbitda,
        evSales: testMetrics.evSales,
        return3M: testMetrics.return3M,
        beta3Yr: testMetrics.beta3Yr
      },
      testTickerScores: testScores,
      benchmarkMetricsDistribution: {
        peRatios: peRatiosWithTickers,
        evEbitdas: evEbitdasWithTickers,
        evSales: evSalesWithTickers,
        return3Ms: return3MsWithTickers,
        beta3Yrs: beta3YrsWithTickers
      },
      ranking: {
        peRatio: peRank > 0 ? `${peRank} of ${peRatiosWithTickers.length}` : 'N/A',
        evEbitda: evEbitdaRank > 0 ? `${evEbitdaRank} of ${evEbitdasWithTickers.length}` : 'N/A',
        evSales: evSalesRank > 0 ? `${evSalesRank} of ${evSalesWithTickers.length}` : 'N/A',
        return3M: return3MRank > 0 ? `${return3MRank} of ${return3MsWithTickers.length}` : 'N/A',
        beta3Yr: beta3YrRank > 0 ? `${beta3YrRank} of ${beta3YrsWithTickers.length}` : 'N/A'
      },
      missingData: {
        noFactSet,
        noYahoo,
        incompleteMetrics
      }
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Benchmark test error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to run benchmark test'
      },
      { status: 500 }
    )
  }
}
