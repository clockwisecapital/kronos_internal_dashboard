'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react'

interface PeerVerification {
  ticker: string
  assignedBenchmark: string | null
  benchmarkName: string
  constituentCount: number
  samplePeers: string[]
  isAppropriate: 'YES' | 'NO' | 'UNKNOWN'
  reasoning: string
}

interface VerificationData {
  success: boolean
  timestamp: string
  benchmark: string
  verifications: PeerVerification[]
}

export default function VerifyPeersPage() {
  const [benchmark, setBenchmark] = useState<'BENCHMARK1' | 'BENCHMARK2' | 'BENCHMARK3' | 'BENCHMARK_CUSTOM'>('BENCHMARK1')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<VerificationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchVerification = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/scoring/verify-peers?benchmark=${benchmark}`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to verify peers')
      }
      
      setData(result)
    } catch (err) {
      console.error('Error fetching verification:', err)
      setError(err instanceof Error ? err.message : 'Failed to load verification')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVerification()
  }, [benchmark])

  const getAppropriateIcon = (isAppropriate: 'YES' | 'NO' | 'UNKNOWN') => {
    switch (isAppropriate) {
      case 'YES':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'NO':
        return <XCircle className="w-6 h-6 text-red-500" />
      case 'UNKNOWN':
        return <HelpCircle className="w-6 h-6 text-yellow-500" />
    }
  }

  const getAppropriateColor = (isAppropriate: 'YES' | 'NO' | 'UNKNOWN') => {
    switch (isAppropriate) {
      case 'YES':
        return 'bg-green-50 border-green-200'
      case 'NO':
        return 'bg-red-50 border-red-200'
      case 'UNKNOWN':
        return 'bg-yellow-50 border-yellow-200'
    }
  }

  // Group by benchmark
  const groupedVerifications = data?.verifications.reduce((acc, v) => {
    const key = v.assignedBenchmark || 'NO_BENCHMARK'
    if (!acc[key]) acc[key] = []
    acc[key].push(v)
    return acc
  }, {} as Record<string, PeerVerification[]>)

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Verify Peer Comparisons</h1>
        <p className="text-gray-700">Check if your holdings are being compared against the right peer groups</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 items-center">
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
            onClick={fetchVerification}
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
          <p className="mt-2 text-gray-800">Verifying peer comparisons...</p>
        </div>
      )}

      {data && !loading && groupedVerifications && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {data.verifications.filter(v => v.isAppropriate === 'YES').length}
                </div>
                <div className="text-sm text-gray-700">Appropriate Peers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {data.verifications.filter(v => v.isAppropriate === 'UNKNOWN').length}
                </div>
                <div className="text-sm text-gray-700">Unknown / No Benchmark</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {data.verifications.filter(v => v.isAppropriate === 'NO').length}
                </div>
                <div className="text-sm text-gray-700">Inappropriate Peers</div>
              </div>
            </div>
          </div>

          {/* Grouped by Benchmark */}
          {Object.entries(groupedVerifications).map(([benchmarkKey, verifications]) => {
            const firstItem = verifications[0]
            const isNoBenchmark = benchmarkKey === 'NO_BENCHMARK'
            
            return (
              <div key={benchmarkKey} className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {isNoBenchmark ? 'No Benchmark Assigned' : benchmarkKey.toUpperCase()}
                  </h2>
                  {!isNoBenchmark && (
                    <p className="text-sm text-gray-700">
                      {firstItem.benchmarkName} • {firstItem.constituentCount} constituents
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    {verifications.length} {verifications.length === 1 ? 'holding' : 'holdings'}
                  </p>
                </div>

                <div className="space-y-3">
                  {verifications.map((v, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 ${getAppropriateColor(v.isAppropriate)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getAppropriateIcon(v.isAppropriate)}
                        <div className="flex-1">
                          <div className="font-bold text-lg mb-1 text-gray-900">{v.ticker}</div>
                          <p className="text-sm text-gray-800 mb-2">{v.reasoning}</p>
                          
                          {v.samplePeers.length > 0 && (
                            <div className="text-xs text-gray-800 bg-white rounded p-2 border border-gray-200">
                              <span className="font-medium">Sample peers: </span>
                              {v.samplePeers.slice(0, 15).join(', ')}
                              {v.samplePeers.length > 15 && ` ... and ${v.samplePeers.length - 15} more`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Timestamp */}
          <div className="text-center text-sm text-gray-700">
            Last verified: {new Date(data.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}
