'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { setupSynchronizedRefresh } from '@/lib/utils/refreshSync'
import { calculateEffectiveHedge } from '@/lib/utils/shorts'

interface Holding {
  date: string
  account: string
  stock_ticker: string
  cusip: string
  security_name: string
  shares: number
  close_price: number  // Close price from CSV (fallback only)
  market_value: number  // Market value from CSV
  weightings: number
  net_assets: number
  shares_outstand: number
  creation_units: number
  current_price?: number
  previous_close?: number  // Previous close from Yahoo Finance
  pct_change?: number
  index_ratio?: number
  qqq_weight?: number
  sp_weight?: number
  earnings_date?: string
  earnings_time?: string
  // New fields from factset_data
  beta_1y?: number
  beta_3y?: number
  beta_5y?: number
  true_beta?: number  // TBD - placeholder
  // New fields from tgt_prices
  target_price?: number
  // Placeholder fields
  net_weight?: number  // TBD
  score?: number  // TBD
  target_weight?: number  // TBD
}

interface HoldingWithCalculations extends Holding {
  calculated_weight: number  // Formula: (Market Value / sum of all Market Value) * 100
  calculated_market_value: number  // Formula: current_price * shares (use close_price if current_price null)
  calculated_pct_change: number  // Formula: (current_price/close_price - 1) * 100
  basis_point_contribution: number  // Formula: (weight × daily % change) in basis points
  upside?: number  // Formula: (target_price / current_price - 1) * 100
}

interface BenchmarkReturn {
  ticker: string
  name: string
  currentPrice: number
  previousClose: number
  dailyReturn: number
}

// Helper function to determine row highlighting based on earnings date
function getEarningsHighlight(earningsDate: string | undefined): string {
  if (!earningsDate) return ''
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  let earningsDateObj: Date
  
  // Parse earnings date - handle Excel serial numbers
  const dateStr = String(earningsDate)
  if (/^\d+(\.\d+)?$/.test(dateStr)) {
    const excelEpoch = new Date(1899, 11, 30)
    const serialNumber = parseFloat(dateStr)
    earningsDateObj = new Date(excelEpoch.getTime() + serialNumber * 86400000)
  } else {
    earningsDateObj = new Date(dateStr)
  }
  
  earningsDateObj.setHours(0, 0, 0, 0)
  
  // Check if earnings are today
  if (earningsDateObj.getTime() === today.getTime()) {
    return 'bg-red-900/30 hover:bg-red-900/40'
  }
  
  // Calculate next business day
  const nextBusinessDay = new Date(today)
  
  // If today is Friday (5), next business day is Monday (+3 days)
  if (today.getDay() === 5) {
    nextBusinessDay.setDate(today.getDate() + 3)
  } 
  // If today is Saturday (6), next business day is Monday (+2 days)
  else if (today.getDay() === 6) {
    nextBusinessDay.setDate(today.getDate() + 2)
  }
  // If today is Sunday (0), next business day is Monday (+1 day)
  else if (today.getDay() === 0) {
    nextBusinessDay.setDate(today.getDate() + 1)
  }
  // Otherwise, next business day is tomorrow
  else {
    nextBusinessDay.setDate(today.getDate() + 1)
  }
  
  nextBusinessDay.setHours(0, 0, 0, 0)
  
  // Check if earnings are next business day
  if (earningsDateObj.getTime() === nextBusinessDay.getTime()) {
    return 'bg-yellow-900/30 hover:bg-yellow-900/40'
  }
  
  return ''
}

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<HoldingWithCalculations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sortColumn, setSortColumn] = useState<keyof HoldingWithCalculations>('stock_ticker')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [portfolioReturn, setPortfolioReturn] = useState<number>(0)
  const [benchmarkReturns, setBenchmarkReturns] = useState<BenchmarkReturn[]>([])

  // Initial fetch and synchronized auto-refresh
  useEffect(() => {
    fetchHoldings(true) // Initial load
    
    // Setup synchronized refresh (fires at top of each minute)
    const cleanup = setupSynchronizedRefresh(() => {
      console.log('Auto-refreshing holdings data in background (synchronized)...')
      fetchHoldings(false) // Background refresh
    }, 60000) // 60 seconds
    
    return cleanup
  }, [])

  const fetchHoldings = async (isInitialLoad: boolean = false) => {
    try {
      // Only show full loading state on initial load
      if (isInitialLoad) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }
      
      const supabase = createClient()
      
      // Get the most recent date first
      const { data: dateData, error: dateError } = await supabase
        .from('holdings')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
      
      if (dateError) {
        throw new Error(`Failed to fetch holdings date: ${dateError.message}`)
      }
      
      if (!dateData || dateData.length === 0) {
        const errorMsg = 'No holdings data available. Please upload holdings.csv in the Data Upload tab.'
        if (isInitialLoad) {
          setError(errorMsg)
          setLoading(false)
        } else {
          console.warn(errorMsg)
          setIsRefreshing(false)
        }
        return
      }
      
      const latestDate = dateData[0].date
      
      // Fetch only holdings from the most recent date
      const { data: holdingsData, error: fetchError } = await supabase
        .from('holdings')
        .select('*')
        .eq('date', latestDate)
        .order('market_value', { ascending: false })
        .limit(5000)
      
      if (fetchError) {
        throw new Error(`Failed to fetch holdings: ${fetchError.message}`)
      }
      
      if (!holdingsData || holdingsData.length === 0) {
        const errorMsg = 'No holdings data available. Please upload holdings.csv in the Data Upload tab.'
        if (isInitialLoad) {
          setError(errorMsg)
          setLoading(false)
        } else {
          console.warn(errorMsg)
          setIsRefreshing(false)
        }
        return
      }
      
      console.log(`Holdings: Loaded ${holdingsData.length} holdings from date: ${latestDate}`)
      
      // Check for and remove duplicates
      const tickerCounts = new Map<string, number>()
      holdingsData.forEach(h => {
        const count = tickerCounts.get(h.stock_ticker) || 0
        tickerCounts.set(h.stock_ticker, count + 1)
      })
      
      const duplicates = Array.from(tickerCounts.entries()).filter(([_, count]) => count > 1)
      if (duplicates.length > 0) {
        console.error('❌ DUPLICATE TICKERS IN HOLDINGS:', duplicates.map(([ticker, count]) => `${ticker} (${count}x)`).join(', '))
      }
      
      // De-duplicate: Keep only first occurrence of each ticker
      const uniqueHoldingsMap = new Map()
      holdingsData.forEach(h => {
        if (!uniqueHoldingsMap.has(h.stock_ticker)) {
          uniqueHoldingsMap.set(h.stock_ticker, h)
        }
      })
      
      const deduplicatedHoldings = Array.from(uniqueHoldingsMap.values())
      console.log(`Holdings: De-duplicated ${holdingsData.length} → ${deduplicatedHoldings.length}`)
      
      // Fetch weightings data via API (uses service role to bypass RLS)
      let weightingsData: any[] = []
      try {
        const weightingsResponse = await fetch('/api/weightings')
        if (weightingsResponse.ok) {
          const weightingsResult = await weightingsResponse.json()
          if (weightingsResult.success) {
            weightingsData = weightingsResult.data
          }
        } else {
          console.warn('Failed to fetch weightings:', weightingsResponse.statusText)
        }
      } catch (error) {
        console.error('Error fetching weightings:', error)
      }
      
      console.log(`Weightings data: Loaded ${weightingsData?.length || 0} records from weightings API`)
      
      // Create lookup map for weightings (convert to uppercase for consistent lookup)
      // Parse text values: "-" or empty string = null, otherwise parse as float
      // Note: weightings API now returns normalized lowercase property names
      const weightingsMap = new Map(
        weightingsData?.map((w: any) => {
          const spyValue = w.spy !== null && w.spy !== undefined ? w.spy : null
          const qqqValue = w.qqq !== null && w.qqq !== undefined ? w.qqq : null
          
          return [
            w.ticker.toUpperCase(), 
            { 
              spy: spyValue, 
              qqq: qqqValue 
            }
          ]
        }) || []
      )
      
      // Fetch factset_data from API route (uses service role key to bypass RLS)
      let factsetData: any[] = []
      try {
        const factsetResponse = await fetch('/api/factset')
        if (factsetResponse.ok) {
          const factsetResult = await factsetResponse.json()
          if (factsetResult.success) {
            factsetData = factsetResult.data
          }
        } else {
          console.warn('Failed to fetch factset data:', factsetResponse.statusText)
        }
      } catch (error) {
        console.error('Error fetching factset data:', error)
      }
      
      // Create lookup map for factset data (normalize ticker to uppercase)
      const factsetMap = new Map(
        factsetData?.map(f => {
          const ticker = (f.Ticker || f.TICKER || '').trim().toUpperCase()
          return [ticker, { 
            beta_1y: f['1 yr Beta'] ? parseFloat(f['1 yr Beta']) : null,
            beta_3y: f['3 yr beta'] ? parseFloat(f['3 yr beta']) : null,
            beta_5y: f['5 yr beta - monthly'] ? parseFloat(f['5 yr beta - monthly']) : null,
            earnings_date: f['Next Earnings Date'] || null,
            earnings_time: f['Next Earnings Date Time of day'] || null
          }]
        }) || []
      )
      console.log(`Factset data: Loaded ${factsetMap.size} records`)
      
      // Fetch target prices and current prices from FactSet API (uses service role to bypass RLS)
      console.log('=== FETCHING TARGET PRICES AND PRICES FROM FACTSET ===')
      let tgtPricesMap = new Map<string, number | null>()
      let factsetPricesMap = new Map<string, number | null>()
      try {
        const factsetPricesResponse = await fetch('/api/factset-prices')
        if (factsetPricesResponse.ok) {
          const factsetPricesResult = await factsetPricesResponse.json()
          if (factsetPricesResult.success && factsetPricesResult.data) {
            console.log(`FactSet: Fetched ${factsetPricesResult.data.length} records`)
            factsetPricesResult.data.forEach((row: { ticker: string; targetPrice: number | null; currentPrice: number | null }) => {
              const ticker = row.ticker?.trim().toUpperCase()
              if (ticker) {
                tgtPricesMap.set(ticker, row.targetPrice)
                factsetPricesMap.set(ticker, row.currentPrice)
              }
            })
            console.log(`Target prices map: ${tgtPricesMap.size} tickers mapped`)
            console.log(`FactSet prices map: ${factsetPricesMap.size} tickers mapped`)
          } else {
            console.warn('FactSet prices API returned no data')
          }
        } else {
          console.warn('Failed to fetch FactSet prices:', factsetPricesResponse.statusText)
        }
      } catch (error) {
        console.error('Error fetching prices from FactSet API:', error)
      }
      console.log('=== END FACTSET PRICES ===')
      
      // Fetch net weight data from portfolio API
      console.log('=== FETCHING NET WEIGHTS ===')
      let netWeightMap = new Map<string, number>()
      try {
        const netWeightResponse = await fetch('/api/portfolio')
        if (netWeightResponse.ok) {
          const netWeightResult = await netWeightResponse.json()
          if (netWeightResult.success && netWeightResult.data?.rows) {
            netWeightMap = new Map(
              netWeightResult.data.rows.map((row: any) => [
                row.ticker.toUpperCase(), 
                row.net_weight
              ])
            )
            console.log(`Net weights: Loaded ${netWeightMap.size} tickers`)
          }
        } else {
          console.warn('Failed to fetch net weights:', netWeightResponse.statusText)
        }
      } catch (error) {
        console.error('Error fetching net weights:', error)
      }
      console.log('=== END NET WEIGHTS ===')
      
      // Fetch scoring data from scoring API
      console.log('=== FETCHING SCORES ===')
      let scoresMap = new Map<string, number>()
      try {
        const scoringResponse = await fetch('/api/scoring?profile=BASE&benchmark=BENCHMARK3')
        if (scoringResponse.ok) {
          const scoringResult = await scoringResponse.json()
          if (scoringResult.success && scoringResult.data) {
            scoresMap = new Map(
              scoringResult.data.map((stock: any) => [
                stock.ticker.toUpperCase(),
                stock.totalScore
              ])
            )
            console.log(`Scores: Loaded ${scoresMap.size} tickers`)
          }
        } else {
          console.warn('Failed to fetch scores:', scoringResponse.statusText)
        }
      } catch (error) {
        console.error('Error fetching scores:', error)
      }
      console.log('=== END SCORES ===')
      
      // Also log holdings tickers for comparison
      const holdingsTickers = deduplicatedHoldings.map(h => h.stock_ticker.toUpperCase())
      console.log('Holdings tickers (first 20):', holdingsTickers.slice(0, 20))
      
      // Check which holdings tickers exist in tgt_prices map
      const holdingsInMap = holdingsTickers.filter(t => tgtPricesMap.has(t))
      const holdingsNotInMap = holdingsTickers.filter(t => !tgtPricesMap.has(t))
      console.log(`Holdings matching: ${holdingsInMap.length} found in tgt_prices, ${holdingsNotInMap.length} not found`)
      if (holdingsNotInMap.length > 0 && holdingsNotInMap.length <= 30) {
        console.log('Holdings NOT in tgt_prices map:', holdingsNotInMap)
      }
      
      // Fetch real-time prices and previous closes from Yahoo Finance
      let pricesMap = new Map<string, { current: number; previousClose: number }>()
      try {
        console.log('Fetching real-time prices from Yahoo Finance...')
        const pricesResponse = await fetch('/api/prices')
        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json()
          if (pricesData.success && pricesData.prices) {
            pricesMap = new Map(
              pricesData.prices.map((p: { ticker: string; currentPrice: number; previousClose: number }) => [
                p.ticker, 
                { current: p.currentPrice, previousClose: p.previousClose }
              ])
            )
            console.log(`Loaded ${pricesMap.size} real-time prices with previous closes from Yahoo Finance`)
          }
        } else {
          console.warn('Failed to fetch prices:', pricesResponse.statusText)
        }
      } catch (priceError) {
        console.error('Error fetching real-time prices:', priceError)
        // Continue without real-time prices - will use close_price from CSV
      }
      
      // STEP 1: Calculate realtime market values for all holdings first
      // This is needed before we can calculate weights based on realtime totals
      const holdingsWithRealtimeValues = deduplicatedHoldings.map(h => {
        const priceData = pricesMap.get(h.stock_ticker)
        const realtimePrice = priceData?.current
        const calculated_market_value = realtimePrice ? (realtimePrice * h.shares) : 
                                        h.current_price ? (h.current_price * h.shares) : 
                                        h.market_value
        return {
          ...h,
          realtimePrice,
          calculated_market_value
        }
      })
      
      // STEP 2: Calculate total portfolio value using REALTIME market values
      const totalMarketValue = holdingsWithRealtimeValues.reduce((sum, h) => sum + h.calculated_market_value, 0)
      
      // STEP 2a: Calculate yesterday's total market value using market_value from CSV
      // This ensures correct baseline for daily return calculation (fixes FGXXX issue where price is 100 instead of 1)
      const totalMVYesterday = holdingsWithRealtimeValues.reduce((sum, h) => {
        return sum + h.market_value
      }, 0)
      
      console.log(`Total Market Value: CSV-based=$${deduplicatedHoldings.reduce((sum, h) => sum + h.market_value, 0).toLocaleString()}, Realtime=$${totalMarketValue.toLocaleString()}, Yesterday=$${totalMVYesterday.toLocaleString()}`)
      
      // STEP 3: Calculate all derived fields using REALTIME values
      const holdingsWithCalcs: HoldingWithCalculations[] = holdingsWithRealtimeValues.map(h => {
        // Get real-time price and previous close from Yahoo Finance
        const priceData = pricesMap.get(h.stock_ticker)
        const previousClose = priceData?.previousClose || h.close_price // Fallback to CSV close_price
        const effectivePrice = h.realtimePrice || h.current_price || h.close_price
        
        // Get weightings for this ticker (ensure uppercase lookup)
        const weights = weightingsMap.get(h.stock_ticker.toUpperCase())
        const spyWeight = weights?.spy || null
        const qqqWeight = weights?.qqq || null
        
        // Get factset data for this ticker
        const factset = factsetMap.get(h.stock_ticker)
        
        // Apply beta fallback logic
        const ticker = h.stock_ticker.toUpperCase()
        const isCash = ticker.includes('CASH') || ticker === 'FGXXX' || ticker === 'SPAXX' || ticker === 'VMFXX'
        
        let beta_1y: number | null = null
        let beta_3y: number | null = null
        let beta_5y: number | null = null
        
        if (isCash) {
          // Cash always has beta of 0
          beta_1y = 0
          beta_3y = 0
          beta_5y = 0
        } else {
          // Get raw beta values from factset
          const raw_beta_1y = factset?.beta_1y
          const raw_beta_3y = factset?.beta_3y
          const raw_beta_5y = factset?.beta_5y
          
          // Apply fallback logic:
          // 1. If beta is null/blank, default to 1
          // 2. If shorter period available but not longer, use shorter for longer
          
          // Start with defaults of 1 for non-cash
          beta_1y = raw_beta_1y ?? 1
          beta_3y = raw_beta_3y ?? 1
          beta_5y = raw_beta_5y ?? 1
          
          // Apply shorter-to-longer fallback
          // If we have 1yr but not 3yr, use 1yr for 3yr
          if (raw_beta_1y != null && raw_beta_3y == null) {
            beta_3y = raw_beta_1y
          }
          
          // If we have 3yr but not 5yr, use 3yr for 5yr
          if (raw_beta_3y != null && raw_beta_5y == null) {
            beta_5y = raw_beta_3y
          }
          
          // If we have 1yr but not 5yr (and no 3yr), use 1yr for 5yr
          if (raw_beta_1y != null && raw_beta_5y == null && raw_beta_3y == null) {
            beta_5y = raw_beta_1y
          }
        }
        
        // Calculate True Beta: max(beta_1y, beta_3y, beta_5y)
        // If stock is in QQQ, also consider QQQ's betas and use the higher value
        // Cap individual betas at 3 before taking max
        let true_beta: number | null = null
        
        if (!isCash) {
          // Cap individual betas at 3
          const capped_beta_1y = Math.min(beta_1y, 3)
          const capped_beta_3y = Math.min(beta_3y, 3)
          const capped_beta_5y = Math.min(beta_5y, 3)
          
          // Get max of stock's own betas (after capping)
          const stockMaxBeta = Math.max(capped_beta_1y, capped_beta_3y, capped_beta_5y)
          
          // Check if stock is in QQQ (has QQQ weight)
          const isInQQQ = qqqWeight != null && qqqWeight > 0
          
          if (isInQQQ) {
            // Get QQQ's betas from factset
            const qqqFactset = factsetMap.get('QQQ')
            
            // Apply same fallback logic to QQQ betas
            let qqq_beta_1y = qqqFactset?.beta_1y ?? 1
            let qqq_beta_3y = qqqFactset?.beta_3y ?? 1
            let qqq_beta_5y = qqqFactset?.beta_5y ?? 1
            
            // QQQ shorter-to-longer fallback
            if (qqqFactset?.beta_1y != null && qqqFactset?.beta_3y == null) {
              qqq_beta_3y = qqqFactset.beta_1y
            }
            if (qqqFactset?.beta_3y != null && qqqFactset?.beta_5y == null) {
              qqq_beta_5y = qqqFactset.beta_3y
            }
            if (qqqFactset?.beta_1y != null && qqqFactset?.beta_5y == null && qqqFactset?.beta_3y == null) {
              qqq_beta_5y = qqqFactset.beta_1y
            }
            
            // Cap QQQ betas at 3
            const capped_qqq_beta_1y = Math.min(qqq_beta_1y, 3)
            const capped_qqq_beta_3y = Math.min(qqq_beta_3y, 3)
            const capped_qqq_beta_5y = Math.min(qqq_beta_5y, 3)
            
            const qqqMaxBeta = Math.max(capped_qqq_beta_1y, capped_qqq_beta_3y, capped_qqq_beta_5y)
            
            // True beta is the higher of stock's max or QQQ's max
            true_beta = Math.max(stockMaxBeta, qqqMaxBeta)
          } else {
            // Not in QQQ, just use stock's max beta
            true_beta = stockMaxBeta
          }
        } else {
          // Cash has true beta of 0
          true_beta = 0
        }
        
        // Get target price for this ticker
        // Normalize ticker: trim whitespace, uppercase
        const normalizedHoldingTicker = h.stock_ticker.trim().toUpperCase()
        
        // Try exact match first (case-insensitive)
        let targetPrice: number | null = null
        for (const [mapTicker, mapPrice] of tgtPricesMap.entries()) {
          const normalizedMapTicker = mapTicker.trim().toUpperCase()
          if (normalizedMapTicker === normalizedHoldingTicker) {
            targetPrice = mapPrice
            break
          }
        }
        
        // Debug: Log if we couldn't find a target price for common tickers
        if (!targetPrice && (normalizedHoldingTicker === 'AAPL' || normalizedHoldingTicker === 'MSFT' || normalizedHoldingTicker === 'GOOGL')) {
          console.log(`No target price found for ${h.stock_ticker}. Available tickers in map:`, 
            Array.from(tgtPricesMap.keys()).slice(0, 20))
        }
        
        // Calculate portfolio weight percentage using REALTIME market values
        const calculatedWeight = totalMarketValue > 0 ? (h.calculated_market_value / totalMarketValue) * 100 : 0
        
        // Calculate Index Ratio: Portfolio Weight / QQQ Weight (as decimal for display as %)
        const indexRatio = (qqqWeight !== null && qqqWeight > 0) 
          ? calculatedWeight / qqqWeight 
          : null
        
        // Calculate % Change
        const calculatedPctChange = h.realtimePrice ? ((h.realtimePrice / previousClose - 1) * 100) :
                                    h.current_price ? ((h.current_price / previousClose - 1) * 100) : 
                                    0
        
        // Calculate Basis Point Contribution: (yesterday's weight × daily % change)
        // Use yesterday's market value and yesterday's total to get yesterday's weight
        const mvYesterday = previousClose * h.shares
        const weightYesterday = totalMVYesterday > 0 ? (mvYesterday / totalMVYesterday) * 100 : 0
        const basisPointContribution = weightYesterday * calculatedPctChange / 100
        
        // Calculate Upside: (target_price / current_price - 1) * 100
        // Use FactSet price as additional fallback
        const factsetPrice = factsetPricesMap.get(normalizedHoldingTicker)
        const currentPriceForUpside = h.realtimePrice || h.current_price || h.close_price || factsetPrice
        const upside = (targetPrice && currentPriceForUpside && currentPriceForUpside > 0) 
          ? ((targetPrice / currentPriceForUpside) - 1) * 100 
          : null
        
        return {
          ...h,
          // Store real-time price and previous close for display
          current_price: h.realtimePrice || h.current_price,
          previous_close: previousClose,
          sp_weight: spyWeight,
          qqq_weight: qqqWeight,
          index_ratio: indexRatio,
          // Beta values with fallback logic applied
          beta_1y,
          beta_3y,
          beta_5y,
          true_beta,
          // Earnings date and time from factset_data_v2
          earnings_date: factset?.earnings_date || h.earnings_date,
          earnings_time: factset?.earnings_time || h.earnings_time,
          // Target price from tgt_prices
          target_price: targetPrice || null,
          // Net weight from portfolio calculations
          net_weight: netWeightMap.get(h.stock_ticker.toUpperCase()) ?? null,
          // Score from scoring calculations
          score: scoresMap.get(h.stock_ticker.toUpperCase()) ?? null,
          // Placeholder field
          target_weight: null, // TBD
          // Calculated fields (using realtime values)
          calculated_weight: calculatedWeight,
          calculated_market_value: h.calculated_market_value, // Already calculated in step 1
          calculated_pct_change: calculatedPctChange,
          basis_point_contribution: basisPointContribution,
          upside: upside
        }
      })
      
      // Log target price matching summary
      const holdingsWithTargetPrice = holdingsWithCalcs.filter(h => h.target_price !== null)
      const holdingsWithoutTargetPrice = holdingsWithCalcs.filter(h => h.target_price === null)
      console.log(`Target price matching: ${holdingsWithTargetPrice.length} with target price, ${holdingsWithoutTargetPrice.length} without`)
      if (holdingsWithoutTargetPrice.length > 0 && holdingsWithoutTargetPrice.length <= 20) {
        console.log('Holdings without target price:', holdingsWithoutTargetPrice.map(h => h.stock_ticker))
      }
      
      // Calculate and log total value for debugging
      const calculatedTotalValue = holdingsWithCalcs.reduce((sum, h) => sum + h.calculated_market_value, 0)
      const tickersWithYahoo = holdingsWithCalcs.filter(h => pricesMap.has(h.stock_ticker))
      const tickersWithoutYahoo = holdingsWithCalcs.filter(h => !pricesMap.has(h.stock_ticker))
      
      // Calculate Portfolio % Change Today
      // Formula: (totalMVToday / totalMVYesterday - 1) * 100
      const portfolioReturnToday = totalMVYesterday > 0
        ? ((totalMarketValue / totalMVYesterday) - 1) * 100
        : 0
      setPortfolioReturn(portfolioReturnToday)
      
      // Validation: Sum of BPS contributions should match portfolio return (within rounding)
      const bpsSum = holdingsWithCalcs.reduce((sum, h) => sum + h.basis_point_contribution, 0)
      console.log(`Portfolio Return Validation: Direct calc=${portfolioReturnToday.toFixed(4)}%, BPS sum=${bpsSum.toFixed(4)}%`)
      
      // Fetch benchmark returns (QQQ and SPY)
      try {
        const benchmarks = ['QQQ', 'SPY']
        const benchmarkData: BenchmarkReturn[] = []
        
        for (const ticker of benchmarks) {
          const priceData = pricesMap.get(ticker)
          if (priceData) {
            benchmarkData.push({
              ticker,
              name: ticker === 'QQQ' ? 'QQQ' : 'S&P 500',
              currentPrice: priceData.current,
              previousClose: priceData.previousClose,
              dailyReturn: ((priceData.current / priceData.previousClose) - 1) * 100
            })
          } else {
            // Fetch directly if not in holdings
            const response = await fetch(`/api/stock-price?ticker=${ticker}`)
            if (response.ok) {
              const result = await response.json()
              if (result.success && result.data) {
                benchmarkData.push({
                  ticker,
                  name: ticker === 'QQQ' ? 'QQQ' : 'S&P 500',
                  currentPrice: result.data.price,
                  previousClose: result.data.previousClose,
                  dailyReturn: ((result.data.price / result.data.previousClose) - 1) * 100
                })
              }
            }
          }
        }
        setBenchmarkReturns(benchmarkData)
      } catch (benchmarkError) {
        console.error('Error fetching benchmark returns:', benchmarkError)
      }
      
      console.log(`\n=== HOLDINGS TAB - CALCULATION SUMMARY ===`)
      console.log(`Date: ${latestDate}`)
      console.log(`Total Holdings: ${holdingsWithCalcs.length}`)
      console.log(`Total Portfolio Value: $${calculatedTotalValue.toFixed(2)}`)
      console.log(`Holdings with Yahoo prices: ${tickersWithYahoo.length}`)
      console.log(`Holdings using CSV prices: ${tickersWithoutYahoo.length}`)
      console.log(`\nTickers list: ${holdingsWithCalcs.map(h => h.stock_ticker).sort().join(', ')}`)
      if (tickersWithoutYahoo.length > 0) {
        console.log(`Tickers WITHOUT Yahoo prices: ${tickersWithoutYahoo.map(h => h.stock_ticker).join(', ')}`)
      }
      
      // Log % Change calculation details for verification
      console.log(`\n% CHANGE CALCULATION VERIFICATION:`)
      holdingsWithCalcs.slice(0, 5).forEach(h => {
        const priceData = pricesMap.get(h.stock_ticker)
        const closeSource = priceData?.previousClose ? 'Yahoo' : 'CSV'
        const closePrice = priceData?.previousClose || h.close_price
        const currentPrice = priceData?.current || h.current_price || h.close_price
        console.log(`[${h.stock_ticker}] Current: $${currentPrice.toFixed(2)}, Close: $${closePrice.toFixed(2)} (${closeSource}), % Change: ${h.calculated_pct_change.toFixed(2)}%`)
      })
      
      console.log(`==========================================\n`)
      
      setHoldings(holdingsWithCalcs)
      setError(null)
      
      if (isInitialLoad) {
        setLoading(false)
      } else {
        setIsRefreshing(false)
      }
    } catch (err) {
      console.error('Error fetching holdings:', err)
      // Only set error on initial load, ignore errors during background refresh
      if (isInitialLoad) {
        setError(err instanceof Error ? err.message : 'Failed to load holdings')
        setLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }

  const handleSort = (column: keyof HoldingWithCalculations) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Filter out FGXXX and Cash from visible rows (but keep in totals)
  const visibleHoldings = holdings.filter(h => {
    const ticker = h.stock_ticker.toUpperCase()
    return !ticker.includes('CASH') && ticker !== 'FGXXX'
  })

  const sortedHoldings = [...visibleHoldings].sort((a, b) => {
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return 0
  })

  // Effective Hedge: Sum of all shorts exposure (using centralized calculation)
  const effectiveHedge = calculateEffectiveHedge(
    holdings.map(h => ({ ticker: h.stock_ticker, weight: h.calculated_weight }))
  )

  // Total Cash: Sum of Cash & Other Weight + FGXXX Weight
  const totalCash = holdings.reduce((sum, h) => {
    const ticker = h.stock_ticker.toUpperCase()
    if (ticker.includes('CASH') || ticker === 'FGXXX') {
      return sum + h.calculated_weight
    }
    return sum
  }, 0)
  
  // Get benchmark returns for display
  const qqqReturn = benchmarkReturns.find(b => b.ticker === 'QQQ')
  const spyReturn = benchmarkReturns.find(b => b.ticker === 'SPY')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading holdings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">
            No Holdings Data
          </h2>
          <p className="text-slate-400 mb-4">
            {error}
          </p>
          <a
            href="/data-upload"
            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Holdings Data
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Master Holdings
          </h1>
          <p className="text-slate-400 mt-1">
            Comprehensive view of all portfolio positions
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Subtle refresh indicator */}
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Updating...</span>
            </div>
          )}
          {!isRefreshing && (
            <span className="text-sm text-slate-400">
              Auto-refresh synced (top of each minute)
            </span>
          )}
          <button
            onClick={() => fetchHoldings(false)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            disabled={loading || isRefreshing}
          >
            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Summary Cards - Reduced size by ~25% */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        {/* Total Market Value */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Total Market Value</p>
          <p className="text-lg font-bold text-white">
            ${holdings.reduce((sum, h) => sum + h.calculated_market_value, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Total Holdings */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Total Holdings</p>
          <p className="text-lg font-bold text-white">
            {holdings.length}
          </p>
        </div>

        {/* Portfolio Return Today */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Portfolio Return Today</p>
          <p className={`text-lg font-bold ${portfolioReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
          </p>
        </div>
        
        {/* QQQ Return Today */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">QQQ Return Today</p>
          <p className={`text-lg font-bold ${qqqReturn && qqqReturn.dailyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {qqqReturn ? `${qqqReturn.dailyReturn >= 0 ? '+' : ''}${qqqReturn.dailyReturn.toFixed(2)}%` : '-'}
          </p>
        </div>

        {/* S&P 500 Return Today */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">S&P 500 Return Today</p>
          <p className={`text-lg font-bold ${spyReturn && spyReturn.dailyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {spyReturn ? `${spyReturn.dailyReturn >= 0 ? '+' : ''}${spyReturn.dailyReturn.toFixed(2)}%` : '-'}
          </p>
        </div>

        {/* Effective Hedge - Changed to % format */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Effective Hedge</p>
          <p className="text-lg font-bold text-orange-400">
            {effectiveHedge.toFixed(1)}%
          </p>
        </div>

        {/* Total Cash */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Total Cash</p>
          <p className="text-lg font-bold text-white">
            {totalCash.toFixed(2)}%
          </p>
        </div>

        {/* Portfolio Beta - True Beta */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">True Beta</p>
          <p className="text-lg font-bold text-blue-400">
            {(() => {
              const totalWeight = holdings.reduce((sum, h) => sum + h.calculated_weight, 0)
              const weightedBeta = holdings.reduce((sum, h) => {
                const beta = h.true_beta ?? 1 // Use true_beta with fallback to 1
                return sum + (beta * h.calculated_weight / 100)
              }, 0)
              return totalWeight > 0 ? weightedBeta.toFixed(2) : '-'
            })()}
          </p>
        </div>

        {/* Portfolio Beta - 5yr */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Beta 5yr</p>
          <p className="text-lg font-bold text-blue-400">
            {(() => {
              const totalWeight = holdings.reduce((sum, h) => sum + h.calculated_weight, 0)
              const weightedBeta = holdings.reduce((sum, h) => {
                const beta = h.beta_5y ?? 1 // Fallback to 1 if null
                return sum + (beta * h.calculated_weight / 100)
              }, 0)
              return totalWeight > 0 ? weightedBeta.toFixed(2) : '-'
            })()}
          </p>
        </div>

        {/* Portfolio Beta - 3yr */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Beta 3yr</p>
          <p className="text-lg font-bold text-blue-400">
            {(() => {
              const totalWeight = holdings.reduce((sum, h) => sum + h.calculated_weight, 0)
              const weightedBeta = holdings.reduce((sum, h) => {
                const beta = h.beta_3y ?? 1 // Fallback to 1 if null
                return sum + (beta * h.calculated_weight / 100)
              }, 0)
              return totalWeight > 0 ? weightedBeta.toFixed(2) : '-'
            })()}
          </p>
        </div>

        {/* Portfolio Beta - 1yr */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
          <p className="text-xs text-slate-400 mb-0.5">Beta 1yr</p>
          <p className="text-lg font-bold text-blue-400">
            {(() => {
              const totalWeight = holdings.reduce((sum, h) => sum + h.calculated_weight, 0)
              const weightedBeta = holdings.reduce((sum, h) => {
                const beta = h.beta_1y ?? 1 // Fallback to 1 if null
                return sum + (beta * h.calculated_weight / 100)
              }, 0)
              return totalWeight > 0 ? weightedBeta.toFixed(2) : '-'
            })()}
          </p>
        </div>
      </div>

      {/* Holdings Table with Sticky Header */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[800px]">
          <table className="w-full">
            <thead className="bg-slate-700 border-b border-slate-600 sticky top-0 z-10">
              <tr>
                {/* 1. Ticker */}
                <th className="px-3 py-2 text-left">
                  <button
                    onClick={() => handleSort('stock_ticker')}
                    className="flex items-center gap-1 text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Ticker
                    {sortColumn === 'stock_ticker' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 2. Name */}
                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Name
                </th>
                {/* 3. Weight */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('calculated_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Weight
                    {sortColumn === 'calculated_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 4. Net Weight (placeholder) */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wider">
                  Net Wt
                </th>
                {/* 5. Target Weight (placeholder) */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wider">
                  Tgt Wt
                </th>
                {/* 6. Price */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('current_price')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Price
                    {sortColumn === 'current_price' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 7. % Change */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('calculated_pct_change')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    % Chg
                    {sortColumn === 'calculated_pct_change' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 8. BP Contribution */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('basis_point_contribution')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    BP Contrib
                    {sortColumn === 'basis_point_contribution' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 9. Target Price */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('target_price')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Tgt Price
                    {sortColumn === 'target_price' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 10. Upside */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('upside')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Upside
                    {sortColumn === 'upside' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 11. Score (placeholder) */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wider">
                  Score
                </th>
                {/* 12. QQQ Ratio */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('index_ratio')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    QQQ Ratio
                    {sortColumn === 'index_ratio' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 13. QQQ Weight */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('qqq_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    QQQ Wt
                    {sortColumn === 'qqq_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 14. SP500 Weight */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('sp_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    SP500 Wt
                    {sortColumn === 'sp_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 15. True Beta */}
                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase tracking-wider">
                  True Beta
                </th>
                {/* 16. Beta 1 */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('beta_1y')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Beta 1
                    {sortColumn === 'beta_1y' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 17. Beta 3 */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('beta_3y')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Beta 3
                    {sortColumn === 'beta_3y' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 18. Beta 5 */}
                <th className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleSort('beta_5y')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Beta 5
                    {sortColumn === 'beta_5y' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 19. Earnings Date */}
                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Earnings Date
                </th>
                {/* 20. Earnings Time */}
                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Earnings Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sortedHoldings.map((holding) => (
                <tr 
                  key={holding.stock_ticker} 
                  className={`transition-colors ${
                    getEarningsHighlight(holding.earnings_date) || 'hover:bg-slate-700/50'
                  }`}
                >
                  {/* 1. Ticker */}
                  <td className="px-3 py-2">
                    <span className="text-sm font-medium text-white">{holding.stock_ticker}</span>
                  </td>
                  {/* 2. Name */}
                  <td className="px-3 py-2 text-sm text-slate-300 max-w-[200px] truncate">
                    {holding.security_name}
                  </td>
                  {/* 3. Weight */}
                  <td className="px-3 py-2 text-right text-sm font-medium text-white">
                    {holding.calculated_weight.toFixed(1)}%
                  </td>
                  {/* 4. Net Weight */}
                  <td className={`px-3 py-2 text-right text-sm font-medium ${
                    holding.net_weight != null 
                      ? holding.net_weight > 0 ? 'text-green-400' : holding.net_weight < 0 ? 'text-red-400' : 'text-slate-300'
                      : 'text-slate-500'
                  }`}>
                    {holding.net_weight != null ? `${holding.net_weight.toFixed(2)}%` : '-'}
                  </td>
                  {/* 5. Target Weight (placeholder) */}
                  <td className="px-3 py-2 text-right text-sm text-slate-500">
                    -
                  </td>
                  {/* 6. Price */}
                  <td className="px-3 py-2 text-right text-sm text-white">
                    ${(holding.current_price || holding.close_price).toFixed(2)}
                  </td>
                  {/* 7. % Change */}
                  <td className={`px-3 py-2 text-right text-sm font-medium ${holding.calculated_pct_change > 0 ? 'text-green-400' : holding.calculated_pct_change < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    {holding.current_price ? (
                      `${holding.calculated_pct_change >= 0 ? '+' : ''}${holding.calculated_pct_change.toFixed(2)}%`
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  {/* 8. BP Contribution */}
                  <td className={`px-3 py-2 text-right text-sm font-medium ${holding.basis_point_contribution > 0 ? 'text-green-400' : holding.basis_point_contribution < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    {holding.current_price ? (
                      `${holding.basis_point_contribution >= 0 ? '+' : ''}${(holding.basis_point_contribution * 100).toFixed(0)}`
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  {/* 9. Target Price */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.target_price ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.target_price ? `$${holding.target_price.toFixed(2)}` : '-'}
                  </td>
                  {/* 10. Upside */}
                  <td className={`px-3 py-2 text-right text-sm font-medium ${holding.upside && holding.upside > 0 ? 'text-green-400' : holding.upside && holding.upside < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {holding.upside !== null && holding.upside !== undefined ? `${holding.upside >= 0 ? '+' : ''}${holding.upside.toFixed(1)}%` : '-'}
                  </td>
                  {/* 11. Score */}
                  <td className={`px-3 py-2 text-right text-sm font-medium ${
                    holding.score != null
                      ? holding.score >= 60 ? 'text-green-400' : holding.score >= 40 ? 'text-yellow-400' : 'text-orange-400'
                      : 'text-slate-500'
                  }`}>
                    {holding.score != null ? holding.score.toFixed(1) : '-'}
                  </td>
                  {/* 12. QQQ Ratio */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.index_ratio ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.index_ratio ? `${(holding.index_ratio * 100).toFixed(0)}%` : '-'}
                  </td>
                  {/* 13. QQQ Weight */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.qqq_weight ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.qqq_weight ? `${holding.qqq_weight.toFixed(1)}%` : '-'}
                  </td>
                  {/* 14. SP500 Weight */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.sp_weight ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.sp_weight ? `${holding.sp_weight.toFixed(1)}%` : '-'}
                  </td>
                  {/* 15. True Beta */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.true_beta != null ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.true_beta != null ? holding.true_beta.toFixed(2) : '-'}
                  </td>
                  {/* 16. Beta 1 */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.beta_1y ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.beta_1y ? holding.beta_1y.toFixed(2) : '-'}
                  </td>
                  {/* 17. Beta 3 */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.beta_3y ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.beta_3y ? holding.beta_3y.toFixed(2) : '-'}
                  </td>
                  {/* 18. Beta 5 */}
                  <td className={`px-3 py-2 text-right text-sm ${holding.beta_5y ? 'text-slate-300' : 'text-slate-500'}`}>
                    {holding.beta_5y ? holding.beta_5y.toFixed(2) : '-'}
                  </td>
                  {/* 19. Earnings Date */}
                  <td className="px-3 py-2 text-sm text-slate-500">
                    {holding.earnings_date ? (() => {
                      const dateStr = String(holding.earnings_date)
                      // Check if it's an Excel serial number (numeric string like "46002.000")
                      if (/^\d+(\.\d+)?$/.test(dateStr)) {
                        const excelEpoch = new Date(1899, 11, 30) // Excel epoch
                        const serialNumber = parseFloat(dateStr)
                        const date = new Date(excelEpoch.getTime() + serialNumber * 86400000)
                        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                      }
                      // Otherwise, just display as-is (already formatted)
                      return dateStr
                    })() : '-'}
                  </td>
                  {/* 20. Earnings Time */}
                  <td className="px-3 py-2 text-sm text-slate-500">
                    {holding.earnings_time || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
