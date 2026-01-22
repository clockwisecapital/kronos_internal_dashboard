import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
  type FactSetData,
  type IndividualMetrics
} from '@/lib/calculators/scoring'
import { fetchHistoricalPricesInBatches } from '@/lib/services/yahooFinance'

export const runtime = 'nodejs'
export const maxDuration = 300

interface HoldingData {
  stock_ticker: string
  shares: number
  market_value: number
}

interface DiagnosticResult {
  success: boolean
  timestamp: string
  profile: string
  benchmark: string
  summary: {
    totalHoldings: number
    holdingsWithFactSet: number
    holdingsWithYahoo: number
    holdingsWithBenchmark: number
    holdingsWithCompleteData: number
  }
  missingData: {
    noFactSet: string[]
    noYahoo: string[]
    noBenchmark: string[]
    nullValueScores: Array<{
      ticker: string
      reason: string
      missingMetrics: string[]
    }>
  }
  benchmarkAnalysis: Array<{
    benchmark: string
    constituentCount: number
    holdingsCount: number
    tickers: string[]
    status: 'OK' | 'WARNING' | 'ERROR'
    message: string
  }>
  weightingsAnalysis: {
    totalWeightings: number
    profileExists: boolean
    categories: Array<{
      category: string
      categoryWeight: number
      metrics: Array<{
        name: string
        weight: number
      }>
    }>
  }
  dataQualityIssues: Array<{
    ticker: string
    severity: 'ERROR' | 'WARNING' | 'INFO'
    category: string
    issue: string
    impact: string
  }>
}

async function fetchBenchmarkConstituents(
  supabase: any,
  benchmarkTicker: string
): Promise<string[]> {
  const normalizedTicker = benchmarkTicker.toUpperCase()
  
  const columnMap: Record<string, string> = {
    'SPY': 'SPY',
    'QQQ': 'QQQ',
    'SOXX': 'SOXX',
    'SMH': 'SMH',
    'ARKK': 'ARKK',
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
    'IGV': 'IGV',
    'ITA': 'ITA'
  }
  
  const columnName = columnMap[normalizedTicker]
  
  if (!columnName) {
    return []
  }
  
  try {
    const { data, error } = await supabase
      .from('weightings_universe')
      .select(`"Ticker", "${columnName}"`)
      .not(columnName, 'is', null)
    
    if (error) {
      return []
    }
    
    const constituents = (data || [])
      .filter((row: any) => row[columnName] && row[columnName] !== '-')
      .map((row: any) => row.Ticker)
    
    return constituents
  } catch (error) {
    return []
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const profile = searchParams.get('profile') || 'BASE'
    const benchmarkColumn = searchParams.get('benchmark') || 'BENCHMARK1'
    
    const supabase = createServiceRoleClient()
    
    const dataQualityIssues: DiagnosticResult['dataQualityIssues'] = []
    
    // Step 1: Fetch holdings
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
    
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('stock_ticker, shares, market_value')
      .eq('date', latestDate)
    
    if (holdingsError || !holdings || holdings.length === 0) {
      throw new Error('Failed to fetch holdings')
    }
    
    // Deduplicate holdings
    const uniqueHoldings = new Map<string, HoldingData>()
    holdings.forEach((h: HoldingData) => {
      if (!uniqueHoldings.has(h.stock_ticker)) {
        uniqueHoldings.set(h.stock_ticker, h)
      }
    })
    
    const holdingsArray = Array.from(uniqueHoldings.values())
    const tickers = holdingsArray.map(h => h.stock_ticker)
    
    // Step 2: Fetch FactSet data
    const { data: factsetData, error: factsetError } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "EPS EST NTM",
        "EPS EST NTM - 30 days ago",
        "EPS surprise last qtr",
        "Sales LTM",
        "Sales EST NTM",
        "SALES EST NTM - 30 days ago",
        "SALES surprise last qtr",
        "EBITDA LTM",
        "PRICE",
        "Gross Profit LTM",
        "ROIC 1 YR",
        "ROIC  3YR",
        "acrcrurals %",
        "FCF",
        "Consensus Price Target",
        "Total assets",
        "2 month vol",
        "3 yr beta",
        "EV/EBITDA - NTM",
        "EV/Sales - NTM",
        "P/E NTM",
        "52 week high"
      `)
      .in('Ticker', tickers)
    
    const factsetMap = new Map<string, FactSetData>()
    factsetData?.forEach((row: any) => {
      factsetMap.set(row.Ticker.toUpperCase(), row as FactSetData)
    })
    
    // Step 3: Fetch GICS benchmark data
    const { data: gicsBenchmarkData } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "BENCHMARK1", "BENCHMARK2", "BENCHMARK3", "BENCHMARK_CUSTOM"')
      .in('"Ticker"', tickers)
    
    const gicsBenchmarkMap = new Map<string, any>()
    gicsBenchmarkData?.forEach((g: any) => {
      gicsBenchmarkMap.set(g.Ticker.toUpperCase(), g)
    })
    
    // Step 4: Fetch score weightings
    const { data: scoreWeightingsData } = await supabase
      .from('score_weightings')
      .select('profile_name, category, metric_name, metric_weight, category_weight')
      .eq('profile_name', profile)
    
    // Step 5: Fetch historical prices (sample only for diagnostics)
    const sampleTickers = tickers.slice(0, 5) // Only fetch 5 for speed
    const historicalPricesMap = await fetchHistoricalPricesInBatches(sampleTickers, 5, 200)
    
    // Analyze missing data
    const noFactSet: string[] = []
    const noYahoo: string[] = []
    const noBenchmark: string[] = []
    const nullValueScores: DiagnosticResult['missingData']['nullValueScores'] = []
    
    let holdingsWithCompleteData = 0
    
    for (const ticker of tickers) {
      const upperTicker = ticker.toUpperCase()
      const hasFactSet = factsetMap.has(upperTicker)
      const hasBenchmark = gicsBenchmarkMap.has(upperTicker)
      
      if (!hasFactSet) {
        noFactSet.push(ticker)
        dataQualityIssues.push({
          ticker,
          severity: 'ERROR',
          category: 'Missing Data',
          issue: 'No FactSet data found',
          impact: 'Cannot calculate any VALUE, MOMENTUM, QUALITY, or RISK scores'
        })
      }
      
      if (!hasBenchmark) {
        noBenchmark.push(ticker)
        dataQualityIssues.push({
          ticker,
          severity: 'WARNING',
          category: 'Missing Benchmark',
          issue: `No benchmark assignment in gics_yahoo_finance`,
          impact: 'Will fall back to universe-wide percentile ranking'
        })
      }
      
      // Analyze VALUE metrics
      if (hasFactSet) {
        const factset = factsetMap.get(upperTicker)!
        const missingMetrics: string[] = []
        
        if (!factset['P/E NTM'] || factset['P/E NTM'] === '-' || factset['P/E NTM'] === '') {
          missingMetrics.push('P/E NTM')
        }
        if (!factset['EV/EBITDA - NTM'] || factset['EV/EBITDA - NTM'] === '-' || factset['EV/EBITDA - NTM'] === '') {
          missingMetrics.push('EV/EBITDA')
        }
        if (!factset['EV/Sales - NTM'] || factset['EV/Sales - NTM'] === '-' || factset['EV/Sales - NTM'] === '') {
          missingMetrics.push('EV/Sales')
        }
        if (!factset['Consensus Price Target'] || factset['Consensus Price Target'] === '-' || factset['Consensus Price Target'] === '') {
          missingMetrics.push('Target Price')
        }
        if (!factset['PRICE'] || factset['PRICE'] === '-' || factset['PRICE'] === '') {
          missingMetrics.push('Current Price')
        }
        
        if (missingMetrics.length > 0) {
          nullValueScores.push({
            ticker,
            reason: 'Missing or invalid VALUE metrics in FactSet',
            missingMetrics
          })
          
          dataQualityIssues.push({
            ticker,
            severity: 'WARNING',
            category: 'Incomplete Data',
            issue: `Missing VALUE metrics: ${missingMetrics.join(', ')}`,
            impact: 'VALUE score will be calculated with reduced metrics or may be null'
          })
        }
        
        if (missingMetrics.length === 0 && hasBenchmark) {
          holdingsWithCompleteData++
        }
      }
    }
    
    // Check Yahoo data for sample
    for (const ticker of sampleTickers) {
      if (!historicalPricesMap.has(ticker.toUpperCase())) {
        noYahoo.push(ticker)
      }
    }
    
    // Analyze benchmarks
    const benchmarkAnalysis: DiagnosticResult['benchmarkAnalysis'] = []
    const benchmarkGroups = new Map<string, string[]>()
    
    for (const [ticker, gicsData] of gicsBenchmarkMap.entries()) {
      let benchmarkTicker: string | null = null
      
      switch (benchmarkColumn) {
        case 'BENCHMARK1':
          benchmarkTicker = gicsData.BENCHMARK1
          break
        case 'BENCHMARK2':
          benchmarkTicker = gicsData.BENCHMARK2
          break
        case 'BENCHMARK3':
          benchmarkTicker = gicsData.BENCHMARK3
          break
        case 'BENCHMARK_CUSTOM':
          benchmarkTicker = gicsData.BENCHMARK_CUSTOM
          break
      }
      
      if (benchmarkTicker) {
        if (!benchmarkGroups.has(benchmarkTicker)) {
          benchmarkGroups.set(benchmarkTicker, [])
        }
        benchmarkGroups.get(benchmarkTicker)!.push(ticker)
      }
    }
    
    for (const [benchmark, tickerList] of benchmarkGroups.entries()) {
      const constituents = await fetchBenchmarkConstituents(supabase, benchmark)
      
      let status: 'OK' | 'WARNING' | 'ERROR' = 'OK'
      let message = 'Sufficient constituents for accurate ranking'
      
      if (constituents.length === 0) {
        status = 'ERROR'
        message = 'Benchmark not found in weightings_universe - will use universe-wide ranking'
        
        dataQualityIssues.push({
          ticker: tickerList.join(', '),
          severity: 'ERROR',
          category: 'Benchmark Issue',
          issue: `Benchmark ${benchmark} has no constituents in weightings_universe`,
          impact: 'Stocks will fall back to universe-wide percentile ranking instead of peer comparison'
        })
      } else if (constituents.length < 10) {
        status = 'WARNING'
        message = `Only ${constituents.length} constituents - will use universe-wide ranking (minimum 10 required)`
        
        dataQualityIssues.push({
          ticker: tickerList.join(', '),
          severity: 'WARNING',
          category: 'Benchmark Issue',
          issue: `Benchmark ${benchmark} has only ${constituents.length} constituents (minimum 10 required)`,
          impact: 'Will fall back to universe-wide percentile ranking'
        })
      }
      
      benchmarkAnalysis.push({
        benchmark,
        constituentCount: constituents.length,
        holdingsCount: tickerList.length,
        tickers: tickerList,
        status,
        message
      })
    }
    
    // Analyze weightings
    const weightingsAnalysis: DiagnosticResult['weightingsAnalysis'] = {
      totalWeightings: scoreWeightingsData?.length || 0,
      profileExists: (scoreWeightingsData?.length || 0) > 0,
      categories: []
    }
    
    if (!weightingsAnalysis.profileExists) {
      dataQualityIssues.push({
        ticker: 'ALL',
        severity: 'ERROR',
        category: 'Configuration',
        issue: `No weightings found for profile ${profile} in score_weightings table`,
        impact: 'Cannot calculate composite or total scores - all scores will be null'
      })
    } else {
      const categories = ['VALUE', 'MOMENTUM', 'QUALITY', 'RISK']
      
      for (const category of categories) {
        const categoryRows = scoreWeightingsData?.filter(w => w.category === category) || []
        const categoryRow = categoryRows.find(w => w.metric_name === null)
        const categoryWeight = categoryRow?.category_weight || 0
        
        const metrics = categoryRows
          .filter(w => w.metric_name !== null)
          .map(w => ({
            name: w.metric_name!,
            weight: w.metric_weight || 0
          }))
        
        weightingsAnalysis.categories.push({
          category,
          categoryWeight,
          metrics
        })
        
        if (categoryWeight === 0) {
          dataQualityIssues.push({
            ticker: 'ALL',
            severity: 'WARNING',
            category: 'Configuration',
            issue: `${category} category has 0 weight in profile ${profile}`,
            impact: `${category} scores will not contribute to total score`
          })
        }
        
        if (metrics.length === 0) {
          dataQualityIssues.push({
            ticker: 'ALL',
            severity: 'ERROR',
            category: 'Configuration',
            issue: `${category} category has no metric weights defined`,
            impact: `${category} composite score will be null`
          })
        }
      }
    }
    
    // Build summary
    const summary = {
      totalHoldings: holdingsArray.length,
      holdingsWithFactSet: holdingsArray.length - noFactSet.length,
      holdingsWithYahoo: holdingsArray.length - noYahoo.length, // Estimated
      holdingsWithBenchmark: holdingsArray.length - noBenchmark.length,
      holdingsWithCompleteData
    }
    
    const result: DiagnosticResult = {
      success: true,
      timestamp: new Date().toISOString(),
      profile,
      benchmark: benchmarkColumn,
      summary,
      missingData: {
        noFactSet,
        noYahoo,
        noBenchmark,
        nullValueScores
      },
      benchmarkAnalysis,
      weightingsAnalysis,
      dataQualityIssues: dataQualityIssues.sort((a, b) => {
        const severityOrder = { ERROR: 0, WARNING: 1, INFO: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      })
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Scoring diagnostics error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to run diagnostics'
      },
      { status: 500 }
    )
  }
}
