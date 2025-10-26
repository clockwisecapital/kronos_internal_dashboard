'use client'

import { useState, useEffect } from 'react'

interface RiskMetrics {
  sharpeRatio: number | null
  annualizedVolatility: number | null
  var95: number | null
  maxDrawdown: number | null
  daysOfData: number
  requiresDays: number
}

interface SnapshotStats {
  total_snapshots: number
  last_updated: string
  last_snapshot_date: string
  latest_nav: number
}

export default function RiskPage() {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [snapshotStats, setSnapshotStats] = useState<SnapshotStats | null>(null)
  const [capturingSnapshot, setCapturingSnapshot] = useState(false)
  const [snapshotMessage, setSnapshotMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [scoreInputs, setScoreInputs] = useState({
    ticker: '',
    // Valuation
    pe: '',
    evEbitda: '',
    evSales: '',
    baseUpside: '',
    optUpside: '',
    // Momentum
    return12M: '',
    return3M: '',
    high52w: '',
    epsSurprise: '',
    revSurprise: '',
    ntmEpsChange: '',
    ntmRevChange: '',
    // Quality
    roicTTM: '',
    grossProf: '',
    accruals: '',
    fcf: '',
    roic3yr: '',
    ebitdaMargin: '',
    // Risk
    beta3yr: '',
    vol30d: '',
    maxDD: '',
    finLeverage: '',
  })

  // Fetch risk metrics and snapshot stats on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingMetrics(true)
        
        // Fetch risk metrics
        const metricsResponse = await fetch('/api/risk/metrics')
        const metricsJson = await metricsResponse.json()
        if (metricsJson.success && metricsJson.data) {
          setRiskMetrics(metricsJson.data)
        }
        
        // Fetch snapshot stats
        const statsResponse = await fetch('/api/snapshot')
        const statsJson = await statsResponse.json()
        if (statsJson.success && statsJson.data) {
          setSnapshotStats(statsJson.data)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoadingMetrics(false)
      }
    }

    fetchData()
  }, [])

  // Capture portfolio snapshot
  async function handleCaptureSnapshot() {
    try {
      setCapturingSnapshot(true)
      setSnapshotMessage(null)
      
      const response = await fetch('/api/snapshot', {
        method: 'POST',
        credentials: 'include'
      })
      
      const json = await response.json()
      
      if (json.success) {
        const isUpdate = json.data.isUpdate
        setSnapshotMessage({
          type: 'success',
          text: isUpdate 
            ? `Snapshot updated! NAV: $${json.data.nav.toLocaleString()} (same day, latest prices)`
            : `Snapshot captured! NAV: $${json.data.nav.toLocaleString()} (new day added)`
        })
        
        // Refresh risk metrics and snapshot stats after snapshot
        const metricsResponse = await fetch('/api/risk/metrics')
        const metricsJson = await metricsResponse.json()
        if (metricsJson.success && metricsJson.data) {
          setRiskMetrics(metricsJson.data)
        }
        
        const statsResponse = await fetch('/api/snapshot')
        const statsJson = await statsResponse.json()
        if (statsJson.success && statsJson.data) {
          setSnapshotStats(statsJson.data)
        }
      } else {
        setSnapshotMessage({
          type: json.message?.includes('already exists') ? 'info' : 'error',
          text: json.message || 'Failed to capture snapshot'
        })
      }
    } catch (error) {
      console.error('Error capturing snapshot:', error)
      setSnapshotMessage({
        type: 'error',
        text: 'Failed to capture snapshot'
      })
    } finally {
      setCapturingSnapshot(false)
    }
  }

  const vix = {
    level: 18.42,
    change: -5.2,
    status: 'LOW VOL',
    statusColor: 'text-green-600 dark:text-green-400',
  }

  const marketDownside = [
    { index: 'SPY', ma9d: -2.1, ma50d: -1.2, ma100d: 0.8, ma200d: 3.2 },
    { index: 'QQQ', ma9d: 1.2, ma50d: 2.8, ma100d: 5.1, ma200d: 8.9 },
    { index: 'DIA', ma9d: -3.5, ma50d: -2.1, ma100d: -0.5, ma200d: 1.8 },
    { index: 'IWM', ma9d: -4.2, ma50d: -3.8, ma100d: -2.1, ma200d: 0.2 },
    { index: 'SMH', ma9d: 3.8, ma50d: 6.2, ma100d: 11.5, ma200d: 18.7 },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Risk Assessment
            </h1>
            <p className="text-slate-400 mt-1">
              Portfolio risk metrics, market conditions, and stock scoring system
            </p>
            {/* Last Snapshot Indicator */}
            {snapshotStats && snapshotStats.last_updated && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-slate-500">
                  Last snapshot: {new Date(snapshotStats.last_updated).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500">
                  {snapshotStats.total_snapshots} day{snapshotStats.total_snapshots !== 1 ? 's' : ''} collected
                </span>
              </div>
            )}
          </div>
          
          {/* Snapshot Capture Button */}
          <button
            onClick={handleCaptureSnapshot}
            disabled={capturingSnapshot}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-lg flex items-center gap-2"
          >
            {capturingSnapshot ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Capturing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Capture Snapshot
              </>
            )}
          </button>
        </div>

        {/* Snapshot Message */}
        {snapshotMessage && (
          <div className={`mt-4 p-4 rounded-lg border ${
            snapshotMessage.type === 'success' 
              ? 'bg-green-900/20 border-green-800 text-green-400' 
              : snapshotMessage.type === 'info'
              ? 'bg-blue-900/20 border-blue-800 text-blue-400'
              : 'bg-red-900/20 border-red-800 text-red-400'
          }`}>
            <div className="flex items-center gap-2">
              {snapshotMessage.type === 'success' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {snapshotMessage.type === 'info' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
              {snapshotMessage.type === 'error' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-medium">{snapshotMessage.text}</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Section: Risk Metrics + VIX + Market Downside */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Metrics */}
        <div className="lg:col-span-4 space-y-4">
          {/* Sharpe Ratio */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
            <p className="text-xs font-medium text-slate-400 mb-1">
              Sharpe Ratio
            </p>
            {loadingMetrics ? (
              <div className="text-slate-400">
                <div className="h-8 w-16 bg-slate-700 rounded animate-pulse"></div>
              </div>
            ) : riskMetrics && riskMetrics.sharpeRatio !== null ? (
              <>
                <p className="text-2xl font-bold text-white mb-1">
                  {riskMetrics.sharpeRatio.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  Risk-adjusted return
                </p>
              </>
            ) : (
              <div>
                <p className="text-sm text-slate-400 mb-2">Collecting data...</p>
                <p className="text-xs text-slate-500 mb-2">
                  {riskMetrics?.daysOfData || 0}/{riskMetrics?.requiresDays || 30} days
                </p>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((riskMetrics?.daysOfData || 0) / (riskMetrics?.requiresDays || 30)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Annualized Volatility */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
            <p className="text-xs font-medium text-slate-400 mb-1">
              Annualized Volatility
            </p>
            {loadingMetrics ? (
              <div className="text-slate-400">
                <div className="h-8 w-16 bg-slate-700 rounded animate-pulse"></div>
              </div>
            ) : riskMetrics && riskMetrics.annualizedVolatility !== null ? (
              <>
                <p className="text-2xl font-bold text-white mb-1">
                  {riskMetrics.annualizedVolatility.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-500">
                  Standard deviation
                </p>
              </>
            ) : (
              <div>
                <p className="text-sm text-slate-400 mb-2">Collecting data...</p>
                <p className="text-xs text-slate-500 mb-2">
                  {riskMetrics?.daysOfData || 0}/{riskMetrics?.requiresDays || 30} days
                </p>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((riskMetrics?.daysOfData || 0) / (riskMetrics?.requiresDays || 30)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* VaR 95% */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
            <p className="text-xs font-medium text-slate-400 mb-1">
              VaR 95%
            </p>
            {loadingMetrics ? (
              <div className="text-slate-400">
                <div className="h-8 w-16 bg-slate-700 rounded animate-pulse"></div>
              </div>
            ) : riskMetrics && riskMetrics.var95 !== null ? (
              <>
                <p className="text-2xl font-bold text-white mb-1">
                  {riskMetrics.var95.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-500">
                  Value at Risk
                </p>
              </>
            ) : (
              <div>
                <p className="text-sm text-slate-400 mb-2">Collecting data...</p>
                <p className="text-xs text-slate-500 mb-2">
                  {riskMetrics?.daysOfData || 0}/{riskMetrics?.requiresDays || 30} days
                </p>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((riskMetrics?.daysOfData || 0) / (riskMetrics?.requiresDays || 30)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Max Drawdown */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
            <p className="text-xs font-medium text-slate-400 mb-1">
              Max Drawdown
            </p>
            {loadingMetrics ? (
              <div className="text-slate-400">
                <div className="h-8 w-16 bg-slate-700 rounded animate-pulse"></div>
              </div>
            ) : riskMetrics && riskMetrics.maxDrawdown !== null ? (
              <>
                <p className="text-2xl font-bold text-white mb-1">
                  {riskMetrics.maxDrawdown.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-500">
                  Largest decline
                </p>
              </>
            ) : (
              <div>
                <p className="text-sm text-slate-400 mb-2">Collecting data...</p>
                <p className="text-xs text-slate-500 mb-2">
                  {riskMetrics?.daysOfData || 0}/{riskMetrics?.requiresDays || 30} days
                </p>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((riskMetrics?.daysOfData || 0) / (riskMetrics?.requiresDays || 30)) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* VIX Indicator + Market Downside */}
        <div className="lg:col-span-8 space-y-6">
          {/* VIX Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <p className="text-sm font-medium text-slate-400 mb-4">
              VIX Fear Index
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-white">
                  {vix.level}
                </p>
                <p className={`text-sm font-medium mt-1 ${vix.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {vix.change > 0 ? '+' : ''}{vix.change.toFixed(1)}%
                </p>
              </div>
              <div className={`px-4 py-2 rounded-lg font-semibold ${vix.statusColor} bg-green-100 dark:bg-green-900/20`}>
                {vix.status}
              </div>
            </div>
          </div>

          {/* Market Downside Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-700">
              <p className="text-sm font-semibold text-white">
                Market Downside
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Distance from moving averages
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700 border-b border-slate-600">
                    <th className="text-left py-3 px-4 font-semibold text-white">
                      Index
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-white">
                      9D MA
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-white">
                      50D MA
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-white">
                      100D MA
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-white">
                      200D MA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {marketDownside.map((row) => (
                    <tr
                      key={row.index}
                      className="border-b border-slate-700"
                    >
                      <td className="py-3 px-4 font-medium text-white">
                        {row.index}
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma9d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.ma9d > 0 ? '+' : ''}{row.ma9d.toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma50d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.ma50d > 0 ? '+' : ''}{row.ma50d.toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma100d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.ma100d > 0 ? '+' : ''}{row.ma100d.toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma200d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.ma200d > 0 ? '+' : ''}{row.ma200d.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Scoring Calculator */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">
            Stock Scoring Calculator
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Enter 22 metrics across 4 categories to calculate composite score
          </p>
        </div>

        {/* Ticker Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Ticker Symbol
          </label>
          <input
            type="text"
            value={scoreInputs.ticker}
            onChange={(e) => setScoreInputs({ ...scoreInputs, ticker: e.target.value.toUpperCase() })}
            placeholder="AAPL"
            className="w-full max-w-xs px-4 py-2 border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Valuation Section */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-white mb-4 pb-2 border-b border-slate-700">
            Valuation (40% weight)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                P/E Ratio
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                EV/EBITDA
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                EV/Sales
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Base Upside %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Optionality Upside %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Momentum Section */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-white mb-4 pb-2 border-b border-slate-700">
            Momentum (30% weight)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                12M Return (ex 1M) %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                3M Return %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                52W High %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                EPS Surprise %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Revenue Surprise %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                NTM EPS Change %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                NTM Rev Change %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Calculate Button and Result */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-700">
          <button className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20">
            Calculate Score
          </button>
          <div className="bg-slate-700 rounded-lg px-6 py-4 border-2 border-orange-500">
            <p className="text-xs text-slate-400 mb-1">Total Score</p>
            <p className="text-3xl font-bold text-white">
              --<span className="text-lg text-slate-500">/100</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
