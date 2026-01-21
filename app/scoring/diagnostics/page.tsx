'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'

interface DiagnosticData {
  success: boolean
  timestamp: string
  profile: string
  benchmark: string
  summary: {
    totalHoldings: number
    holdingsWithFactSet: number
    holdingsWithYahoo: number
    holdingsWithBenchmark: number
    holdingsWithCompleteData: number
  }
  missingData: {
    noFactSet: string[]
    noYahoo: string[]
    noBenchmark: string[]
    nullValueScores: Array<{
      ticker: string
      reason: string
      missingMetrics: string[]
    }>
  }
  benchmarkAnalysis: Array<{
    benchmark: string
    constituentCount: number
    holdingsCount: number
    tickers: string[]
    status: 'OK' | 'WARNING' | 'ERROR'
    message: string
  }>
  weightingsAnalysis: {
    totalWeightings: number
    profileExists: boolean
    categories: Array<{
      category: string
      categoryWeight: number
      metrics: Array<{
        name: string
        weight: number
      }>
    }>
  }
  dataQualityIssues: Array<{
    ticker: string
    severity: 'ERROR' | 'WARNING' | 'INFO'
    category: string
    issue: string
    impact: string
  }>
}

export default function ScoringDiagnosticsPage() {
  const [profile, setProfile] = useState<'BASE' | 'CAUTIOUS' | 'AGGRESSIVE'>('BASE')
  const [benchmark, setBenchmark] = useState<'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3' | 'BENCHMARK_CUSTOM'>('BENCHMARK1')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DiagnosticData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchDiagnostics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/scoring/diagnostics?profile=${profile}&benchmark=${benchmark}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch diagnostics')
      }
      
      setData(result)
    } catch (err) {
      console.error('Error fetching diagnostics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiagnostics()
  }, [profile, benchmark])

  const getSeverityIcon = (severity: 'ERROR' | 'WARNING' | 'INFO') => {
    switch (severity) {
      case 'ERROR':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'INFO':
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getSeverityColor = (severity: 'ERROR' | 'WARNING' | 'INFO') => {
    switch (severity) {
      case 'ERROR':
        return 'bg-red-50 border-red-200'
      case 'WARNING':
        return 'bg-yellow-50 border-yellow-200'
      case 'INFO':
        return 'bg-blue-50 border-blue-200'
    }
  }

  const getStatusIcon = (status: 'OK' | 'WARNING' | 'ERROR') => {
    switch (status) {
      case 'OK':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'ERROR':
        return <AlertCircle className="w-5 h-5 text-red-500" />
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Scoring Diagnostics</h1>
        <p className="text-gray-700">Data quality analysis for scoring calculations</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium mb-1">Profile</label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as any)}
              className="border rounded px-3 py-2"
            >
              <option value="BASE">BASE</option>
              <option value="CAUTIOUS">CAUTIOUS</option>
              <option value="AGGRESSIVE">AGGRESSIVE</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Benchmark</label>
            <select
              value={benchmark}
              onChange={(e) => setBenchmark(e.target.value as any)}
              className="border rounded px-3 py-2"
            >
              <option value="BENCHMARK1">Benchmark 1</option>
              <option value="BENCHMARK2">Benchmark 2</option>
              <option value="BENCHMARK3">Benchmark 3</option>
              <option value="BENCHMARK_CUSTOM">Custom</option>
            </select>
          </div>

          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Refresh'}
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
          <p className="mt-2 text-gray-800">Running diagnostics...</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{data.summary.totalHoldings}</div>
                <div className="text-sm text-gray-700">Total Holdings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{data.summary.holdingsWithFactSet}</div>
                <div className="text-sm text-gray-700">With FactSet</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{data.summary.holdingsWithYahoo}</div>
                <div className="text-sm text-gray-700">With Yahoo</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{data.summary.holdingsWithBenchmark}</div>
                <div className="text-sm text-gray-700">With Benchmark</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{data.summary.holdingsWithCompleteData}</div>
                <div className="text-sm text-gray-700">Complete Data</div>
              </div>
            </div>
          </div>

          {/* Data Quality Issues */}
          {data.dataQualityIssues.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">
                Data Quality Issues ({data.dataQualityIssues.length})
              </h2>
              <div className="space-y-3">
                {data.dataQualityIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{issue.ticker}</span>
                          <span className="text-xs bg-white px-2 py-1 rounded border border-gray-300 text-gray-800">{issue.category}</span>
                        </div>
                        <p className="text-sm font-medium mb-1 text-gray-800">{issue.issue}</p>
                        <p className="text-xs text-gray-700">Impact: {issue.impact}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Benchmark Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Benchmark Analysis</h2>
            <div className="space-y-4">
              {data.benchmarkAnalysis.map((bench, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start gap-3 mb-3">
                    {getStatusIcon(bench.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-gray-900">{bench.benchmark}</span>
                        <span className="text-sm text-gray-700">
                          ({bench.constituentCount} constituents, {bench.holdingsCount} holdings)
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{bench.message}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-700">
                    <span className="font-medium">Holdings: </span>
                    {bench.tickers.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weightings Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Weightings Configuration ({profile})
            </h2>
            {!data.weightingsAnalysis.profileExists ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800 font-medium">
                  No weightings found for profile {profile}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.weightingsAnalysis.categories.map((cat, idx) => (
                  <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900">{cat.category}</h3>
                      <span className="text-sm bg-blue-100 px-2 py-1 rounded text-gray-900">
                        Weight: {cat.categoryWeight}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {cat.metrics.map((metric, mIdx) => (
                        <div key={mIdx} className="flex justify-between text-sm">
                          <span className="text-gray-800">{metric.name}</span>
                          <span className="font-medium text-gray-900">{metric.weight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missing Data Details */}
          {(data.missingData.noFactSet.length > 0 || 
            data.missingData.noBenchmark.length > 0 || 
            data.missingData.nullValueScores.length > 0) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Missing Data Details</h2>
              
              {data.missingData.noFactSet.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-red-600 mb-2">
                    No FactSet Data ({data.missingData.noFactSet.length})
                  </h3>
                  <p className="text-sm text-gray-800 mb-2">
                    {data.missingData.noFactSet.join(', ')}
                  </p>
                </div>
              )}

              {data.missingData.noBenchmark.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-yellow-600 mb-2">
                    No Benchmark Assignment ({data.missingData.noBenchmark.length})
                  </h3>
                  <p className="text-sm text-gray-800 mb-2">
                    {data.missingData.noBenchmark.join(', ')}
                  </p>
                </div>
              )}

              {data.missingData.nullValueScores.length > 0 && (
                <div>
                  <h3 className="font-semibold text-yellow-600 mb-2">
                    Incomplete VALUE Metrics ({data.missingData.nullValueScores.length})
                  </h3>
                  <div className="space-y-2">
                    {data.missingData.nullValueScores.map((item, idx) => (
                      <div key={idx} className="text-sm bg-yellow-50 border border-yellow-200 rounded p-2">
                        <span className="font-medium text-gray-900">{item.ticker}:</span>{' '}
                        <span className="text-gray-800">{item.missingMetrics.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-center text-sm text-gray-700">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}
