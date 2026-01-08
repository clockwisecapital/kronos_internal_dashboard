import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'
import {
  extractIndividualMetrics,
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
    const benchmarkColumn = (searchParams.get('benchmark') || 'BENCHMARK1') as 'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3' | 'BENCHMARK_CUSTOM'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    
    console.log('=== Universe Scoring API: Starting ===')
    console.log(`Profile: ${profile}, Benchmark: ${benchmarkColumn}, Page: ${page}, PageSize: ${pageSize}`)
    
    const supabase = createServiceRoleClient()
    
    console.log('Getting total universe count...')
    const { count: totalCount } = await supabase
      .from('factset_data_v2')
      .select('*', { count: 'exact', head: true })
    
    const totalPages = Math.ceil((totalCount || 0) / pageSize)
    console.log(`Total universe tickers: ${totalCount}, Total pages: ${totalPages}`)
    
    console.log('Fetching all universe data for percentile calculations...')
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
    
    // Extract metrics from all universe tickers
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
    
    console.log(`Step 3: Fetching page ${page} tickers...`)
    const offset = (page - 1) * pageSize
    const { data: pageData, error: pageError } = await supabase
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
      .range(offset, offset + pageSize - 1)
      .order('Ticker', { ascending: true })
    
    if (pageError) {
      console.error('Page data fetch error:', pageError)
      return NextResponse.json({ error: 'Failed to fetch page data' }, { status: 500 })
    }
    
    console.log(`Loaded ${pageData?.length || 0} tickers for page ${page}`)
    
    const pageTickers = pageData?.map(row => row.Ticker) || []
    
    console.log('Fetching GICS benchmark data for page tickers...')
    const { data: gicsBenchmarkData } = await supabase
      .from('gics_yahoo_finance')
      .select('"Ticker", "BENCHMARK1", "BENCHMARK2", "BENCHMARK3", "BENCHMARK_CUSTOM"')
      .in('"Ticker"', pageTickers)
    
    const gicsBenchmarkMap = new Map<string, GicsBenchmarkData>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      gicsBenchmarkMap.set(g.Ticker.toUpperCase(), g)
    })
    
    console.log(`Loaded GICS benchmark data for ${gicsBenchmarkMap.size} tickers`)
    
    console.log('Fetching benchmark ETF data...')
    const uniqueBenchmarks = new Set<string>()
    gicsBenchmarkData?.forEach((g: GicsBenchmarkData) => {
      if (g.BENCHMARK1) uniqueBenchmarks.add(g.BENCHMARK1)
      if (g.BENCHMARK2) uniqueBenchmarks.add(g.BENCHMARK2)
      if (g.BENCHMARK3) uniqueBenchmarks.add(g.BENCHMARK3)
      if (g.BENCHMARK_CUSTOM) uniqueBenchmarks.add(g.BENCHMARK_CUSTOM)
    })
    
    const benchmarkTickers = Array.from(uniqueBenchmarks)
      .filter(t => t && t.trim() !== '')
      .map(t => t.toUpperCase())
    
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
    
    console.log('Fetching score weightings...')
    const { data: scoreWeightingsData, error: scoreWeightingsError } = await supabase
      .from('score_weightings')
      .select('profile_name, category, metric_name, metric_weight, category_weight')
      .eq('profile_name', profile)
    
    if (scoreWeightingsError || !scoreWeightingsData) {
      console.error('Score weightings fetch error:', scoreWeightingsError)
      return NextResponse.json({ error: 'Failed to fetch score weightings' }, { status: 500 })
    }
    
    const { weights, categoryWeights } = parseScoreWeightings(scoreWeightingsData as ScoreWeights[], profile)
    console.log(`Loaded weightings for profile ${profile}`)
    
    console.log('Fetching historical prices from Yahoo Finance...')
    const allTickersForYahoo = [...pageTickers, ...benchmarkTickers]
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
    
    console.log(`Fetched historical prices for ${historicalPricesMap.size} tickers (page + benchmarks)`)
    
    console.log('Extracting individual metrics...')
    const tickersWithMetrics = pageData
      ?.filter(ticker => {
        const yahoo = historicalPricesMap.get(ticker.Ticker.toUpperCase())
        if (!yahoo) {
          console.warn(`Missing Yahoo data for ${ticker.Ticker}`)
          return false
        }
        return true
      })
      .map(ticker => ({
        ticker: ticker.Ticker,
        metrics: extractIndividualMetrics(ticker as FactSetData, historicalPricesMap.get(ticker.Ticker.toUpperCase())!),
        gicsBenchmark: gicsBenchmarkMap.get(ticker.Ticker.toUpperCase())
      })) || []
    
    console.log(`Extracted metrics for ${tickersWithMetrics.length} tickers`)
    
    console.log('Calculating QUALITY percentile scores...')
    const qualityPercentileScores = tickersWithMetrics.map(ticker => ({
      roicTTMScore: calculatePercentileRank(ticker.metrics.roicTTM, universeRoicTTMs, false),
      grossProfitabilityScore: calculatePercentileRank(ticker.metrics.grossProfitability, universeGrossProfitabilities, false),
      accrualsScore: calculatePercentileRank(ticker.metrics.accruals, universeAccruals, true),
      fcfToAssetsScore: calculatePercentileRank(ticker.metrics.fcfToAssets, universeFcfToAssets, false),
      roic3YrScore: calculatePercentileRank(ticker.metrics.roic3Yr, universeRoic3Yrs, false),
      ebitdaMarginScore: calculatePercentileRank(ticker.metrics.ebitdaMargin, universeEbitdaMargins, false)
    }))
    
    console.log('Calculating stock-specific percentile scores...')
    const stockSpecificScores = tickersWithMetrics.map(ticker => ({
      targetPriceUpsideScore: calculatePercentileRank(ticker.metrics.targetPriceUpside, universeTargetPrices, false),
      epsSurpriseScore: calculatePercentileRank(ticker.metrics.epsSurprise, universeEpsSurprises, false),
      revSurpriseScore: calculatePercentileRank(ticker.metrics.revSurprise, universeRevSurprises, false),
      ntmEpsChangeScore: calculatePercentileRank(ticker.metrics.ntmEpsChange, universeNtmEpsChanges, false),
      ntmRevChangeScore: calculatePercentileRank(ticker.metrics.ntmRevChange, universeNtmRevChanges, false)
    }))
    
    console.log(`Calculating benchmark-relative scores using ${benchmarkColumn}...`)
    const finalScores: StockScore[] = tickersWithMetrics.map((ticker, index) => {
      const gicsBenchmark = ticker.gicsBenchmark
      
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
          benchmarkRelativeScores = calculateBenchmarkRelativeScores(ticker.metrics, benchmarkMetrics)
        }
      }
      
      const qualityScores = qualityPercentileScores[index]
      const stockSpecific = stockSpecificScores[index]
      
      const scored = {
        ...ticker.metrics,
        // VALUE from benchmark-relative (except Target Price which is percentile)
        peRatioScore: benchmarkRelativeScores.peRatioScore ?? null,
        evEbitdaScore: benchmarkRelativeScores.evEbitdaScore ?? null,
        evSalesScore: benchmarkRelativeScores.evSalesScore ?? null,
        targetPriceUpsideScore: stockSpecific.targetPriceUpsideScore,
        // MOMENTUM from benchmark-relative (except EPS/Rev which are percentile)
        return12MEx1MScore: benchmarkRelativeScores.return12MEx1MScore ?? null,
        return3MScore: benchmarkRelativeScores.return3MScore ?? null,
        pct52WeekHighScore: benchmarkRelativeScores.pct52WeekHighScore ?? null,
        epsSurpriseScore: stockSpecific.epsSurpriseScore,
        revSurpriseScore: stockSpecific.revSurpriseScore,
        ntmEpsChangeScore: stockSpecific.ntmEpsChangeScore,
        ntmRevChangeScore: stockSpecific.ntmRevChangeScore,
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
      
      return {
        ticker: ticker.ticker,
        ...scored,
        ...composites,
        ...total
      }
    })
    
    console.log('Enriching with benchmark data...')
    const enrichedScores = finalScores.map(score => {
      const gicsBenchmark = gicsBenchmarkMap.get(score.ticker.toUpperCase())
      
      return {
        ...score,
        benchmark1: gicsBenchmark?.BENCHMARK1 || null,
        benchmark2: gicsBenchmark?.BENCHMARK2 || null,
        benchmark3: gicsBenchmark?.BENCHMARK3 || null,
        benchmarkCustom: gicsBenchmark?.BENCHMARK_CUSTOM || null
      }
    })
    
    console.log('=== Universe Scoring API: Completed successfully ===')
    
    return NextResponse.json({
      scores: enrichedScores,
      pagination: {
        page,
        pageSize,
        totalCount: totalCount || 0,
        totalPages
      }
    })
    
  } catch (error) {
    console.error('Universe scoring API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

