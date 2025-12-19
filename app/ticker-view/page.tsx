'use client'

import { useState } from 'react'

interface TickerViewData {
  ticker: string
  name: string
  isClockwiseHolding: boolean
  weight: number | null
  netWeight: number | null
  targetWeight: number | null
  price: number | null
  priceChange: number | null
  targetPrice: number | null
  upside: number | null
  qqqWeight: number | null
  spyWeight: number | null
  shares: number | null
  marketValue: number | null
  beta1yr: number | null
  beta3yr: number | null
  beta5yr: number | null
  trueBeta: number | null
  earningsDate: string | null
  earningsTime: string | null
  indexWeights: Record<string, number>
  performance: any
  factset: any
  universe: any
}

export default function TickerViewPage() {
  const [searchTicker, setSearchTicker] = useState('')
  const [tickerData, setTickerData] = useState<TickerViewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scoringBenchmark, setScoringBenchmark] = useState<'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3'>('BENCHMARK1')
  const [scoringData, setScoringData] = useState<any>(null)
  const [scoringLoading, setScoringLoading] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchTicker.trim()) {
      setError('Please enter a ticker symbol')
      return
    }

    setLoading(true)
    setError(null)
    setTickerData(null)
    setScoringData(null)

    try {
      const response = await fetch(`/api/ticker-view?ticker=${searchTicker.toUpperCase()}`)
      const result = await response.json()

      if (result.success) {
        setTickerData(result.data)
        // Auto-load scoring data
        loadScoringData(searchTicker.toUpperCase())
      } else {
        setError(result.message || 'Failed to fetch ticker data')
      }
    } catch (err) {
      setError('Error fetching ticker data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadScoringData = async (ticker: string) => {
    setScoringLoading(true)
    try {
      const response = await fetch(`/api/scoring?profile=BASE&benchmark=${scoringBenchmark}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        const tickerScore = result.data.find((s: any) => s.ticker === ticker)
        setScoringData(tickerScore)
      }
    } catch (error) {
      console.error('Error fetching scoring data:', error)
    } finally {
      setScoringLoading(false)
    }
  }

  const formatNumber = (value: any, decimals: number = 2) => {
    if (value === null || value === undefined) return '-'
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num)) return '-'
    return num.toFixed(decimals)
  }

  const formatPercent = (value: any, decimals: number = 2) => {
    const formatted = formatNumber(value, decimals)
    return formatted === '-' ? '-' : `${formatted}%`
  }

  const formatCurrency = (value: any, decimals: number = 2) => {
    if (value === null || value === undefined) return '-'
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num)) return '-'
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Ticker View
        </h1>
        <p className="text-slate-400 mt-1">
          Comprehensive view of all KPIs and metrics for a single ticker
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={searchTicker}
            onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker symbol (e.g., AAPL, MSFT, NVDA)"
            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Ticker Data Display */}
      {tickerData && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-4xl font-bold text-white">{tickerData.ticker}</h2>
                <p className="text-xl text-slate-300 mt-1">{tickerData.name}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {tickerData.isClockwiseHolding && (
                  <div className="px-4 py-2 bg-green-900/50 border border-green-700 rounded-lg">
                    <span className="text-green-300 font-semibold">✓ Clockwise Holding</span>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{formatCurrency(tickerData.price)}</p>
                  <p className={`text-lg font-semibold ${tickerData.priceChange && tickerData.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tickerData.priceChange !== null ? `${tickerData.priceChange >= 0 ? '+' : ''}${formatPercent(tickerData.priceChange)}` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Key KPIs Grid */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-slate-400">Weight</p>
                <p className="text-2xl font-bold text-white">{formatPercent(tickerData.weight)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Net Weight</p>
                <p className="text-2xl font-bold text-white">{formatPercent(tickerData.netWeight)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Target Weight</p>
                <p className="text-2xl font-bold text-white">{formatPercent(tickerData.targetWeight)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Target Price</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(tickerData.targetPrice)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Upside</p>
                <p className={`text-2xl font-bold ${tickerData.upside && tickerData.upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(tickerData.upside)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">QQQ Weight</p>
                <p className="text-2xl font-bold text-white">{formatPercent(tickerData.qqqWeight)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">SPY Weight</p>
                <p className="text-2xl font-bold text-white">{formatPercent(tickerData.spyWeight)}</p>
              </div>
              {tickerData.isClockwiseHolding && (
                <div>
                  <p className="text-sm text-slate-400">Shares Owned</p>
                  <p className="text-2xl font-bold text-white">{tickerData.shares?.toLocaleString() || '-'}</p>
                </div>
              )}
            </div>
          </div>

          {/* True Beta & Risk Metrics */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Beta & Risk Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-400">True Beta</p>
                <p className="text-2xl font-bold text-white">{formatNumber(tickerData.trueBeta, 3)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">1-Year Beta</p>
                <p className="text-2xl font-bold text-white">{formatNumber(tickerData.beta1yr, 3)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">3-Year Beta</p>
                <p className="text-2xl font-bold text-white">{formatNumber(tickerData.beta3yr, 3)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">5-Year Beta</p>
                <p className="text-2xl font-bold text-white">{formatNumber(tickerData.beta5yr, 3)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Next Earnings</p>
                <p className="text-xl font-bold text-white">{tickerData.earningsDate || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Earnings Time</p>
                <p className="text-xl font-bold text-white">{tickerData.earningsTime || '-'}</p>
              </div>
            </div>
          </div>

          {/* Index Membership */}
          {Object.keys(tickerData.indexWeights).length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Index Membership & Weights</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Object.entries(tickerData.indexWeights).map(([index, weight]) => (
                  <div key={index} className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm font-semibold text-slate-300">{index}</p>
                    <p className="text-xl font-bold text-blue-400 mt-1">{formatPercent(weight)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {tickerData.performance && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div>
                  <p className="text-sm text-slate-400">1-Day Return</p>
                  <p className={`text-2xl font-bold ${tickerData.performance.return_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(tickerData.performance.return_1d)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">5-Day Return</p>
                  <p className={`text-2xl font-bold ${tickerData.performance.return_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(tickerData.performance.return_5d)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">30-Day Return</p>
                  <p className={`text-2xl font-bold ${tickerData.performance.return_30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(tickerData.performance.return_30d)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">QTD Return</p>
                  <p className={`text-2xl font-bold ${tickerData.performance.return_qtd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(tickerData.performance.return_qtd)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">YTD Return</p>
                  <p className={`text-2xl font-bold ${tickerData.performance.return_ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(tickerData.performance.return_ytd)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Valuation Metrics */}
          {tickerData.factset && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Valuation Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* P/E NTM */}
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-semibold text-blue-400 mb-3 pb-2 border-b border-slate-700">P/E NTM</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Current:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['P/E NTM']), 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">3-yr Avg:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['3-YR AVG NTM P/E']), 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">3-yr Median:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['3-YR MEDIAN NTM P/E']), 1)}</span>
                    </div>
                  </div>
                </div>

                {/* EV/EBITDA */}
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-semibold text-green-400 mb-3 pb-2 border-b border-slate-700">EV/EBITDA NTM</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Current:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['EV/EBITDA - NTM']), 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">3-yr Avg:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['3-YR AVG NTM EV/EBITDA']), 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">3-yr Median:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['3-YR MEDIAN NTM EV/EBITDA']), 1)}</span>
                    </div>
                  </div>
                </div>

                {/* EV/Sales */}
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-sm font-semibold text-purple-400 mb-3 pb-2 border-b border-slate-700">EV/Sales NTM</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">Current:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['EV/Sales - NTM']), 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">3-yr Avg:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['3-YR AVG NTM EV/SALES']), 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm">3-yr Median:</span>
                      <span className="text-white font-medium">{formatNumber(parseFloat(tickerData.factset['3-YR MEDIAN NTM EV/SALES']), 1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scoring Section - Coming Soon */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Scoring Breakdown</h3>
              <select
                value={scoringBenchmark}
                onChange={(e) => {
                  setScoringBenchmark(e.target.value as any)
                  if (tickerData) {
                    loadScoringData(tickerData.ticker)
                  }
                }}
                className="px-4 py-2 border border-slate-600 rounded-lg bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="BENCHMARK1">Benchmark 1</option>
                <option value="BENCHMARK2">Benchmark 2</option>
                <option value="BENCHMARK3">Benchmark 3</option>
              </select>
            </div>
            
            {scoringLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : scoringData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-slate-900 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400">Total Score</p>
                    <p className="text-3xl font-bold text-blue-400">{formatNumber(scoringData.totalScore, 1)}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400">Value</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(scoringData.valueScore, 1)}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400">Momentum</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(scoringData.momentumScore, 1)}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400">Quality</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(scoringData.qualityScore, 1)}</p>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400">Risk</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(scoringData.riskScore, 1)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No scoring data available for this ticker</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

