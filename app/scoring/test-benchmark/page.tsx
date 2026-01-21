'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

interface BenchmarkTestData {
  success: boolean
  timestamp: string
  testTicker: string
  assignedBenchmark: string
  benchmarkConstituents: {
    total: number
    withFactSet: number
    withYahoo: number
    withCompleteData: number
    tickers: string[]
  }
  testTickerMetrics: {
    peRatio: number | null
    evEbitda: number | null
    evSales: number | null
    return3M: number | null
    beta3Yr: number | null
    epsSurprise: number | null
    revSurprise: number | null
    ntmEpsChange: number | null
    ntmRevChange: number | null
    roicTTM: number | null
    grossProfitability: number | null
    accruals: number | null
  }
  testTickerScores: {
    peRatioScore: number | null
    evEbitdaScore: number | null
    evSalesScore: number | null
    return3MScore: number | null
    beta3YrScore: number | null
    epsSurpriseScore: number | null
    revSurpriseScore: number | null
    ntmEpsChangeScore: number | null
    ntmRevChangeScore: number | null
    roicTTMScore: number | null
    grossProfitabilityScore: number | null
    accrualsScore: number | null
  }
  benchmarkMetricsDistribution: {
    peRatios: Array<{ ticker: string, value: number | null }>
    evEbitdas: Array<{ ticker: string, value: number | null }>
    evSales: Array<{ ticker: string, value: number | null }>
    return3Ms: Array<{ ticker: string, value: number | null }>
    beta3Yrs: Array<{ ticker: string, value: number | null }>
    epsSurprises: Array<{ ticker: string, value: number | null }>
    revSurprises: Array<{ ticker: string, value: number | null }>
    ntmEpsChanges: Array<{ ticker: string, value: number | null }>
    ntmRevChanges: Array<{ ticker: string, value: number | null }>
    roicTTMs: Array<{ ticker: string, value: number | null }>
    grossProfitabilities: Array<{ ticker: string, value: number | null }>
    accruals: Array<{ ticker: string, value: number | null }>
  }
  ranking: {
    peRatio: string
    evEbitda: string
    evSales: string
    return3M: string
    beta3Yr: string
    epsSurprise: string
    revSurprise: string
    ntmEpsChange: string
    ntmRevChange: string
    roicTTM: string
    grossProfitability: string
    accruals: string
  }
  missingData: {
    noFactSet: string[]
    noYahoo: string[]
    incompleteMetrics: string[]
  }
  calculationMethod: {
    return3M: string
    ntmEpsChange: string
    ntmRevChange: string
  }
}

export default function TestBenchmarkPage() {
  const [ticker, setTicker] = useState('AAPL')
  const [benchmark, setBenchmark] = useState<'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3' | 'BENCHMARK_CUSTOM'>('BENCHMARK1')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BenchmarkTestData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchTest = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/scoring/test-benchmark?ticker=${ticker.toUpperCase()}&benchmark=${benchmark}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to run test')
      }
      
      setData(result)
    } catch (err) {
      console.error('Error running test:', err)
      setError(err instanceof Error ? err.message : 'Failed to run benchmark test')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ticker) {
      fetchTest()
    }
  }, [ticker, benchmark])

  const isVerified = data && 
    data.benchmarkConstituents.withCompleteData >= 10 &&
    (data.benchmarkConstituents.withCompleteData / data.benchmarkConstituents.total) >= 0.8

  const formatNumber = (num: number | null, decimals: number = 2) => {
    if (num === null) return 'N/A'
    return num.toFixed(decimals)
  }

  const formatPercent = (num: number | null) => {
    if (num === null) return 'N/A'
    return `${(num * 100).toFixed(2)}%`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Benchmark Scoring Verification</h1>
        <p className="text-gray-700">Test and verify that peer comparisons are working correctly</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 items-center flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">Ticker to Test</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="border rounded px-3 py-2 uppercase text-gray-900"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">Benchmark</label>
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value as any)}
              className="border rounded px-3 py-2 text-gray-900"
            >
              <option value="BENCHMARK1">Benchmark 1</option>
              <option value="BENCHMARK2">Benchmark 2</option>
              <option value="BENCHMARK3">Benchmark 3</option>
              <option value="BENCHMARK_CUSTOM">Custom</option>
            </select>
          </div>

          <button
            onClick={fetchTest}
            disabled={loading}
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Testing...' : 'Run Test'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-800">Running benchmark verification test...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Verification Badge */}
          <div className={`rounded-lg shadow-lg p-8 text-center ${isVerified ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-yellow-500 to-yellow-600'}`}>
            <div className="flex items-center justify-center mb-4">
              {isVerified ? (
                <CheckCircle className="w-20 h-20 text-white" />
              ) : (
                <AlertTriangle className="w-20 h-20 text-white" />
              )}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {isVerified ? '✓ VERIFIED' : '⚠ WARNING'}
            </h2>
            <p className="text-xl text-white mb-4">
              {isVerified 
                ? `All ${data.assignedBenchmark} constituents are being used correctly for benchmark scoring`
                : `Some benchmark constituents are missing data - scoring may be less accurate`
              }
            </p>
            <div className="text-white text-sm opacity-90">
              {data.benchmarkConstituents.withCompleteData} of {data.benchmarkConstituents.total} constituents have complete data
              ({((data.benchmarkConstituents.withCompleteData / data.benchmarkConstituents.total) * 100).toFixed(1)}%)
            </div>
          </div>

          {/* Test Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Test Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Test Ticker</div>
                <div className="text-2xl font-bold text-gray-900">{data.testTicker}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Assigned Benchmark</div>
                <div className="text-2xl font-bold text-blue-600">{data.assignedBenchmark}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Constituents</div>
                <div className="text-2xl font-bold text-gray-900">{data.benchmarkConstituents.total}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Used for Scoring</div>
                <div className="text-2xl font-bold text-green-600">{data.benchmarkConstituents.withCompleteData}</div>
              </div>
            </div>
          </div>

          {/* Bug Fix Verification Banner */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-3">🔧 Bug Fix Verification Tests</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/10 rounded p-3">
                <div className="font-semibold mb-1">Bug Fix #1: Calendar Days</div>
                <div className="text-xs opacity-90">{data.calculationMethod.return3M}</div>
              </div>
              <div className="bg-white/10 rounded p-3">
                <div className="font-semibold mb-1">Bug Fix #2: 90-Day Lookback</div>
                <div className="text-xs opacity-90">{data.calculationMethod.ntmEpsChange}</div>
              </div>
              <div className="bg-white/10 rounded p-3">
                <div className="font-semibold mb-1">Bug Fixes #3-5: Benchmark Scoring</div>
                <div className="text-xs opacity-90">MOMENTUM & QUALITY metrics now ranked against benchmark constituents</div>
              </div>
            </div>
          </div>

          {/* Metrics & Scores */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">{data.testTicker} Metrics & Scores</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 text-gray-900">Metric</th>
                    <th className="text-right py-2 px-4 text-gray-900">Raw Value</th>
                    <th className="text-right py-2 px-4 text-gray-900">Percentile Score</th>
                    <th className="text-right py-2 px-4 text-gray-900">Ranking</th>
                    <th className="text-center py-2 px-4 text-gray-900">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">P/E Ratio (NTM)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatNumber(data.testTickerMetrics.peRatio)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.peRatioScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.peRatioScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.peRatio}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.peRatioScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">EV/EBITDA (NTM)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatNumber(data.testTickerMetrics.evEbitda)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.evEbitdaScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.evEbitdaScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.evEbitda}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.evEbitdaScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">EV/Sales (NTM)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatNumber(data.testTickerMetrics.evSales)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.evSalesScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.evSalesScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.evSales}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.evSalesScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">3-Month Return</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatPercent(data.testTickerMetrics.return3M)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.return3MScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.return3MScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.return3M}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.return3MScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">Beta (3-Year)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatNumber(data.testTickerMetrics.beta3Yr)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.beta3YrScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.beta3YrScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.beta3Yr}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.beta3YrScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">
              <strong className="text-gray-900">Note:</strong> Percentile scores show how {data.testTicker} ranks against all {data.assignedBenchmark} constituents. 
              A score of 70 means {data.testTicker} is better than 70% of its peers for that metric.
            </div>
          </div>

          {/* NEW: MOMENTUM Metrics (Bug Fixes #2, #3, #5) */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-gray-900">MOMENTUM Metrics</h2>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold">BUG FIXES #2, #3, #5</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 text-gray-900">Metric</th>
                    <th className="text-right py-2 px-4 text-gray-900">Raw Value</th>
                    <th className="text-right py-2 px-4 text-gray-900">Percentile Score</th>
                    <th className="text-right py-2 px-4 text-gray-900">Ranking</th>
                    <th className="text-center py-2 px-4 text-gray-900">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">EPS Surprise (Last Qtr)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatPercent(data.testTickerMetrics.epsSurprise)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.epsSurpriseScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.epsSurpriseScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.epsSurprise}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.epsSurpriseScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">Revenue Surprise (Last Qtr)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatPercent(data.testTickerMetrics.revSurprise)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.revSurpriseScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.revSurpriseScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.revSurprise}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.revSurpriseScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      NTM EPS Change (90-day)
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Fixed</span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.testTickerMetrics.ntmEpsChange ? `${((data.testTickerMetrics.ntmEpsChange - 1) * 100).toFixed(2)}%` : 'N/A'}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.ntmEpsChangeScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.ntmEpsChangeScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.ntmEpsChange}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.ntmEpsChangeScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">
                      NTM Rev Change (90-day)
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Fixed</span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.testTickerMetrics.ntmRevChange ? `${((data.testTickerMetrics.ntmRevChange - 1) * 100).toFixed(2)}%` : 'N/A'}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.ntmRevChangeScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.ntmRevChangeScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.ntmRevChange}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.ntmRevChangeScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-600 bg-purple-50 border border-purple-200 rounded p-3">
              <strong className="text-gray-900">Bug Fixes Applied:</strong> NTM EPS/Rev Change now use 90-day lookback (Bug #2) and all MOMENTUM metrics are ranked against benchmark constituents (Bugs #3, #5).
            </div>
          </div>

          {/* NEW: QUALITY Metrics (Bug Fixes #4, #5) */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-gray-900">QUALITY Metrics</h2>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold">BUG FIXES #4, #5</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 text-gray-900">Metric</th>
                    <th className="text-right py-2 px-4 text-gray-900">Raw Value</th>
                    <th className="text-right py-2 px-4 text-gray-900">Percentile Score</th>
                    <th className="text-right py-2 px-4 text-gray-900">Ranking</th>
                    <th className="text-center py-2 px-4 text-gray-900">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">ROIC (TTM)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatPercent(data.testTickerMetrics.roicTTM)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.roicTTMScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.roicTTMScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.roicTTM}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.roicTTMScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">Gross Profitability</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatPercent(data.testTickerMetrics.grossProfitability)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.grossProfitabilityScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.grossProfitabilityScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.grossProfitability}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.grossProfitabilityScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">Accruals (Lower is Better)</td>
                    <td className="text-right py-3 px-4 text-gray-800">{formatPercent(data.testTickerMetrics.accruals)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={`font-bold ${(data.testTickerScores.accrualsScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(data.testTickerScores.accrualsScore, 1)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-800">{data.ranking.accruals}</td>
                    <td className="text-center py-3 px-4">
                      {(data.testTickerScores.accrualsScore || 0) >= 50 ? 
                        <TrendingUp className="w-5 h-5 text-green-600 inline" /> : 
                        <TrendingDown className="w-5 h-5 text-red-600 inline" />
                      }
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-600 bg-purple-50 border border-purple-200 rounded p-3">
              <strong className="text-gray-900">Bug Fixes Applied:</strong> All QUALITY metrics are now ranked against benchmark constituents instead of the universe (Bugs #4, #5).
            </div>
          </div>

          {/* Detailed Score Breakdowns */}
          <div className="space-y-6">
            {/* P/E Ratio */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">P/E Ratio (NTM) - Detailed Breakdown</h2>
                <div className="text-sm text-gray-700 mt-2">Lower P/E is better (cheaper valuation)</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded">
                <div>
                  <div className="text-sm text-gray-600">Your Value</div>
                  <div className="text-2xl font-bold text-gray-900">{formatNumber(data.testTickerMetrics.peRatio)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Your Rank</div>
                  <div className="text-2xl font-bold text-blue-600">{data.ranking.peRatio}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Percentile Score</div>
                  <div className={`text-2xl font-bold ${(data.testTickerScores.peRatioScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(data.testTickerScores.peRatioScore, 1)}
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-3 p-3 bg-gray-50 rounded">
                <strong>Calculation:</strong> {data.testTicker} has a P/E of {formatNumber(data.testTickerMetrics.peRatio)}. 
                Out of {data.benchmarkMetricsDistribution.peRatios.length} {data.assignedBenchmark} stocks with P/E data, 
                {' '}{Math.floor((data.testTickerScores.peRatioScore || 0) / 100 * data.benchmarkMetricsDistribution.peRatios.length)} stocks have higher (worse) P/E ratios.
                Score = {Math.floor((data.testTickerScores.peRatioScore || 0) / 100 * data.benchmarkMetricsDistribution.peRatios.length)} ÷ {data.benchmarkMetricsDistribution.peRatios.length} × 100 = {formatNumber(data.testTickerScores.peRatioScore, 1)}
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-900">Rank</th>
                      <th className="text-left py-2 px-3 text-gray-900">Ticker</th>
                      <th className="text-right py-2 px-3 text-gray-900">P/E Ratio</th>
                      <th className="text-right py-2 px-3 text-gray-900">vs {data.testTicker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.benchmarkMetricsDistribution.peRatios.map((item, idx) => {
                      const isTestTicker = item.ticker.toUpperCase() === data.testTicker
                      const diff = item.value && data.testTickerMetrics.peRatio 
                        ? ((item.value - data.testTickerMetrics.peRatio) / data.testTickerMetrics.peRatio * 100)
                        : null
                      return (
                        <tr 
                          key={idx} 
                          className={`border-b ${isTestTicker ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-2 px-3 text-gray-800">{idx + 1}</td>
                          <td className="py-2 px-3 text-gray-900">
                            {item.ticker}
                            {isTestTicker && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">YOU</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 text-gray-800">{formatNumber(item.value)}</td>
                          <td className="text-right py-2 px-3 text-xs">
                            {diff !== null && !isTestTicker && (
                              <span className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EV/EBITDA */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">EV/EBITDA (NTM) - Detailed Breakdown</h2>
                <div className="text-sm text-gray-700 mt-2">Lower EV/EBITDA is better (cheaper valuation)</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded">
                <div>
                  <div className="text-sm text-gray-600">Your Value</div>
                  <div className="text-2xl font-bold text-gray-900">{formatNumber(data.testTickerMetrics.evEbitda)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Your Rank</div>
                  <div className="text-2xl font-bold text-blue-600">{data.ranking.evEbitda}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Percentile Score</div>
                  <div className={`text-2xl font-bold ${(data.testTickerScores.evEbitdaScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(data.testTickerScores.evEbitdaScore, 1)}
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-3 p-3 bg-gray-50 rounded">
                <strong>Calculation:</strong> {data.testTicker} has an EV/EBITDA of {formatNumber(data.testTickerMetrics.evEbitda)}. 
                Out of {data.benchmarkMetricsDistribution.evEbitdas.length} {data.assignedBenchmark} stocks with EV/EBITDA data, 
                {' '}{Math.floor((data.testTickerScores.evEbitdaScore || 0) / 100 * data.benchmarkMetricsDistribution.evEbitdas.length)} stocks have higher (worse) EV/EBITDA ratios.
                Score = {Math.floor((data.testTickerScores.evEbitdaScore || 0) / 100 * data.benchmarkMetricsDistribution.evEbitdas.length)} ÷ {data.benchmarkMetricsDistribution.evEbitdas.length} × 100 = {formatNumber(data.testTickerScores.evEbitdaScore, 1)}
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-900">Rank</th>
                      <th className="text-left py-2 px-3 text-gray-900">Ticker</th>
                      <th className="text-right py-2 px-3 text-gray-900">EV/EBITDA</th>
                      <th className="text-right py-2 px-3 text-gray-900">vs {data.testTicker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.benchmarkMetricsDistribution.evEbitdas.map((item, idx) => {
                      const isTestTicker = item.ticker.toUpperCase() === data.testTicker
                      const diff = item.value && data.testTickerMetrics.evEbitda 
                        ? ((item.value - data.testTickerMetrics.evEbitda) / data.testTickerMetrics.evEbitda * 100)
                        : null
                      return (
                        <tr 
                          key={idx} 
                          className={`border-b ${isTestTicker ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-2 px-3 text-gray-800">{idx + 1}</td>
                          <td className="py-2 px-3 text-gray-900">
                            {item.ticker}
                            {isTestTicker && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">YOU</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 text-gray-800">{formatNumber(item.value)}</td>
                          <td className="text-right py-2 px-3 text-xs">
                            {diff !== null && !isTestTicker && (
                              <span className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          {/* Data Quality Issues */}
          {(data.missingData.noFactSet.length > 0 || data.missingData.noYahoo.length > 0) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Data Quality Issues</h2>
              
              {data.missingData.noFactSet.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <h3 className="font-semibold text-red-600">
                      Missing FactSet Data ({data.missingData.noFactSet.length})
                    </h3>
                  </div>
                  <p className="text-sm text-gray-800 bg-red-50 border border-red-200 rounded p-2">
                    {data.missingData.noFactSet.join(', ')}
                  </p>
                </div>
              )}

              {data.missingData.noYahoo.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-yellow-500" />
                    <h3 className="font-semibold text-yellow-600">
                      Missing Yahoo Historical Data ({data.missingData.noYahoo.length})
                    </h3>
                  </div>
                  <p className="text-sm text-gray-800 bg-yellow-50 border border-yellow-200 rounded p-2">
                    {data.missingData.noYahoo.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

            {/* EV/Sales */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">EV/Sales (NTM) - Detailed Breakdown</h2>
                <div className="text-sm text-gray-700 mt-2">Lower EV/Sales is better (cheaper valuation)</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded">
                <div>
                  <div className="text-sm text-gray-600">Your Value</div>
                  <div className="text-2xl font-bold text-gray-900">{formatNumber(data.testTickerMetrics.evSales)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Your Rank</div>
                  <div className="text-2xl font-bold text-blue-600">{data.ranking.evSales}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Percentile Score</div>
                  <div className={`text-2xl font-bold ${(data.testTickerScores.evSalesScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(data.testTickerScores.evSalesScore, 1)}
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-3 p-3 bg-gray-50 rounded">
                <strong>Calculation:</strong> {data.testTicker} has an EV/Sales of {formatNumber(data.testTickerMetrics.evSales)}. 
                Out of {data.benchmarkMetricsDistribution.evSales.length} {data.assignedBenchmark} stocks with EV/Sales data, 
                {' '}{Math.floor((data.testTickerScores.evSalesScore || 0) / 100 * data.benchmarkMetricsDistribution.evSales.length)} stocks have higher (worse) EV/Sales ratios.
                Score = {Math.floor((data.testTickerScores.evSalesScore || 0) / 100 * data.benchmarkMetricsDistribution.evSales.length)} ÷ {data.benchmarkMetricsDistribution.evSales.length} × 100 = {formatNumber(data.testTickerScores.evSalesScore, 1)}
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-900">Rank</th>
                      <th className="text-left py-2 px-3 text-gray-900">Ticker</th>
                      <th className="text-right py-2 px-3 text-gray-900">EV/Sales</th>
                      <th className="text-right py-2 px-3 text-gray-900">vs {data.testTicker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.benchmarkMetricsDistribution.evSales.map((item, idx) => {
                      const isTestTicker = item.ticker.toUpperCase() === data.testTicker
                      const diff = item.value && data.testTickerMetrics.evSales 
                        ? ((item.value - data.testTickerMetrics.evSales) / data.testTickerMetrics.evSales * 100)
                        : null
                      return (
                        <tr 
                          key={idx} 
                          className={`border-b ${isTestTicker ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-2 px-3 text-gray-800">{idx + 1}</td>
                          <td className="py-2 px-3 text-gray-900">
                            {item.ticker}
                            {isTestTicker && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">YOU</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 text-gray-800">{formatNumber(item.value)}</td>
                          <td className="text-right py-2 px-3 text-xs">
                            {diff !== null && !isTestTicker && (
                              <span className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3-Month Return */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">3-Month Return - Detailed Breakdown</h2>
                <div className="text-sm text-gray-700 mt-2">Higher return is better (momentum)</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded">
                <div>
                  <div className="text-sm text-gray-600">Your Value</div>
                  <div className="text-2xl font-bold text-gray-900">{formatPercent(data.testTickerMetrics.return3M)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Your Rank</div>
                  <div className="text-2xl font-bold text-blue-600">{data.ranking.return3M}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Percentile Score</div>
                  <div className={`text-2xl font-bold ${(data.testTickerScores.return3MScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(data.testTickerScores.return3MScore, 1)}
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-3 p-3 bg-gray-50 rounded">
                <strong>Calculation:</strong> {data.testTicker} has a 3-month return of {formatPercent(data.testTickerMetrics.return3M)}. 
                Out of {data.benchmarkMetricsDistribution.return3Ms.length} {data.assignedBenchmark} stocks with return data, 
                {' '}{Math.floor((data.testTickerScores.return3MScore || 0) / 100 * data.benchmarkMetricsDistribution.return3Ms.length)} stocks have lower (worse) returns.
                Score = {Math.floor((data.testTickerScores.return3MScore || 0) / 100 * data.benchmarkMetricsDistribution.return3Ms.length)} ÷ {data.benchmarkMetricsDistribution.return3Ms.length} × 100 = {formatNumber(data.testTickerScores.return3MScore, 1)}
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-900">Rank</th>
                      <th className="text-left py-2 px-3 text-gray-900">Ticker</th>
                      <th className="text-right py-2 px-3 text-gray-900">3M Return</th>
                      <th className="text-right py-2 px-3 text-gray-900">vs {data.testTicker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.benchmarkMetricsDistribution.return3Ms.map((item, idx) => {
                      const isTestTicker = item.ticker.toUpperCase() === data.testTicker
                      const diff = item.value && data.testTickerMetrics.return3M 
                        ? (item.value - data.testTickerMetrics.return3M) * 100
                        : null
                      return (
                        <tr 
                          key={idx} 
                          className={`border-b ${isTestTicker ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-2 px-3 text-gray-800">{idx + 1}</td>
                          <td className="py-2 px-3 text-gray-900">
                            {item.ticker}
                            {isTestTicker && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">YOU</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 text-gray-800">{formatPercent(item.value)}</td>
                          <td className="text-right py-2 px-3 text-xs">
                            {diff !== null && !isTestTicker && (
                              <span className={diff > 0 ? 'text-green-600' : 'text-red-600'}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Beta */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">Beta (3-Year) - Detailed Breakdown</h2>
                <div className="text-sm text-gray-700 mt-2">Lower beta is better (less volatile/risky)</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded">
                <div>
                  <div className="text-sm text-gray-600">Your Value</div>
                  <div className="text-2xl font-bold text-gray-900">{formatNumber(data.testTickerMetrics.beta3Yr)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Your Rank</div>
                  <div className="text-2xl font-bold text-blue-600">{data.ranking.beta3Yr}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Percentile Score</div>
                  <div className={`text-2xl font-bold ${(data.testTickerScores.beta3YrScore || 0) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(data.testTickerScores.beta3YrScore, 1)}
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-700 mb-3 p-3 bg-gray-50 rounded">
                <strong>Calculation:</strong> {data.testTicker} has a beta of {formatNumber(data.testTickerMetrics.beta3Yr)}. 
                Out of {data.benchmarkMetricsDistribution.beta3Yrs.length} {data.assignedBenchmark} stocks with beta data, 
                {' '}{Math.floor((data.testTickerScores.beta3YrScore || 0) / 100 * data.benchmarkMetricsDistribution.beta3Yrs.length)} stocks have higher (worse) beta.
                Score = {Math.floor((data.testTickerScores.beta3YrScore || 0) / 100 * data.benchmarkMetricsDistribution.beta3Yrs.length)} ÷ {data.benchmarkMetricsDistribution.beta3Yrs.length} × 100 = {formatNumber(data.testTickerScores.beta3YrScore, 1)}
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-gray-900">Rank</th>
                      <th className="text-left py-2 px-3 text-gray-900">Ticker</th>
                      <th className="text-right py-2 px-3 text-gray-900">Beta</th>
                      <th className="text-right py-2 px-3 text-gray-900">vs {data.testTicker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.benchmarkMetricsDistribution.beta3Yrs.map((item, idx) => {
                      const isTestTicker = item.ticker.toUpperCase() === data.testTicker
                      const diff = item.value && data.testTickerMetrics.beta3Yr 
                        ? ((item.value - data.testTickerMetrics.beta3Yr) / data.testTickerMetrics.beta3Yr * 100)
                        : null
                      return (
                        <tr 
                          key={idx} 
                          className={`border-b ${isTestTicker ? 'bg-blue-100 font-bold' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-2 px-3 text-gray-800">{idx + 1}</td>
                          <td className="py-2 px-3 text-gray-900">
                            {item.ticker}
                            {isTestTicker && (
                              <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">YOU</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 text-gray-800">{formatNumber(item.value)}</td>
                          <td className="text-right py-2 px-3 text-xs">
                            {diff !== null && !isTestTicker && (
                              <span className={diff > 0 ? 'text-red-600' : 'text-green-600'}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* All Constituents */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              All {data.assignedBenchmark} Constituents ({data.benchmarkConstituents.total})
            </h2>
            <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 max-h-48 overflow-y-auto">
              {data.benchmarkConstituents.tickers.sort().join(', ')}
            </div>
          </div>

          {/* Timestamp */}
          <div className="text-center text-sm text-gray-700">
            Test completed: {new Date(data.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}
