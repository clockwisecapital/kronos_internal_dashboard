'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { setupSynchronizedRefresh } from '@/lib/utils/refreshSync'

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
  avg_index_weight?: number
  index_ratio?: number
  qqq_weight?: number
  sp_weight?: number
  earnings_date?: string
  earnings_time?: string
}

interface HoldingWithCalculations extends Holding {
  calculated_weight: number  // Formula: (Market Value / sum of all Market Value) * 100
  calculated_market_value: number  // Formula: current_price * shares (use close_price if current_price null)
  calculated_pct_change: number  // Formula: (current_price/close_price - 1) * 100
}

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<HoldingWithCalculations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sortColumn, setSortColumn] = useState<keyof HoldingWithCalculations>('stock_ticker')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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
      
      // Fetch weightings data
      const { data: weightingsData, error: weightingsError } = await supabase
        .from('weightings')
        .select('ticker, spy, qqq')
      
      if (weightingsError) {
        console.warn('Failed to fetch weightings:', weightingsError.message)
      }
      
      // Create lookup map for weightings
      const weightingsMap = new Map(
        weightingsData?.map(w => [w.ticker, { spy: w.spy, qqq: w.qqq }]) || []
      )
      
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
      
      // Calculate derived fields per client requirements (use deduplicated data)
      const totalMarketValue = deduplicatedHoldings.reduce((sum, h) => sum + h.market_value, 0)
      
      const holdingsWithCalcs: HoldingWithCalculations[] = deduplicatedHoldings.map(h => {
        // Get real-time price and previous close from Yahoo Finance
        const priceData = pricesMap.get(h.stock_ticker)
        const realtimePrice = priceData?.current
        const previousClose = priceData?.previousClose || h.close_price // Fallback to CSV close_price
        const effectivePrice = realtimePrice || h.current_price || h.close_price
        
        // Get weightings for this ticker
        const weights = weightingsMap.get(h.stock_ticker)
        const spyWeight = weights?.spy || null
        const qqqWeight = weights?.qqq || null
        
        // Calculate portfolio weight percentage
        const calculatedWeight = totalMarketValue > 0 ? (h.market_value / totalMarketValue) * 100 : 0
        
        // Calculate Average Index Weight: (SPY + QQQ) / 2
        const avgIndexWeight = (spyWeight !== null && qqqWeight !== null) 
          ? (spyWeight + qqqWeight) / 2 
          : null
        
        // Calculate Index Ratio: Portfolio Weight / QQQ Weight
        const indexRatio = (qqqWeight !== null && qqqWeight > 0) 
          ? calculatedWeight / qqqWeight 
          : null
        
        return {
          ...h,
          // Store real-time price and previous close for display
          current_price: realtimePrice || h.current_price,
          previous_close: previousClose,
          sp_weight: spyWeight,
          qqq_weight: qqqWeight,
          avg_index_weight: avgIndexWeight,
          index_ratio: indexRatio,
          // Weight: (Market Value / sum of all Market Value) * 100
          calculated_weight: calculatedWeight,
          // Market Value: Use real-time price if available, otherwise CSV market_value
          calculated_market_value: realtimePrice ? (realtimePrice * h.shares) : 
                                   h.current_price ? (h.current_price * h.shares) : 
                                   h.market_value,
          // % Change: (current_price / previous_close - 1) * 100 (using Yahoo Finance previous close)
          calculated_pct_change: realtimePrice ? ((realtimePrice / previousClose - 1) * 100) :
                                 h.current_price ? ((h.current_price / previousClose - 1) * 100) : 
                                 0,
          // Debug: Log close price source for verification
          _debug_close_source: priceData?.previousClose ? 'Yahoo' : 'CSV'
        }
      })
      
      // Calculate and log total value for debugging
      const calculatedTotalValue = holdingsWithCalcs.reduce((sum, h) => sum + h.calculated_market_value, 0)
      const tickersWithYahoo = holdingsWithCalcs.filter(h => pricesMap.has(h.stock_ticker))
      const tickersWithoutYahoo = holdingsWithCalcs.filter(h => !pricesMap.has(h.stock_ticker))
      
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

  const sortedHoldings = [...holdings].sort((a, b) => {
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

  const totalValue = holdings.reduce((sum, h) => sum + h.calculated_market_value, 0)
  
  // Total Cash: Sum of Cash & Other Weight + FGXXX Weight
  const totalCash = holdings.reduce((sum, h) => {
    const ticker = h.stock_ticker.toUpperCase()
    if (ticker.includes('CASH') || ticker === 'FGXXX') {
      return sum + h.calculated_weight
    }
    return sum
  }, 0)
  
  const avgWeight = holdings.length > 0 ? holdings.reduce((sum, h) => sum + h.calculated_weight, 0) / holdings.length : 0

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
          <div className="text-right">
            <p className="text-sm text-slate-400">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-white">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Total Holdings</p>
          <p className="text-2xl font-bold text-white">{holdings.length}</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Market Value</p>
          <p className="text-2xl font-bold text-white">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Total Cash</p>
          <p className="text-2xl font-bold text-white">
            {totalCash.toFixed(2)}%
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 shadow-lg">
          <p className="text-sm text-slate-400 mb-1">Average Weight</p>
          <p className="text-2xl font-bold text-white">
            {avgWeight.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700 border-b border-slate-600">
              <tr>
                {/* 1. Ticker */}
                <th className="px-4 py-3 text-left">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Name
                </th>
                {/* 3. Weight */}
                <th className="px-4 py-3 text-right">
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
                {/* 4. QQQ Ratio (moved from position 9) */}
                <th className="px-4 py-3 text-right">
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
                {/* 5. Shares */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('shares')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Shares
                    {sortColumn === 'shares' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 6. Current Price */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('current_price')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Current Price
                    {sortColumn === 'current_price' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 7. % Change */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('calculated_pct_change')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    % Change
                    {sortColumn === 'calculated_pct_change' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 8. Market Value */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('calculated_market_value')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Market Value
                    {sortColumn === 'calculated_market_value' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 9. Avg Index Weight */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('avg_index_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    Avg Index Weight
                    {sortColumn === 'avg_index_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 10. QQQ Weight */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('qqq_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    QQQ Weight
                    {sortColumn === 'qqq_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 11. S&P Weight */}
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('sp_weight')}
                    className="flex items-center gap-1 ml-auto text-xs font-semibold text-white uppercase tracking-wider hover:text-blue-400"
                  >
                    S&P Weight
                    {sortColumn === 'sp_weight' && (
                      <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                {/* 12. Earnings Date */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Earnings Date
                </th>
                {/* 13. Earnings Time */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Earnings Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sortedHoldings.map((holding) => (
                <tr key={holding.stock_ticker} className="hover:bg-slate-700/50 transition-colors">
                  {/* 1. Ticker */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-300">{holding.stock_ticker}</span>
                  </td>
                  {/* 2. Name */}
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {holding.security_name}
                  </td>
                  {/* 3. Weight (calculated) - 1 decimal place */}
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">
                    {holding.calculated_weight.toFixed(1)}%
                  </td>
                  {/* 4. QQQ Ratio (Portfolio Weight / QQQ Weight) - moved here, formatted as % with 0 decimals */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.index_ratio ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.index_ratio ? `${(holding.index_ratio * 100).toFixed(0)}%` : '-'}
                  </td>
                  {/* 5. Shares */}
                  <td className="px-4 py-3 text-right text-sm text-white">
                    {holding.shares.toLocaleString()}
                  </td>
                  {/* 6. Current Price (use close_price as fallback) */}
                  <td className="px-4 py-3 text-right text-sm text-white">
                    ${(holding.current_price || holding.close_price).toFixed(2)}
                    {!holding.current_price && <span className="text-xs text-zinc-400 ml-1">(close)</span>}
                  </td>
                  {/* 7. % Change (calculated) */}
                  <td className={`px-4 py-3 text-right text-sm font-medium ${holding.calculated_pct_change > 0 ? 'text-green-400' : holding.calculated_pct_change < 0 ? 'text-red-400' : 'text-white'}`}>
                    {holding.current_price ? (
                      `${holding.calculated_pct_change >= 0 ? '+' : ''}${holding.calculated_pct_change.toFixed(2)}%`
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  {/* 8. Market Value (calculated) */}
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">
                    ${holding.calculated_market_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {/* 9. Avg Index Weight (calculated from SPY + QQQ) - 1 decimal place */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.avg_index_weight ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.avg_index_weight ? `${holding.avg_index_weight.toFixed(1)}%` : '-'}
                  </td>
                  {/* 10. QQQ Weight (from weightings table) - 1 decimal place */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.qqq_weight ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.qqq_weight ? `${holding.qqq_weight.toFixed(1)}%` : '-'}
                  </td>
                  {/* 11. S&P Weight (from weightings table) - 1 decimal place */}
                  <td className={`px-4 py-3 text-right text-sm ${holding.sp_weight ? 'text-white' : 'text-slate-500 italic'}`}>
                    {holding.sp_weight ? `${holding.sp_weight.toFixed(1)}%` : '-'}
                  </td>
                  {/* 12. Earnings Date (placeholder) */}
                  <td className="px-4 py-3 text-sm text-slate-500 italic">
                    {holding.earnings_date || '-'}
                  </td>
                  {/* 13. Earnings Time (placeholder) */}
                  <td className="px-4 py-3 text-sm text-slate-500 italic">
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
