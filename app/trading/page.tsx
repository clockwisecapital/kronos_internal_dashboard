'use client'

import { useState, useEffect } from 'react'

interface HoldingData {
  stock_ticker: string
  weight_pct: number
  market_value: number
}

interface UniverseData {
  ticker: string
  true_beta: number | null
  beta_1yr: number | null
  beta_3yr: number | null
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
  currentCash: number
  currentTrueBeta: number
  current1YrBeta: number
  current3YrBeta: number
  targetCash: number
  targetTrueBeta: number
  target1YrBeta: number
  target3YrBeta: number
}

export default function TradingPage() {
  const [loading, setLoading] = useState(true)
  const [nav, setNav] = useState(0)
  const [holdings, setHoldings] = useState<HoldingData[]>([])
  const [universe, setUniverse] = useState<UniverseData[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    currentCash: 0,
    currentTrueBeta: 0,
    current1YrBeta: 0,
    current3YrBeta: 0,
    targetCash: 0,
    targetTrueBeta: 0,
    target1YrBeta: 0,
    target3YrBeta: 0
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    calculatePortfolioSummary()
  }, [holdings, universe, trades, nav])

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      // Fetch Portfolio NAV
      const portfolioRes = await fetch('/api/portfolio', { cache: 'no-store' })
      const portfolioData = await portfolioRes.json()
      if (portfolioData.success) {
        setNav(portfolioData.data.nav)
      }

      // Fetch Holdings with weights
      const holdingsRes = await fetch('/api/holdings')
      const holdingsData = await holdingsRes.json()
      if (holdingsData.success && holdingsData.data) {
        const holdingsWithWeights = holdingsData.data.map((h: any) => ({
          stock_ticker: h.stock_ticker,
          weight_pct: (h.market_value / portfolioData.data.nav) * 100,
          market_value: h.market_value
        }))
        setHoldings(holdingsWithWeights)
      }

      // Fetch Universe data for beta values
      const universeRes = await fetch('/api/universe')
      const universeData = await universeRes.json()
      if (universeData.success) {
        setUniverse(universeData.data)
      }

    } catch (error) {
      console.error('Error fetching trading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePortfolioSummary = () => {
    // Current Cash: Sum of cash & equivalents + FGXXX
    const cashHoldings = holdings.filter(h => 
      h.stock_ticker.toUpperCase().includes('CASH') || 
      h.stock_ticker.toUpperCase().includes('EQUIVALENTS') ||
      h.stock_ticker === 'FGXXX'
    )
    const currentCash = cashHoldings.reduce((sum, h) => sum + h.market_value, 0)

    // Current Betas: Sumproduct of weights with corresponding betas
    let currentTrueBeta = 0
    let current1YrBeta = 0
    let current3YrBeta = 0

    holdings.forEach(holding => {
      const universeEntry = universe.find(u => u.ticker === holding.stock_ticker)
      if (universeEntry) {
        const weight = holding.weight_pct / 100
        currentTrueBeta += (universeEntry.true_beta || 0) * weight
        current1YrBeta += (universeEntry.beta_1yr || 0) * weight
        current3YrBeta += (universeEntry.beta_3yr || 0) * weight
      }
    })

    // Target Cash: Current cash + sum of % cash change from trades
    const totalCashChange = trades.reduce((sum, t) => sum + t.cashChange, 0)
    const targetCash = currentCash + (totalCashChange / 100 * nav)

    // Target Betas: Current beta + weighted average of trade betas
    let tradeTrueBetaImpact = 0
    let trade1YrBetaImpact = 0
    let trade3YrBetaImpact = 0

    trades.forEach(trade => {
      const universeEntry = universe.find(u => u.ticker === trade.ticker)
      if (universeEntry && trade.targetWeight !== 0) {
        const weightChange = (trade.targetWeight - trade.currentWeight) / 100
        tradeTrueBetaImpact += (universeEntry.true_beta || 0) * weightChange
        trade1YrBetaImpact += (universeEntry.beta_1yr || 0) * weightChange
        trade3YrBetaImpact += (universeEntry.beta_3yr || 0) * weightChange
      }
    })

    const targetTrueBeta = currentTrueBeta + tradeTrueBetaImpact
    const target1YrBeta = current1YrBeta + trade1YrBetaImpact
    const target3YrBeta = current3YrBeta + trade3YrBetaImpact

    setPortfolioSummary({
      currentCash,
      currentTrueBeta,
      current1YrBeta,
      current3YrBeta,
      targetCash,
      targetTrueBeta,
      target1YrBeta,
      target3YrBeta
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

  const updateTrade = async (id: string, field: keyof Trade, value: any) => {
    const updatedTrades = await Promise.all(trades.map(async (trade) => {
      if (trade.id !== id) return trade

      const updated = { ...trade, [field]: value }

      // Auto-calculate based on field changes
      if (field === 'ticker') {
        const holding = holdings.find(h => h.stock_ticker === value)
        updated.currentWeight = holding ? holding.weight_pct : 0
        
        // Fetch real-time price via API
        if (value && value.trim() !== '') {
          try {
            const response = await fetch(`/api/stock-price?ticker=${value}`)
            const result = await response.json()
            if (result.success && result.data) {
              updated.price = result.data.price || 0
            } else {
              updated.price = 0
            }
          } catch (error) {
            console.error('Error fetching price:', error)
            updated.price = 0
          }
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
    }))

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
          {/* Current Metrics */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Current Cash</p>
              <p className="text-xl font-bold text-white">
                ${portfolioSummary.currentCash.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Current True Beta</p>
              <p className="text-xl font-bold text-white">
                {portfolioSummary.currentTrueBeta.toFixed(2)}x
              </p>
            </div>
          </div>

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
          </div>

          {/* Target Metrics */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target Cash</p>
              <p className="text-xl font-bold text-blue-400">
                ${portfolioSummary.targetCash.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-400 mb-1">Target True Beta</p>
              <p className="text-xl font-bold text-blue-400">
                {portfolioSummary.targetTrueBeta.toFixed(2)}x
              </p>
            </div>
          </div>

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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 border-b border-slate-600">
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
