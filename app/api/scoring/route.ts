import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
  calculatePercentileScores,
  calculatePercentileRank,
  calculateCompositeScores,
  calculateTotalScore,
  parseScoreWeightings,
  calculateBenchmarkRelativeScores,
  calculateBenchmarkConstituentScores,
  type FactSetData,
  type ScoreWeights,
  type StockScore,
  type IndividualMetrics
} from '@/lib/calculators/scoring'
import { fetchHistoricalPricesInBatches } from '@/lib/services/yahooFinance'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for complex calculations

interface HoldingData {
  stock_ticker: string
  shares: number
  market_value: number
}

interface BenchmarkWeighting {
  ticker: string
  spy: number | null
  qqq: number | null
}

interface GicsBenchmarkData {
  Ticker: string
  BENCHMARK1: string | null
  BENCHMARK2: string | null
  BENCHMARK3: string | null
  BENCHMARK_CUSTOM: string | null
}

/**
 * Fetch benchmark constituents from weightings_universe table
 * Returns tickers that have a non-null weight in the specified benchmark
 */
async function fetchBenchmarkConstituents(
  supabase: any,
  benchmarkTicker: string
): Promise<string[]> {
  // Normalize to uppercase for consistency
  const normalizedTicker = benchmarkTicker.toUpperCase()
  
  // Map benchmark ticker to column name in weightings_universe
  // The table has columns: Ticker, Name, SPY, QQQ, SOXX, SMH, ARKK, etc.
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
    console.warn(`Benchmark ${normalizedTicker} not found in weightings_universe columns`)
    return []
  }
  
  try {
    const { data, error } = await supabase
      .from('weightings_universe')
      .select(`"Ticker", "${columnName}"`)
      .not(columnName, 'is', null)
    
    if (error) {
      console.error(`Error fetching constituents for ${normalizedTicker}:`, error)
      return []
    }
    
    const constituents = (data || [])
      .filter((row: any) => row[columnName] && row[columnName] !== '-')
      .map((row: any) => row.Ticker)
    
    console.log(`Found ${constituents.length} constituents for ${normalizedTicker}`)
    return constituents
  } catch (error) {
    console.error(`Exception fetching constituents for ${normalizedTicker}:`, error)
    return []
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const profile = searchParams.get('profile') || 'BASE'
    const benchmarkColumn = searchParams.get('benchmark') || 'BENCHMARK1'
    
    console.log(`=== Scoring API: Starting calculation for profile ${profile}, benchmark ${benchmarkColumn} ===`)
    
    const supabase = createServiceRoleClient()
    
    console.log('Step 1: Fetching holdings...')
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
    
    console.log(`Loaded ${holdingsArray.length} unique holdings`)
    
    console.log('Step 2: Fetching FactSet data...')
    const { data: factsetData, error: factsetError } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "EPS EST NTM",
        "EPS EST NTM - 30 days ago",
        "EPS EST NTM - 90 days ago",
        "EPS surprise last qtr",
        "Sales LTM",
        "Sales EST NTM",
        "SALES EST NTM - 30 days ago",
        "SALES EST NTM - 90 days ago",
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
        "1 month volatility",
        "3 yr beta",
        "EV/EBITDA - NTM",
        "EV/Sales - NTM",
        "P/E NTM",
        "52 week high"
      `)
      .in('Ticker', tickers)
    
    if (factsetError) {
      console.error('FactSet fetch error:', factsetError)
    }
    
    const factsetMap = new Map<string, FactSetData>()
    factsetData?.forEach((row: any) => {
      factsetMap.set(row.Ticker.toUpperCase(), row as FactSetData)
    })
    
    console.log(`Loaded FactSet data for ${factsetMap.size} tickers`)
    
    console.log('Step 3: Fetching benchmark weightings from weightings_universe...')
    let weightingsData: any[] = []
    try {
      const weightingsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/weightings`)
      const weightingsResult = await weightingsResponse.json()
      
      if (weightingsResult.success && weightingsResult.data) {
        weightingsData = weightingsResult.data
        console.log(`Fetched ${weightingsData.length} weightings from weightings_universe`)
      } else {
        console.warn('Failed to fetch weightings from API:', weightingsResult.message)
      }
    } catch (error) {
      console.warn('Error fetching weightings:', error)
    }
    
    const weightingsMap = new Map<string, BenchmarkWeighting>()
    weightingsData.forEach((w: any) => {
      // Map to BenchmarkWeighting structure (ticker, spy, qqq)
      weightingsMap.set(w.ticker.toUpperCase(), {
        ticker: w.ticker,
        spy: w.spy,
        qqq: w.qqq
      })
    })
    
    // 3b. Fetch GICS benchmark data
    console.log('Step 3b: Fetching GICS benchmark data...')
    const { data: gicsBenchmarkData } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "BENCHMARK1", "BENCHMARK2", "BENCHMARK3", "BENCHMARK_CUSTOM"')
      .in('"Ticker"', tickers)
    
    const gicsBenchmarkMap = new Map<string, GicsBenchmarkData>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      gicsBenchmarkMap.set(g.Ticker.toUpperCase(), g)
    })
    
    console.log(`Loaded GICS benchmark data for ${gicsBenchmarkMap.size} tickers`)
    
    // 3c. Get unique benchmark tickers and fetch their FactSet data
    console.log('Step 3c: Fetching benchmark ETF data...')
    const uniqueBenchmarks = new Set<string>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      if (g.BENCHMARK1) uniqueBenchmarks.add(g.BENCHMARK1)
      if (g.BENCHMARK2) uniqueBenchmarks.add(g.BENCHMARK2)
      if (g.BENCHMARK3) uniqueBenchmarks.add(g.BENCHMARK3)
      if (g.BENCHMARK_CUSTOM) uniqueBenchmarks.add(g.BENCHMARK_CUSTOM)
    })
    
    const benchmarkTickers = Array.from(uniqueBenchmarks)
      .filter(t => t && t.trim() !== '')
      .map(t => t.toUpperCase()) // Convert to uppercase for FactSet query
    console.log(`Found ${benchmarkTickers.length} unique benchmark tickers:`, benchmarkTickers)
    
    // Fetch FactSet data for benchmarks
    const { data: benchmarkFactsetData } = await supabase
      .from('factset_data_v2')
      .select(`
        "Ticker",
        "P/E NTM",
        "EV/EBITDA - NTM",
        "EV/Sales - NTM",
        "PRICE",
        "1 month volatility",
        "3 yr beta",
        "52 week high",
        "Consensus Price Target",
        "EPS surprise last qtr",
        "SALES surprise last qtr",
        "EPS EST NTM",
        "EPS EST NTM - 30 days ago",
        "EPS EST NTM - 90 days ago",
        "Sales EST NTM",
        "SALES EST NTM - 30 days ago",
        "SALES EST NTM - 90 days ago"
      `)
      .in('Ticker', benchmarkTickers)
    
    const benchmarkFactsetMap = new Map<string, any>()
    benchmarkFactsetData?.forEach((row: any) => {
      benchmarkFactsetMap.set(row.Ticker.toUpperCase(), row)
    })
    
    console.log(`Loaded benchmark FactSet data for ${benchmarkFactsetMap.size} ETFs`)
    
    console.log('Step 4: Fetching score weightings...')
    const { data: scoreWeightingsData, error: scoreWeightingsError } = await supabase
      .from('score_weightings')
      .select('profile_name, category, metric_name, metric_weight, category_weight')
      .eq('profile_name', profile)
    
    if (scoreWeightingsError || !scoreWeightingsData || scoreWeightingsData.length === 0) {
      throw new Error(`Failed to fetch score weightings for profile ${profile}`)
    }
    
    const { weights, categoryWeights } = parseScoreWeightings(
      scoreWeightingsData as ScoreWeights[],
      profile
    )
    
    console.log(`Loaded weightings for profile ${profile}`)
    console.log('Category weights:', Object.fromEntries(categoryWeights))
    console.log('QUALITY metric weights:', Object.fromEntries(weights.get('QUALITY')?.metricWeights || []))
    
    console.log('Step 5: Fetching historical prices from Yahoo Finance...')
    
    // Collect all unique tickers we'll need historical prices for
    const allTickersForYahoo = new Set<string>([
      ...tickers,  // Holdings
      ...benchmarkTickers  // Benchmark ETFs
    ])
    
    // Add all tickers from weightings_universe (for constituent-based scoring)
    console.log('Step 5a: Fetching all tickers from weightings_universe for historical prices...')
    const { data: allWeightingsTickers } = await supabase
      .from('weightings_universe')
      .select('"Ticker"')
      .limit(5000)
    
    if (allWeightingsTickers) {
      allWeightingsTickers.forEach((row: any) => {
        if (row.Ticker) {
          allTickersForYahoo.add(row.Ticker)
        }
      })
    }
    
    console.log(`Fetching historical prices for ${allTickersForYahoo.size} tickers (holdings + benchmarks + weightings_universe)`)
    
    // Use batched fetching to avoid overwhelming the system and Yahoo Finance API
    // Batch size: 10 tickers at a time, 500ms delay between batches for better rate limiting
    const historicalPricesMap = await fetchHistoricalPricesInBatches(
      Array.from(allTickersForYahoo),
      10,  // batch size (reduced from 15)
      500  // delay in ms (increased from 200ms)
    )
    
    console.log('Step 6: Extracting individual metrics...')
    const holdingsWithMetrics = holdingsArray
      .map(holding => {
        const ticker = holding.stock_ticker.toUpperCase()
        const factset = factsetMap.get(ticker)
        const yahoo = historicalPricesMap.get(ticker)
        const gicsBenchmark = gicsBenchmarkMap.get(ticker)
        
        if (!factset || !yahoo) {
          console.warn(`Missing data for ${ticker}`)
          return null
        }
        
        const metrics = extractIndividualMetrics(factset, yahoo)
        
        return {
          ticker: holding.stock_ticker,
          metrics,
          gicsBenchmark
        }
      })
      .filter(m => m !== null) as Array<{ 
        ticker: string
        metrics: IndividualMetrics
        gicsBenchmark: GicsBenchmarkData | undefined
      }>
    
    console.log(`Extracted metrics for ${holdingsWithMetrics.length} holdings`)
    
    console.log('Step 7: Fetching universe data for percentile calculations...')
    
    // Supabase has a hard 1000 row limit, so we need to fetch in batches
    const batchSize = 1000
    let universeData: any[] = []
    let start = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('factset_data_v2')
        .select(`
          "Ticker",
          "EPS EST NTM",
          "EPS EST NTM - 30 days ago",
          "EPS EST NTM - 90 days ago",
          "EPS surprise last qtr",
          "Sales LTM",
          "Sales EST NTM",
          "SALES EST NTM - 30 days ago",
          "SALES EST NTM - 90 days ago",
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
          "1 month volatility",
          "3 yr beta"
        `)
        .range(start, start + batchSize - 1)

      if (error) {
        console.error('Universe data fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch universe data' }, { status: 500 })
      }

      if (data && data.length > 0) {
        universeData = universeData.concat(data)
        start += batchSize
        hasMore = data.length === batchSize
      } else {
        hasMore = false
      }
    }
    
    console.log(`Loaded ${universeData.length} universe tickers for percentile calculation (fetched in batches of ${batchSize})`)
    
    // Extract metrics from all universe tickers (using dummy Yahoo data since we only need FactSet metrics)
    const dummyYahoo = { currentPrice: 0, price30DaysAgo: null, price90DaysAgo: null, price365DaysAgo: null, maxDrawdown: null }
    const universeMetrics = (universeData || []).map(ticker => 
      extractIndividualMetrics(ticker as FactSetData, dummyYahoo)
    )
    
    // Extract universe-wide metric arrays for percentile calculation
    const universeTargetPrices = universeMetrics.map(m => m.targetPriceUpside)
    const universeEpsSurprises = universeMetrics.map(m => m.epsSurprise)
    const universeRevSurprises = universeMetrics.map(m => m.revSurprise)
    const universeNtmEpsChanges = universeMetrics.map(m => m.ntmEpsChange)
    const universeNtmRevChanges = universeMetrics.map(m => m.ntmRevChange)
    const universeRoicTTMs = universeMetrics.map(m => m.roicTTM)
    const universeGrossProfitabilities = universeMetrics.map(m => m.grossProfitability)
    const universeAccruals = universeMetrics.map(m => m.accruals)
    const universeFcfToAssets = universeMetrics.map(m => m.fcfToAssets)
    const universeRoic3Yrs = universeMetrics.map(m => m.roic3Yr)
    const universeEbitdaMargins = universeMetrics.map(m => m.ebitdaMargin)
    
    // Also extract VALUE, MOMENTUM, RISK metrics for fallback
    const universePeRatios = universeMetrics.map(m => m.peRatio)
    const universeEvEbitdas = universeMetrics.map(m => m.evEbitda)
    const universeEvSales = universeMetrics.map(m => m.evSales)
    const universeReturn12MEx1Ms = universeMetrics.map(m => m.return12MEx1M)
    const universeReturn3Ms = universeMetrics.map(m => m.return3M)
    const universePct52WeekHighs = universeMetrics.map(m => m.pct52WeekHigh)
    const universeBeta3Yrs = universeMetrics.map(m => m.beta3Yr)
    const universeVolatility30Days = universeMetrics.map(m => m.volatility30Day)
    const universeMaxDrawdowns = universeMetrics.map(m => m.maxDrawdown)
    
    // 7b. Calculate QUALITY scores using universe-wide percentile ranking
    console.log('Step 7b: Calculating QUALITY percentile scores across universe...')
    const qualityPercentileScores = holdingsWithMetrics.map(holding => ({
      roicTTMScore: calculatePercentileRank(holding.metrics.roicTTM, universeRoicTTMs, false),
      grossProfitabilityScore: calculatePercentileRank(holding.metrics.grossProfitability, universeGrossProfitabilities, false),
      accrualsScore: calculatePercentileRank(holding.metrics.accruals, universeAccruals, true), // Lower is better
      fcfToAssetsScore: calculatePercentileRank(holding.metrics.fcfToAssets, universeFcfToAssets, false),
      roic3YrScore: calculatePercentileRank(holding.metrics.roic3Yr, universeRoic3Yrs, false),
      ebitdaMarginScore: calculatePercentileRank(holding.metrics.ebitdaMargin, universeEbitdaMargins, false)
    }))
    
    // 7c. Calculate percentile scores for stock-specific metrics (using universe)
    console.log('Step 7c: Calculating stock-specific percentile scores across universe...')
    const stockSpecificScores = holdingsWithMetrics.map(holding => ({
      targetPriceUpsideScore: calculatePercentileRank(holding.metrics.targetPriceUpside, universeTargetPrices, false),
      epsSurpriseScore: calculatePercentileRank(holding.metrics.epsSurprise, universeEpsSurprises, false),
      revSurpriseScore: calculatePercentileRank(holding.metrics.revSurprise, universeRevSurprises, false),
      ntmEpsChangeScore: calculatePercentileRank(holding.metrics.ntmEpsChange, universeNtmEpsChanges, false),
      ntmRevChangeScore: calculatePercentileRank(holding.metrics.ntmRevChange, universeNtmRevChanges, false)
    }))
    
    console.log(`Step 8: Calculating benchmark constituent-based scores using ${benchmarkColumn}...`)
    
    // Build a map of benchmark ticker -> constituent metrics
    const benchmarkConstituentsCache = new Map<string, IndividualMetrics[]>()
    
    // Get unique benchmark tickers from holdings
    const uniqueHoldingBenchmarks = new Set<string>()
    holdingsWithMetrics.forEach(holding => {
      const gicsBenchmark = holding.gicsBenchmark
      if (gicsBenchmark) {
        let benchmarkTicker: string | null = null
        switch (benchmarkColumn) {
          case 'BENCHMARK1':
            benchmarkTicker = gicsBenchmark.BENCHMARK1
            break
          case 'BENCHMARK2':
            benchmarkTicker = gicsBenchmark.BENCHMARK2
            break
          case 'BENCHMARK3':
            benchmarkTicker = gicsBenchmark.BENCHMARK3
            break
          case 'BENCHMARK_CUSTOM':
            benchmarkTicker = gicsBenchmark.BENCHMARK_CUSTOM
            break
        }
        if (benchmarkTicker) {
          uniqueHoldingBenchmarks.add(benchmarkTicker.toUpperCase())
        }
      }
    })
    
    console.log(`Found ${uniqueHoldingBenchmarks.size} unique benchmarks in holdings:`, Array.from(uniqueHoldingBenchmarks))
    
    // Fetch constituents for each unique benchmark
    for (const benchmarkTicker of uniqueHoldingBenchmarks) {
      console.log(`\n📊 Fetching constituents for benchmark: ${benchmarkTicker}`)
      const constituentTickers = await fetchBenchmarkConstituents(supabase, benchmarkTicker)
      
      if (constituentTickers.length >= 10) { // Minimum 10 constituents for meaningful ranking
        console.log(`✅ ${benchmarkTicker} has ${constituentTickers.length} constituents - using constituent-based ranking`)
        console.log(`   Sample constituents: ${constituentTickers.slice(0, 5).join(', ')}...`)
        
        // Fetch FactSet data for constituents (including QUALITY and MOMENTUM metrics)
        const { data: constituentFactsetData } = await supabase
          .from('factset_data_v2')
          .select(`
            "Ticker",
            "P/E NTM",
            "EV/EBITDA - NTM",
            "EV/Sales - NTM",
            "PRICE",
            "Consensus Price Target",
            "1 month volatility",
            "3 yr beta",
            "52 week high",
            "EPS surprise last qtr",
            "SALES surprise last qtr",
            "EPS EST NTM",
            "EPS EST NTM - 90 days ago",
            "Sales EST NTM",
            "SALES EST NTM - 90 days ago",
            "ROIC 1 YR",
            "ROIC  3YR",
            "Gross Profit LTM",
            "Total assets",
            "acrcrurals %",
            "FCF",
            "EBITDA LTM",
            "Sales LTM"
          `)
          .in('Ticker', constituentTickers)
        
        // Extract metrics for each constituent
        const constituentMetrics: IndividualMetrics[] = []
        const dummyYahoo = { 
          currentPrice: 0, 
          price30DaysAgo: null, 
          price90DaysAgo: null, 
          price365DaysAgo: null, 
          maxDrawdown: null 
        }
        
        constituentFactsetData?.forEach((factset: any) => {
          const yahoo = historicalPricesMap.get(factset.Ticker.toUpperCase()) || dummyYahoo
          constituentMetrics.push(extractIndividualMetrics(factset as FactSetData, yahoo))
        })
        
        benchmarkConstituentsCache.set(benchmarkTicker, constituentMetrics)
        console.log(`✅ Successfully loaded ${constituentMetrics.length} constituent metrics for ${benchmarkTicker}`)
        console.log(`   (${constituentTickers.length} total constituents → ${constituentFactsetData?.length || 0} in FactSet → ${constituentMetrics.length} with metrics)`)
      } else {
        console.warn(`⚠️  Benchmark ${benchmarkTicker} has only ${constituentTickers.length} constituents, falling back to universe percentile`)
      }
    }
    
    const finalScores: StockScore[] = holdingsWithMetrics.map((holding, index) => {
      const gicsBenchmark = holding.gicsBenchmark
      
      // Get benchmark ticker based on selected benchmark column
      let benchmarkTicker: string | null = null
      if (gicsBenchmark) {
        switch (benchmarkColumn) {
          case 'BENCHMARK1':
            benchmarkTicker = gicsBenchmark.BENCHMARK1
            break
          case 'BENCHMARK2':
            benchmarkTicker = gicsBenchmark.BENCHMARK2
            break
          case 'BENCHMARK3':
            benchmarkTicker = gicsBenchmark.BENCHMARK3
            break
          case 'BENCHMARK_CUSTOM':
            benchmarkTicker = gicsBenchmark.BENCHMARK_CUSTOM
            break
        }
      }
      
      let benchmarkRelativeScores: Partial<ReturnType<typeof calculateBenchmarkConstituentScores>> = {}
      
      if (benchmarkTicker) {
        const constituentMetrics = benchmarkConstituentsCache.get(benchmarkTicker.toUpperCase())
        
        if (constituentMetrics && constituentMetrics.length >= 10) {
          // Use constituent-based percentile ranking
          benchmarkRelativeScores = calculateBenchmarkConstituentScores(holding.metrics, constituentMetrics)
          
          // Log first holding for verification
          if (index === 0) {
            console.log(`\n🎯 SCORING METHOD VERIFICATION (First Holding: ${holding.ticker})`)
            console.log(`   Benchmark: ${benchmarkTicker}`)
            console.log(`   Method: CONSTITUENT-BASED PERCENTILE RANKING`)
            console.log(`   Constituents used: ${constituentMetrics.length}`)
            console.log(`   Sample scores:`)
            console.log(`     - P/E Score: ${benchmarkRelativeScores.peRatioScore}`)
            console.log(`     - 3M Return Score: ${benchmarkRelativeScores.return3MScore}`)
            console.log(`     - Beta Score: ${benchmarkRelativeScores.beta3YrScore}`)
          }
        } else {
          // Fall back to universe-wide percentile for VALUE, MOMENTUM, RISK
          console.warn(`⚠️  No constituents found for ${benchmarkTicker}, using universe percentile for ${holding.ticker}`)
          
          benchmarkRelativeScores = {
            peRatioScore: calculatePercentileRank(holding.metrics.peRatio, universePeRatios, true),
            evEbitdaScore: calculatePercentileRank(holding.metrics.evEbitda, universeEvEbitdas, true),
            evSalesScore: calculatePercentileRank(holding.metrics.evSales, universeEvSales, true),
            targetPriceUpsideScore: calculatePercentileRank(holding.metrics.targetPriceUpside, universeTargetPrices, false),
            return12MEx1MScore: calculatePercentileRank(holding.metrics.return12MEx1M, universeReturn12MEx1Ms, false),
            return3MScore: calculatePercentileRank(holding.metrics.return3M, universeReturn3Ms, false),
            pct52WeekHighScore: calculatePercentileRank(holding.metrics.pct52WeekHigh, universePct52WeekHighs, false),
            beta3YrScore: calculatePercentileRank(holding.metrics.beta3Yr, universeBeta3Yrs, true),
            volatility30DayScore: calculatePercentileRank(holding.metrics.volatility30Day, universeVolatility30Days, true),
            maxDrawdownScore: calculatePercentileRank(holding.metrics.maxDrawdown, universeMaxDrawdowns, true)
          }
          
          if (index === 0) {
            console.log(`\n🎯 SCORING METHOD VERIFICATION (First Holding: ${holding.ticker})`)
            console.log(`   Benchmark: ${benchmarkTicker}`)
            console.log(`   Method: UNIVERSE-WIDE PERCENTILE RANKING (FALLBACK)`)
            console.log(`   Universe size: ${universeMetrics.length}`)
          }
        }
      } else {
        console.warn(`⚠️  No benchmark ticker found for ${holding.ticker} in ${benchmarkColumn}`)
      }
      
      // Combine benchmark-relative scores with QUALITY percentile scores
      const qualityScores = qualityPercentileScores[index]
      
      // Debug: Log quality scores for first holding
      if (index === 0) {
        console.log('Sample quality scores:', {
          roicTTM: qualityScores.roicTTMScore,
          grossProf: qualityScores.grossProfitabilityScore,
          accruals: qualityScores.accrualsScore
        })
      }
      
      const stockSpecific = stockSpecificScores[index]
      
      // BUG FIX #5: Use benchmark scores with fallback to universe scores
      const scored = {
        ...holding.metrics,
        // VALUE from benchmark-relative
        peRatioScore: benchmarkRelativeScores.peRatioScore ?? null,
        evEbitdaScore: benchmarkRelativeScores.evEbitdaScore ?? null,
        evSalesScore: benchmarkRelativeScores.evSalesScore ?? null,
        targetPriceUpsideScore: benchmarkRelativeScores.targetPriceUpsideScore ?? stockSpecific.targetPriceUpsideScore,
        // MOMENTUM from benchmark-relative with fallback to universe
        return12MEx1MScore: benchmarkRelativeScores.return12MEx1MScore ?? null,
        return3MScore: benchmarkRelativeScores.return3MScore ?? null,
        pct52WeekHighScore: benchmarkRelativeScores.pct52WeekHighScore ?? null,
        epsSurpriseScore: benchmarkRelativeScores.epsSurpriseScore ?? stockSpecific.epsSurpriseScore,
        revSurpriseScore: benchmarkRelativeScores.revSurpriseScore ?? stockSpecific.revSurpriseScore,
        ntmEpsChangeScore: benchmarkRelativeScores.ntmEpsChangeScore ?? stockSpecific.ntmEpsChangeScore,
        ntmRevChangeScore: benchmarkRelativeScores.ntmRevChangeScore ?? stockSpecific.ntmRevChangeScore,
        // QUALITY from benchmark-relative with fallback to universe
        roicTTMScore: benchmarkRelativeScores.roicTTMScore ?? qualityScores.roicTTMScore,
        grossProfitabilityScore: benchmarkRelativeScores.grossProfitabilityScore ?? qualityScores.grossProfitabilityScore,
        accrualsScore: benchmarkRelativeScores.accrualsScore ?? qualityScores.accrualsScore,
        fcfToAssetsScore: benchmarkRelativeScores.fcfToAssetsScore ?? qualityScores.fcfToAssetsScore,
        roic3YrScore: benchmarkRelativeScores.roic3YrScore ?? qualityScores.roic3YrScore,
        ebitdaMarginScore: benchmarkRelativeScores.ebitdaMarginScore ?? qualityScores.ebitdaMarginScore,
        // RISK from benchmark-relative
        beta3YrScore: benchmarkRelativeScores.beta3YrScore ?? null,
        volatility30DayScore: benchmarkRelativeScores.volatility30DayScore ?? null,
        maxDrawdownScore: benchmarkRelativeScores.maxDrawdownScore ?? null,
        financialLeverageScore: null
      }
      
      const composites = calculateCompositeScores(scored, weights)
      const total = calculateTotalScore(composites, categoryWeights)
      
      // Debug: Log composites for first holding
      if (index === 0) {
        console.log('Sample composite scores:', {
          value: composites.valueScore,
          momentum: composites.momentumScore,
          quality: composites.qualityScore,
          risk: composites.riskScore,
          total: total.totalScore
        })
        console.log('Sample weights check:', {
          hasValueWeights: weights.has('VALUE'),
          hasQualityWeights: weights.has('QUALITY'),
          qualityMetricWeights: weights.get('QUALITY')?.metricWeights.size
        })
      }
      
      return {
        ticker: holding.ticker,
        ...scored,
        ...composites,
        ...total
      }
    })
    
    console.log('Step 9: Enriching with holding and benchmark data...')
    const enrichedScores = finalScores.map(score => {
      const holding = uniqueHoldings.get(score.ticker)
      const weighting = weightingsMap.get(score.ticker.toUpperCase())
      const gicsBenchmark = gicsBenchmarkMap.get(score.ticker.toUpperCase())
      
      return {
        ...score,
        shares: holding?.shares || 0,
        marketValue: holding?.market_value || 0,
        spyWeight: weighting?.spy || null,
        qqqWeight: weighting?.qqq || null,
        benchmark1: gicsBenchmark?.BENCHMARK1 || null,
        benchmark2: gicsBenchmark?.BENCHMARK2 || null,
        benchmark3: gicsBenchmark?.BENCHMARK3 || null,
        benchmarkCustom: gicsBenchmark?.BENCHMARK_CUSTOM || null
      }
    })
    
    // Sort by total score (descending)
    enrichedScores.sort((a, b) => {
      if (a.totalScore === null) return 1
      if (b.totalScore === null) return -1
      return b.totalScore - a.totalScore
    })
    
    console.log(`=== Scoring API: Completed successfully ===`)
    
    return NextResponse.json({
      success: true,
      profile,
      data: enrichedScores,
      metadata: {
        holdingsCount: enrichedScores.length,
        holdingsDate: latestDate,
        calculatedAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Scoring API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate scores'
      },
      { status: 500 }
    )
  }
}

