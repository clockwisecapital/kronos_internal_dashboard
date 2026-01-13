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
        "Sales EST NTM",
        "SALES EST NTM - 30 days ago"
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
    const { data: universeData, error: universeError } = await supabase
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
        "Total assets"
      `)
    
    if (universeError) {
      console.error('Universe data fetch error:', universeError)
      return NextResponse.json({ error: 'Failed to fetch universe data' }, { status: 500 })
    }
    
    console.log(`Loaded ${universeData?.length || 0} universe tickers for percentile calculation`)
    
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
      
      const stockSpecific = stockSpecificScores[index]
      
      const scored = {
        ...holding.metrics,
        // VALUE from benchmark-relative (except Target Price which is percentile)
        peRatioScore: benchmarkRelativeScores.peRatioScore ?? null,
        evEbitdaScore: benchmarkRelativeScores.evEbitdaScore ?? null,
        evSalesScore: benchmarkRelativeScores.evSalesScore ?? null,
        targetPriceUpsideScore: stockSpecific.targetPriceUpsideScore, // Percentile (ETFs don't have targets)
        // MOMENTUM from benchmark-relative (except EPS/Rev which are percentile)
        return12MEx1MScore: benchmarkRelativeScores.return12MEx1MScore ?? null,
        return3MScore: benchmarkRelativeScores.return3MScore ?? null,
        pct52WeekHighScore: benchmarkRelativeScores.pct52WeekHighScore ?? null,
        epsSurpriseScore: stockSpecific.epsSurpriseScore, // Percentile (ETFs don't have earnings)
        revSurpriseScore: stockSpecific.revSurpriseScore, // Percentile (ETFs don't have revenue)
        ntmEpsChangeScore: stockSpecific.ntmEpsChangeScore, // Percentile (ETFs don't have earnings)
        ntmRevChangeScore: stockSpecific.ntmRevChangeScore, // Percentile (ETFs don't have revenue)
        // QUALITY from percentile ranking
        roicTTMScore: qualityScores.roicTTMScore,
        grossProfitabilityScore: qualityScores.grossProfitabilityScore,
        accrualsScore: qualityScores.accrualsScore,
        fcfToAssetsScore: qualityScores.fcfToAssetsScore,
        roic3YrScore: qualityScores.roic3YrScore,
        ebitdaMarginScore: qualityScores.ebitdaMarginScore,
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

