'use client'

import { useState, useEffect, useRef } from 'react'

interface HoldingData {
  stock_ticker: string
  weight_pct: number
  market_value: number
}

interface BetaData {
  ticker: string
  true_beta: number | null
  beta_1yr: number | null
  beta_3yr: number | null
  beta_5yr: number | null
}

interface WeightingData {
  ticker: string
  qqq: number | null
  spy: number | null
}

interface Trade {
  id: string
  ticker: string
  currentWeight: number
  targetWeight: number
  tradeSide: 'BUY' | 'SELL'
  cashChange: number
  dollars: number
  shares: number
  price: number
}

interface PortfolioSummary {
  currentCashPct: number
  currentTrueBeta: number
  current1YrBeta: number
  current3YrBeta: number
  current5YrBeta: number
  targetCashPct: number
  targetTrueBeta: number
  target1YrBeta: number
  target3YrBeta: number
  target5YrBeta: number
}

export default function TradingPage() {
  const [loading, setLoading] = useState(true)
  const [nav, setNav] = useState(0)
  const [holdings, setHoldings] = useState<HoldingData[]>([])
  const [betaData, setBetaData] = useState<BetaData[]>([])
  const [weightingsData, setWeightingsData] = useState<WeightingData[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const priceDebounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    currentCashPct: 0,
    currentTrueBeta: 0,
    current1YrBeta: 0,
    current3YrBeta: 0,
    current5YrBeta: 0,
    targetCashPct: 0,
    targetTrueBeta: 0,
    target1YrBeta: 0,
    target3YrBeta: 0,
    target5YrBeta: 0
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    calculatePortfolioSummary()
  }, [holdings, betaData, trades, nav])

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(priceDebounceTimers.current).forEach(timer => clearTimeout(timer))
    }
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      // Fetch Portfolio NAV (totalMarketValue from portfolio API)
      const portfolioRes = await fetch('/api/portfolio', { cache: 'no-store' })
      const portfolioData = await portfolioRes.json()
      console.log('Trading: Portfolio data:', portfolioData)
      
      let portfolioNav = 0
      if (portfolioData.success && portfolioData.data && portfolioData.data.totalMarketValue) {
        portfolioNav = portfolioData.data.totalMarketValue
        setNav(portfolioNav)
        console.log(`Trading: NAV = $${portfolioNav.toLocaleString()}`)
      } else {
        console.error('Trading: Failed to fetch NAV - data structure:', portfolioData)
      }

      // Fetch Holdings with weights
      const holdingsRes = await fetch('/api/holdings')
      const holdingsData = await holdingsRes.json()
      console.log('Trading: Holdings response:', holdingsData)
      
      if (holdingsData.success && holdingsData.data && holdingsData.data.length > 0) {
        const holdingsWithWeights = holdingsData.data.map((h: any) => {
          const weight = portfolioNav > 0 ? (h.market_value / portfolioNav) * 100 : 0
          return {
            stock_ticker: h.stock_ticker,
            weight_pct: weight,
            market_value: h.market_value
          }
        })
        setHoldings(holdingsWithWeights)
        console.log(`Trading: Loaded ${holdingsWithWeights.length} holdings`)
      } else {
        console.error('Trading: No holdings data available')
      }

      // Fetch weightings data (for QQQ membership check)
      const weightingsRes = await fetch('/api/weightings')
      const weightingsData = await weightingsRes.json()
      console.log('Trading: Weightings response:', weightingsData)
      
      let weightingsArray: WeightingData[] = []
      if (weightingsData.success && weightingsData.data && weightingsData.data.length > 0) {
        weightingsArray = weightingsData.data.map((w: any) => ({
          ticker: w.ticker.toUpperCase(),
          spy: w.spy !== null && w.spy !== undefined ? w.spy : null,
          qqq: w.qqq !== null && w.qqq !== undefined ? w.qqq : null
        }))
        setWeightingsData(weightingsArray)
        console.log(`Trading: Loaded ${weightingsArray.length} weightings`)
      } else {
        console.error('Trading: No weightings data available')
      }

      // Fetch FactSet data for beta values (1yr, 3yr, 5yr)
      const factsetRes = await fetch('/api/factset')
      const factsetData = await factsetRes.json()
      console.log('Trading: FactSet response:', factsetData)
      
      if (factsetData.success && factsetData.data && factsetData.data.length > 0) {
        // Map factset data to beta data structure
        const betaDataArrayRaw = factsetData.data.map((f: any) => {
          const ticker = (f.Ticker || f.TICKER || '').trim().toUpperCase()
          return {
            ticker,
            beta_1yr: f['1 yr Beta'] ? parseFloat(f['1 yr Beta']) : null,
            beta_3yr: f['3 yr beta'] ? parseFloat(f['3 yr beta']) : null,
            beta_5yr: f['5 yr beta - monthly'] ? parseFloat(f['5 yr beta - monthly']) : null
          }
        }).filter((b: any) => b.ticker) // Remove entries without ticker
        
        // Calculate true_beta using same logic as holdings page
        const betaDataArray: BetaData[] = betaDataArrayRaw.map((b: any) => {
          const ticker = b.ticker
          const isCash = ticker.includes('CASH') || ticker === 'FGXXX' || ticker === 'SPAXX' || ticker === 'VMFXX'
          
          let beta_1yr: number | null = null
          let beta_3yr: number | null = null
          let beta_5yr: number | null = null
          let true_beta: number | null = null
          
          if (isCash) {
            // Cash always has beta of 0
            beta_1yr = 0
            beta_3yr = 0
            beta_5yr = 0
            true_beta = 0
          } else {
            // Get raw beta values
            const raw_beta_1yr = b.beta_1yr
            const raw_beta_3yr = b.beta_3yr
            const raw_beta_5yr = b.beta_5yr
            
            // Apply fallback logic: default to 1 if null
            beta_1yr = raw_beta_1yr ?? 1
            beta_3yr = raw_beta_3yr ?? 1
            beta_5yr = raw_beta_5yr ?? 1
            
            // Apply shorter-to-longer fallback
            if (raw_beta_1yr != null && raw_beta_3yr == null) {
              beta_3yr = raw_beta_1yr
            }
            if (raw_beta_3yr != null && raw_beta_5yr == null) {
              beta_5yr = raw_beta_3yr
            }
            if (raw_beta_1yr != null && raw_beta_5yr == null && raw_beta_3yr == null) {
              beta_5yr = raw_beta_1yr
            }
            
            // Calculate True Beta: max of betas after capping at 3
            const capped_beta_1yr = Math.min(beta_1yr, 3)
            const capped_beta_3yr = Math.min(beta_3yr, 3)
            const capped_beta_5yr = Math.min(beta_5yr, 3)
            
            const stockMaxBeta = Math.max(capped_beta_1yr, capped_beta_3yr, capped_beta_5yr)
            
            // Check if stock is in QQQ
            const weighting = weightingsArray.find(w => w.ticker === ticker)
            const isInQQQ = weighting?.qqq != null && weighting.qqq > 0
            
            if (isInQQQ) {
              // Get QQQ's betas
              const qqqBeta = betaDataArrayRaw.find((qb: any) => qb.ticker === 'QQQ')
              if (qqqBeta) {
                let qqq_beta_1yr = qqqBeta.beta_1yr ?? 1
                let qqq_beta_3yr = qqqBeta.beta_3yr ?? 1
                let qqq_beta_5yr = qqqBeta.beta_5yr ?? 1
                
                // Apply fallback for QQQ
                if (qqqBeta.beta_1yr != null && qqqBeta.beta_3yr == null) {
                  qqq_beta_3yr = qqqBeta.beta_1yr
                }
                if (qqqBeta.beta_3yr != null && qqqBeta.beta_5yr == null) {
                  qqq_beta_5yr = qqqBeta.beta_3yr
                }
                if (qqqBeta.beta_1yr != null && qqqBeta.beta_5yr == null && qqqBeta.beta_3yr == null) {
                  qqq_beta_5yr = qqqBeta.beta_1yr
                }
                
                // Cap QQQ betas at 3
                const capped_qqq_beta_1yr = Math.min(qqq_beta_1yr, 3)
                const capped_qqq_beta_3yr = Math.min(qqq_beta_3yr, 3)
                const capped_qqq_beta_5yr = Math.min(qqq_beta_5yr, 3)
                
                const qqqMaxBeta = Math.max(capped_qqq_beta_1yr, capped_qqq_beta_3yr, capped_qqq_beta_5yr)
                
                // True beta is the higher of stock's max or QQQ's max
                true_beta = Math.max(stockMaxBeta, qqqMaxBeta)
              } else {
                true_beta = stockMaxBeta
              }
            } else {
              // Not in QQQ, just use stock's max beta
              true_beta = stockMaxBeta
            }
          }
          
          return {
            ticker,
            true_beta,
            beta_1yr,
            beta_3yr,
            beta_5yr
          }
        })
        
        console.log(`Trading: Loaded ${betaDataArray.length} stocks with beta data from FactSet`)
        setBetaData(betaDataArray)
        
        // Log sample betas for debugging
        if (betaDataArray.length > 0) {
          console.log('Trading: Sample beta data (with true_beta):', betaDataArray.slice(0, 5))
        }
      } else {
        console.error('Trading: No FactSet data available')
      }

    } catch (error) {
      console.error('Error fetching trading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePortfolioSummary = () => {
    // Guard against calculating before data is loaded
    if (holdings.length === 0 || betaData.length === 0 || nav === 0) {
      console.log(`Trading: Skipping calculation - Holdings: ${holdings.length}, Beta Data: ${betaData.length}, NAV: ${nav}`)
      return
    }
    
    console.log(`Trading: Calculating summary - Holdings: ${holdings.length}, Beta Data: ${betaData.length}, NAV: ${nav}`)
    
    // Debug: Log first few holdings and beta data
    console.log('Trading: First 3 holdings:', holdings.slice(0, 3).map(h => ({ ticker: h.stock_ticker, weight: h.weight_pct })))
    console.log('Trading: First 3 beta entries:', betaData.slice(0, 3).map(b => ({ 
      ticker: b.ticker, 
      true_beta: b.true_beta, 
      beta_1yr: b.beta_1yr, 
      beta_3yr: b.beta_3yr, 
      beta_5yr: b.beta_5yr 
    })))
    
    // Current Cash: Sum of cash & equivalents + FGXXX as percentage
    const cashHoldings = holdings.filter(h => 
      h.stock_ticker.toUpperCase().includes('CASH') || 
      h.stock_ticker.toUpperCase().includes('EQUIVALENTS') ||
      h.stock_ticker === 'FGXXX'
    )
    const currentCashValue = cashHoldings.reduce((sum, h) => sum + h.market_value, 0)
    const currentCashPct = nav > 0 ? (currentCashValue / nav) * 100 : 0
    console.log(`Trading: Cash - ${cashHoldings.length} holdings, $${currentCashValue}, ${currentCashPct.toFixed(2)}%`)

    // Current Betas: Sumproduct of weights with corresponding betas
    let currentTrueBeta = 0
    let current1YrBeta = 0
    let current3YrBeta = 0
    let current5YrBeta = 0
    
    let matchedCount = 0
    let unmatchedTickers: string[] = []

    holdings.forEach(holding => {
      const betaEntry = betaData.find(b => b.ticker === holding.stock_ticker)
      const weight = holding.weight_pct / 100
      
      if (betaEntry) {
        matchedCount++
        // Use calculated betas (already have fallback logic applied)
        currentTrueBeta += (betaEntry.true_beta ?? 1) * weight
        current1YrBeta += (betaEntry.beta_1yr ?? 1) * weight
        current3YrBeta += (betaEntry.beta_3yr ?? 1) * weight
        current5YrBeta += (betaEntry.beta_5yr ?? 1) * weight
      } else {
        unmatchedTickers.push(holding.stock_ticker)
        // For unmatched tickers, default to beta of 1 (unless it's cash)
        const isCash = holding.stock_ticker.toUpperCase().includes('CASH') || 
                       holding.stock_ticker === 'FGXXX' || 
                       holding.stock_ticker === 'SPAXX' || 
                       holding.stock_ticker === 'VMFXX'
        const defaultBeta = isCash ? 0 : 1
        currentTrueBeta += defaultBeta * weight
        current1YrBeta += defaultBeta * weight
        current3YrBeta += defaultBeta * weight
        current5YrBeta += defaultBeta * weight
      }
    })
    
    console.log(`Trading: Matched ${matchedCount}/${holdings.length} holdings with beta data`)
    if (unmatchedTickers.length > 0) {
      console.log(`Trading: Unmatched tickers:`, unmatchedTickers.slice(0, 10))
    }
    console.log(`Trading: Current betas - True: ${currentTrueBeta.toFixed(3)}, 1yr: ${current1YrBeta.toFixed(3)}, 3yr: ${current3YrBeta.toFixed(3)}, 5yr: ${current5YrBeta.toFixed(3)}`)

    // Target Cash: Current cash % + sum of % cash change from trades
    const totalCashChange = trades.reduce((sum, t) => sum + t.cashChange, 0)
    const targetCashPct = currentCashPct + totalCashChange

    // Target Betas: SUMPRODUCT approach - build target weights for ALL holdings
    const targetWeights = new Map<string, number>()

    holdings.forEach(h => {
      targetWeights.set(h.stock_ticker, h.weight_pct)
    })

    trades.forEach(trade => {
      if (trade.ticker && trade.targetWeight !== undefined) {
        targetWeights.set(trade.ticker, trade.targetWeight)
      }
    })

    let targetTrueBeta = 0
    let target1YrBeta = 0
    let target3YrBeta = 0
    let target5YrBeta = 0

    targetWeights.forEach((weight, ticker) => {
      const betaEntry = betaData.find(b => b.ticker === ticker)
      const weightDecimal = weight / 100
      
      if (betaEntry) {
        // Use calculated betas (already have fallback logic applied)
        targetTrueBeta += (betaEntry.true_beta ?? 1) * weightDecimal
        target1YrBeta += (betaEntry.beta_1yr ?? 1) * weightDecimal
        target3YrBeta += (betaEntry.beta_3yr ?? 1) * weightDecimal
        target5YrBeta += (betaEntry.beta_5yr ?? 1) * weightDecimal
      } else {
        // For unmatched tickers, default to beta of 1 (unless it's cash)
        const isCash = ticker.toUpperCase().includes('CASH') || 
                       ticker === 'FGXXX' || 
                       ticker === 'SPAXX' || 
                       ticker === 'VMFXX'
        const defaultBeta = isCash ? 0 : 1
        targetTrueBeta += defaultBeta * weightDecimal
        target1YrBeta += defaultBeta * weightDecimal
        target3YrBeta += defaultBeta * weightDecimal
        target5YrBeta += defaultBeta * weightDecimal
      }
    })

    setPortfolioSummary({
      currentCashPct,
      currentTrueBeta,
      current1YrBeta,
      current3YrBeta,
      current5YrBeta,
      targetCashPct,
      targetTrueBeta,
      target1YrBeta,
      target3YrBeta,
      target5YrBeta
    })
  }

  const addTrade = () => {
    const newTrade: Trade = {
      id: Date.now().toString(),
      ticker: '',
      currentWeight: 0,
      targetWeight: 0,
      tradeSide: 'BUY',
      cashChange: 0,
      dollars: 0,
      shares: 0,
      price: 0
    }
    setTrades([...trades, newTrade])
  }

  const removeTrade = (id: string) => {
    setTrades(trades.filter(t => t.id !== id))
  }

  const updateTrade = (id: string, field: keyof Trade, value: any) => {
    const updatedTrades = trades.map((trade) => {
      if (trade.id !== id) return trade

      const updated = { ...trade, [field]: value }

      // Auto-calculate based on field changes
      if (field === 'ticker') {
        const holding = holdings.find(h => h.stock_ticker === value)
        updated.currentWeight = holding ? holding.weight_pct : 0
        
        // Clear existing debounce timer for this trade
        if (priceDebounceTimers.current[id]) {
          clearTimeout(priceDebounceTimers.current[id])
        }
        
        // Debounce the price fetch - only fetch after user stops typing for 500ms
        if (value && value.trim() !== '') {
          priceDebounceTimers.current[id] = setTimeout(async () => {
            try {
              const response = await fetch(`/api/stock-price?ticker=${value}`)
              const result = await response.json()
              if (result.success && result.data) {
                // Update only the price for this specific trade
                setTrades(currentTrades => 
                  currentTrades.map(t => {
                    if (t.id === id) {
                      const updatedTrade = { ...t, price: result.data.price || 0 }
                      // Recalculate shares with new price
                      if (updatedTrade.price > 0) {
                        updatedTrade.shares = Math.abs(updatedTrade.dollars / updatedTrade.price)
                      }
                      return updatedTrade
                    }
                    return t
                  })
                )
              }
            } catch (error) {
              console.error('Error fetching price:', error)
            }
          }, 500) // Wait 500ms after last keystroke
        } else {
          updated.price = 0
        }
      }

      // Calculate cash change: Current Weight - Target Weight
      if (field === 'targetWeight' || field === 'ticker') {
        updated.cashChange = updated.currentWeight - updated.targetWeight
      }

      // Calculate dollars: % Cash Change * NAV
      if (field === 'targetWeight' || field === 'ticker') {
        updated.dollars = (updated.cashChange / 100) * nav
      }

      // Calculate shares: Dollars / Price
      if (updated.price > 0) {
        updated.shares = Math.abs(updated.dollars / updated.price)
      }

      // Auto-set trade side based on cash change
      if (updated.cashChange > 0) {
        updated.tradeSide = 'SELL'
      } else if (updated.cashChange < 0) {
        updated.tradeSide = 'BUY'
      }

      return updated
    })

    setTrades(updatedTrades)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading trading data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Trading Calculator
        </h1>
        <p className="text-slate-400 mt-1">
          Calculate real-time cash and beta impacts from planned trades
        </p>
      </div>

      {/* Portfolio Summary Section */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">
          Portfolio Summary
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Current Metrics - Column 1 */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Current Cash</p>
              <p className="text-xl font-bold text-white">
                {portfolioSummary.currentCashPct.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Current True Beta</p>
              <p className="text-xl font-bold text-white">
                {portfolioSummary.currentTrueBeta.toFixed(2)}x
              </p>
            </div>
          </div>

          {/* Current Metrics - Column 2 */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Current 1-Year Beta</p>
              <p className="text-xl font-bold text-white">
                {portfolioSummary.current1YrBeta.toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Current 3-Year Beta</p>
              <p className="text-xl font-bold text-white">
                {portfolioSummary.current3YrBeta.toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Current 5-Year Beta</p>
              <p className="text-xl font-bold text-white">
                {portfolioSummary.current5YrBeta.toFixed(2)}x
              </p>
            </div>
          </div>

          {/* Target Metrics - Column 3 */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target Cash</p>
              <p className="text-xl font-bold text-blue-400">
                {portfolioSummary.targetCashPct.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target True Beta</p>
              <p className="text-xl font-bold text-blue-400">
                {portfolioSummary.targetTrueBeta.toFixed(2)}x
              </p>
            </div>
          </div>

          {/* Target Metrics - Column 4 */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target 1-Year Beta</p>
              <p className="text-xl font-bold text-blue-400">
                {portfolioSummary.target1YrBeta.toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target 3-Year Beta</p>
              <p className="text-xl font-bold text-blue-400">
                {portfolioSummary.target3YrBeta.toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target 5-Year Beta</p>
              <p className="text-xl font-bold text-blue-400">
                {portfolioSummary.target5YrBeta.toFixed(2)}x
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Trading Table Section */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Trade Planner
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter trades to see real-time impact on portfolio metrics
            </p>
          </div>
          <button
            onClick={addTrade}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            + Add Trade
          </button>
        </div>

        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 border-b border-slate-600 sticky top-0 z-10">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-white">Ticker</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Current Weight</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Target Weight</th>
                <th className="text-center py-3 px-4 font-semibold text-white">Trade Side</th>
                <th className="text-right py-3 px-4 font-semibold text-white">% Cash Change</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Dollars</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Price</th>
                <th className="text-right py-3 px-4 font-semibold text-white">Shares</th>
                <th className="text-center py-3 px-4 font-semibold text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No trades added yet. Click "Add Trade" to start planning.
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                    {/* Ticker Input */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={trade.ticker}
                        onChange={(e) => updateTrade(trade.id, 'ticker', e.target.value.toUpperCase())}
                        placeholder="Ticker"
                        className="w-24 bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      />
                    </td>

                    {/* Current Weight (Auto-calculated) */}
                    <td className="py-3 px-4 text-right text-slate-300">
                      {trade.currentWeight.toFixed(1)}%
                    </td>

                    {/* Target Weight Input */}
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        step="0.1"
                        value={trade.targetWeight || ''}
                        onChange={(e) => updateTrade(trade.id, 'targetWeight', parseFloat(e.target.value) || 0)}
                        placeholder="0.0"
                        className="w-20 bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>

                    {/* Trade Side (Auto-calculated) */}
                    <td className="py-3 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        trade.tradeSide === 'BUY' 
                          ? 'bg-green-900/30 text-green-400 border border-green-600' 
                          : 'bg-red-900/30 text-red-400 border border-red-600'
                      }`}>
                        {trade.tradeSide}
                      </span>
                    </td>

                    {/* % Cash Change (Auto-calculated) */}
                    <td className={`py-3 px-4 text-right font-medium ${
                      trade.cashChange > 0 ? 'text-red-400' : trade.cashChange < 0 ? 'text-green-400' : 'text-slate-300'
                    }`}>
                      {trade.cashChange > 0 ? '+' : ''}{trade.cashChange.toFixed(1)}%
                    </td>

                    {/* Dollars (Auto-calculated) */}
                    <td className="py-3 px-4 text-right text-slate-300">
                      ${Math.abs(trade.dollars).toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </td>

                    {/* Price (Auto-fetched) */}
                    <td className="py-3 px-4 text-right text-slate-300">
                      ${trade.price.toFixed(2)}
                    </td>

                    {/* Shares (Auto-calculated) */}
                    <td className="py-3 px-4 text-right text-slate-300">
                      {trade.shares.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </td>

                    {/* Remove Button */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => removeTrade(trade.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-300">
            <p className="font-semibold mb-1">How to use:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-200/80">
              <li>Enter a ticker symbol to auto-populate current weight and price</li>
              <li>Set target weight to see cash and beta impacts</li>
              <li>Trade side, cash change, dollars, and shares are calculated automatically</li>
              <li>Portfolio summary updates in real-time as you add trades</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
