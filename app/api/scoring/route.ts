import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
  calculatePercentileScores,
  calculateCompositeScores,
  calculateTotalScore,
  parseScoreWeightings,
  calculateBenchmarkRelativeScores,
  type FactSetData,
  type ScoreWeights,
  type StockScore,
  type IndividualMetrics
} from '@/lib/calculators/scoring'
import { fetchHistoricalPricesForScoring } from '@/lib/services/yahooFinance'

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const profile = searchParams.get('profile') || 'BASE'
    const benchmarkColumn = searchParams.get('benchmark') || 'BENCHMARK1'
    
    console.log(`=== Scoring API: Starting calculation for profile ${profile}, benchmark ${benchmarkColumn} ===`)
    
    const supabase = createServiceRoleClient()
    
    // 1. Fetch latest holdings
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
    
    // 2. Fetch FactSet data for all scoring metrics
    console.log('Step 2: Fetching FactSet data...')
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
    
    // 3. Fetch benchmark weightings (kept for backwards compatibility)
    console.log('Step 3: Fetching benchmark weightings...')
    const { data: weightingsData } = await supabase
      .from('weightings')
      .select('ticker, spy, qqq')
      .in('ticker', tickers)
    
    const weightingsMap = new Map<string, BenchmarkWeighting>()
    weightingsData?.forEach((w: BenchmarkWeighting) => {
      weightingsMap.set(w.ticker.toUpperCase(), w)
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
        "52 week high"
      `)
      .in('Ticker', benchmarkTickers)
    
    const benchmarkFactsetMap = new Map<string, any>()
    benchmarkFactsetData?.forEach((row: any) => {
      benchmarkFactsetMap.set(row.Ticker.toUpperCase(), row)
    })
    
    console.log(`Loaded benchmark FactSet data for ${benchmarkFactsetMap.size} ETFs`)
    
    // 4. Fetch score weightings configuration
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
    
    // 5. Fetch historical prices from Yahoo Finance (holdings + benchmarks)
    console.log('Step 5: Fetching historical prices from Yahoo Finance...')
    const allTickersForYahoo = [...tickers, ...benchmarkTickers]
    const historicalPricesPromises = allTickersForYahoo.map(ticker =>
      fetchHistoricalPricesForScoring(ticker)
        .then(data => ({ ticker, data }))
        .catch(error => {
          console.error(`Failed to fetch historical prices for ${ticker}:`, error)
          return {
            ticker,
            data: {
              currentPrice: 0,
              price30DaysAgo: null,
              price90DaysAgo: null,
              price365DaysAgo: null,
              maxDrawdown: null
            }
          }
        })
    )
    
    const historicalPricesResults = await Promise.all(historicalPricesPromises)
    const historicalPricesMap = new Map(
      historicalPricesResults.map(r => [r.ticker.toUpperCase(), r.data])
    )
    
    console.log(`Fetched historical prices for ${historicalPricesMap.size} tickers (holdings + benchmarks)`)
    
    // 6. Extract individual metrics for all holdings and benchmarks
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
    
    // 7. Calculate QUALITY scores using percentile ranking (holdings-relative)
    console.log('Step 7: Calculating QUALITY percentile scores...')
    const metricsOnly = holdingsWithMetrics.map(h => h.metrics)
    const qualityPercentileScores = calculatePercentileScores(metricsOnly)
    
    // 8. Calculate benchmark-relative scores for VALUE, MOMENTUM, RISK
    console.log(`Step 8: Calculating benchmark-relative scores using ${benchmarkColumn}...`)
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
      
      let benchmarkRelativeScores: Partial<ReturnType<typeof calculateBenchmarkRelativeScores>> = {}
      
      if (benchmarkTicker) {
        const benchmarkFactset = benchmarkFactsetMap.get(benchmarkTicker.toUpperCase())
        const benchmarkYahoo = historicalPricesMap.get(benchmarkTicker.toUpperCase())
        
        if (benchmarkFactset && benchmarkYahoo) {
          const benchmarkMetrics = extractIndividualMetrics(benchmarkFactset, benchmarkYahoo)
          benchmarkRelativeScores = calculateBenchmarkRelativeScores(holding.metrics, benchmarkMetrics)
        } else {
          console.warn(`Missing benchmark data for ${benchmarkTicker}`)
        }
      } else {
        console.warn(`No benchmark ticker found for ${holding.ticker} in ${benchmarkColumn}`)
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
      
      const scored = {
        ...holding.metrics,
        // VALUE, MOMENTUM, RISK from benchmark-relative (ensure no undefined values)
        peRatioScore: benchmarkRelativeScores.peRatioScore ?? null,
        evEbitdaScore: benchmarkRelativeScores.evEbitdaScore ?? null,
        evSalesScore: benchmarkRelativeScores.evSalesScore ?? null,
        targetPriceUpsideScore: benchmarkRelativeScores.targetPriceUpsideScore ?? null,
        return12MEx1MScore: benchmarkRelativeScores.return12MEx1MScore ?? null,
        return3MScore: benchmarkRelativeScores.return3MScore ?? null,
        pct52WeekHighScore: benchmarkRelativeScores.pct52WeekHighScore ?? null,
        epsSurpriseScore: benchmarkRelativeScores.epsSurpriseScore ?? null,
        revSurpriseScore: benchmarkRelativeScores.revSurpriseScore ?? null,
        ntmEpsChangeScore: benchmarkRelativeScores.ntmEpsChangeScore ?? null,
        ntmRevChangeScore: benchmarkRelativeScores.ntmRevChangeScore ?? null,
        beta3YrScore: benchmarkRelativeScores.beta3YrScore ?? null,
        volatility30DayScore: benchmarkRelativeScores.volatility30DayScore ?? null,
        maxDrawdownScore: benchmarkRelativeScores.maxDrawdownScore ?? null,
        financialLeverageScore: null,
        // QUALITY from percentile ranking
        roicTTMScore: qualityScores.roicTTMScore,
        grossProfitabilityScore: qualityScores.grossProfitabilityScore,
        accrualsScore: qualityScores.accrualsScore,
        fcfToAssetsScore: qualityScores.fcfToAssetsScore,
        roic3YrScore: qualityScores.roic3YrScore,
        ebitdaMarginScore: qualityScores.ebitdaMarginScore
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
    
    // 9. Enrich with holding and benchmark data
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

