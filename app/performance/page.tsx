'use client'

import { useEffect, useState } from 'react'

interface HoldingPerformance {
  ticker: string
  weight: number
  return_1d: number
  return_5d: number
  return_30d: number
  return_90d: number
  return_1yr: number
  return_qtd: number
  return_ytd: number
}

export default function PerformancePage() {
  const [performanceData, setPerformanceData] = useState<HoldingPerformance[]>([])
  const [benchmarks, setBenchmarks] = useState<HoldingPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPerformanceData() {
      try {
        setLoading(true)
        setError(null)
        
        console.log('Fetching performance data...')
        const response = await fetch('/api/performance')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const json = await response.json()
        
        if (!json.success) {
          throw new Error(json.message || 'Failed to fetch performance data')
        }
        
        console.log('Performance data loaded:', json.data)
        setPerformanceData(json.data.holdings)
        setBenchmarks(json.data.benchmarks || [])
      } catch (err) {
        console.error('Error fetching performance data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchPerformanceData()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Performance Attribution
          </h1>
          <p className="text-slate-400 mt-1">
            Loading performance data...
          </p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="text-slate-400 mt-4">Calculating returns...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Performance Attribution
          </h1>
          <p className="text-slate-400 mt-1">
            Individual holding performance and portfolio contribution analysis
          </p>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <p className="text-red-400 font-semibold">Error loading performance data</p>
          <p className="text-red-300 text-sm mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Performance
        </h1>
        <p className="text-slate-400 mt-1">
          Individual holding performance across all time periods
        </p>
      </div>

      {/* Benchmark Performance Table */}
      {benchmarks.length > 0 && (
        <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-700/50 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-blue-700/50">
            <h2 className="text-lg font-semibold text-white">
              Market Benchmarks
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              SPY and QQQ performance for comparison
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700/50 border-b border-blue-700/50">
                  <th className="text-left py-3 px-6 font-semibold text-white">
                    Ticker
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    1-Day Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    5-Day Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    30-Day Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    90-Day Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    1-Year Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    QTD Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    YTD Return
                  </th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((benchmark) => (
                  <tr
                    key={benchmark.ticker}
                    className="border-b border-blue-700/30 hover:bg-blue-900/20 transition-colors"
                  >
                    <td className="py-4 px-6 font-bold text-blue-300">
                      {benchmark.ticker}
                    </td>
                    <td className={`text-right py-4 px-6 font-medium ${benchmark.return_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {benchmark.return_1d > 0 ? '+' : ''}{benchmark.return_1d.toFixed(2)}%
                    </td>
                    <td className={`text-right py-4 px-6 font-medium ${benchmark.return_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {benchmark.return_5d > 0 ? '+' : ''}{benchmark.return_5d.toFixed(2)}%
                    </td>
                    <td className={`text-right py-4 px-6 font-medium ${benchmark.return_30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {benchmark.return_30d > 0 ? '+' : ''}{benchmark.return_30d.toFixed(2)}%
                    </td>
                    <td className={`text-right py-4 px-6 font-medium ${benchmark.return_90d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {benchmark.return_90d > 0 ? '+' : ''}{benchmark.return_90d.toFixed(2)}%
                    </td>
                    <td className={`text-right py-4 px-6 font-medium ${benchmark.return_1yr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {benchmark.return_1yr > 0 ? '+' : ''}{benchmark.return_1yr.toFixed(2)}%
                    </td>
                    <td className={`text-right py-4 px-6 font-medium ${benchmark.return_qtd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {benchmark.return_qtd > 0 ? '+' : ''}{benchmark.return_qtd.toFixed(2)}%
                    </td>
                    <td className={`text-right py-4 px-6 font-medium ${benchmark.return_ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {benchmark.return_ytd > 0 ? '+' : ''}{benchmark.return_ytd.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Holdings Performance Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Portfolio Holdings
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Individual position returns across all time periods
          </p>
        </div>
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-700 border-b border-slate-600">
                <th className="text-left py-3 px-6 font-semibold text-white sticky left-0 bg-slate-700 z-20">
                  Ticker
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  Weight
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  1-Day Return
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  5-Day Return
                </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    30-Day Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    90-Day Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    1-Year Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    QTD Return
                  </th>
                  <th className="text-right py-3 px-6 font-semibold text-white">
                    YTD Return
                  </th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((stock) => (
                <tr
                  key={stock.ticker}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="py-4 px-6 font-semibold text-white sticky left-0 bg-slate-800 hover:bg-slate-700/50">
                    {stock.ticker}
                  </td>
                  <td className="text-right py-4 px-6 text-slate-300">
                    {stock.weight.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_1d > 0 ? '+' : ''}{stock.return_1d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return_5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_5d > 0 ? '+' : ''}{stock.return_5d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return_30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_30d > 0 ? '+' : ''}{stock.return_30d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return_90d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_90d > 0 ? '+' : ''}{stock.return_90d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return_1yr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_1yr > 0 ? '+' : ''}{stock.return_1yr.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return_qtd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_qtd > 0 ? '+' : ''}{stock.return_qtd.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return_ytd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return_ytd > 0 ? '+' : ''}{stock.return_ytd.toFixed(1)}%
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
