'use client'

import { useState, useEffect } from 'react'

interface TimePlusModel {
  id: string
  model_name: string
  risk_level: string
  description: string
  expected_return_low: number
  expected_return_high: number
  time_horizon_years: number
  beta: number
  display_order: number
  top_holdings: Array<{
    ticker: string
    weight: number
  }>
}

interface AllocationRecord {
  ticker: string
  asset_class: string
  sector: string
  max_growth: number
  growth: number
  moderate: number
  max_income: number
}

export default function TimePlusPage() {
  const [models, setModels] = useState<TimePlusModel[]>([])
  const [allocations, setAllocations] = useState<AllocationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch models
        const modelsResponse = await fetch('/api/timeplus/models')
        const modelsJson = await modelsResponse.json()
        
        if (!modelsJson.success) {
          throw new Error(modelsJson.message || 'Failed to fetch models')
        }
        
        // Fetch allocations
        const allocationsResponse = await fetch('/api/timeplus/allocations')
        const allocationsJson = await allocationsResponse.json()
        
        if (!allocationsJson.success) {
          throw new Error(allocationsJson.message || 'Failed to fetch allocations')
        }
        
        setModels(modelsJson.data)
        setAllocations(allocationsJson.data)
        
      } catch (err) {
        console.error('Error fetching TIME+ data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-slate-700 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-slate-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading TIME+ Data</h2>
          <p className="text-red-300">{error}</p>
          <p className="text-sm text-slate-400 mt-4">
            Please ensure database migrations are applied and model_portfolios.csv is uploaded.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          TIME+ Model Portfolios
        </h1>
        <p className="text-slate-400 mt-1">
          Pre-built allocation models for different risk profiles
        </p>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {models.map((model) => (
          <div
            key={model.id}
            className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg hover:shadow-xl transition-shadow"
          >
            {/* Model Name */}
            <h3 className="text-xl font-bold text-white mb-2">
              {model.model_name}
            </h3>
            
            {/* Risk Badge */}
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
              model.risk_level === 'High' ? 'bg-red-900/30 text-red-400 border border-red-800' :
              model.risk_level === 'Moderate-High' ? 'bg-orange-900/30 text-orange-400 border border-orange-800' :
              model.risk_level === 'Moderate' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' :
              'bg-green-900/30 text-green-400 border border-green-800'
            }`}>
              {model.risk_level} Risk
            </div>

            {/* Expected Return */}
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-1">Expected Return</p>
              <p className="text-2xl font-bold text-white">
                {model.expected_return_low}% - {model.expected_return_high}%
              </p>
            </div>

            {/* Beta */}
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-1">Beta</p>
              <p className="text-xl font-semibold text-white">{model.beta.toFixed(2)}</p>
            </div>

            {/* Time Horizon */}
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-1">Time Horizon</p>
              <p className="text-lg font-medium text-white">{model.time_horizon_years} years</p>
            </div>

            {/* Top Holdings */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-sm font-semibold text-slate-400 mb-2">Top Holdings</p>
              <div className="space-y-2">
                {model.top_holdings.slice(0, 3).map((holding, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white">{holding.ticker}</span>
                    <span className="text-sm text-slate-400">{holding.weight.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk-Return Scatter Plot */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6">Risk vs. Return</h2>
        
        <div className="relative" style={{ height: '400px' }}>
          <svg width="100%" height="100%" viewBox="0 0 800 400" className="overflow-visible">
            {/* Axes */}
            <line x1="80" y1="350" x2="750" y2="350" stroke="#475569" strokeWidth="2" />
            <line x1="80" y1="50" x2="80" y2="350" stroke="#475569" strokeWidth="2" />
            
            {/* X-axis label */}
            <text x="400" y="390" textAnchor="middle" fill="#94a3b8" fontSize="14">
              Risk (Beta)
            </text>
            
            {/* Y-axis label */}
            <text x="40" y="200" textAnchor="middle" fill="#94a3b8" fontSize="14" transform="rotate(-90 40 200)">
              Expected Return (%)
            </text>
            
            {/* Grid lines and labels */}
            {[0.5, 0.75, 1.0, 1.25, 1.5].map((beta, idx) => (
              <g key={`x-${idx}`}>
                <line 
                  x1={80 + (beta - 0.5) * 600} 
                  y1="350" 
                  x2={80 + (beta - 0.5) * 600} 
                  y2="355" 
                  stroke="#475569" 
                  strokeWidth="1" 
                />
                <text 
                  x={80 + (beta - 0.5) * 600} 
                  y="370" 
                  textAnchor="middle" 
                  fill="#94a3b8" 
                  fontSize="12"
                >
                  {beta.toFixed(2)}
                </text>
              </g>
            ))}
            
            {[5, 7.5, 10, 12.5, 15].map((ret, idx) => (
              <g key={`y-${idx}`}>
                <line 
                  x1="75" 
                  y1={350 - (ret - 5) * 30} 
                  x2="80" 
                  y2={350 - (ret - 5) * 30} 
                  stroke="#475569" 
                  strokeWidth="1" 
                />
                <text 
                  x="60" 
                  y={350 - (ret - 5) * 30 + 5} 
                  textAnchor="end" 
                  fill="#94a3b8" 
                  fontSize="12"
                >
                  {ret}%
                </text>
              </g>
            ))}
            
            {/* Plot points */}
            {models.map((model, idx) => {
              const avgReturn = (model.expected_return_low + model.expected_return_high) / 2
              const x = 80 + (model.beta - 0.5) * 600
              const y = 350 - (avgReturn - 5) * 30
              
              const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
              
              return (
                <g key={model.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r="8"
                    fill={colors[idx]}
                    stroke="#1e293b"
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={y - 15}
                    textAnchor="middle"
                    fill="#f8fafc"
                    fontSize="12"
                    fontWeight="600"
                  >
                    {model.model_name}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Complete Allocations</h2>
          <p className="text-sm text-slate-400 mt-1">
            Target weights across all model portfolios
          </p>
        </div>
        
        <div className="overflow-x-auto max-h-[800px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 sticky top-0 z-10">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Ticker</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-300">Asset Class</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">Max Growth</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">Growth</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">Moderate</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-300">Max Income</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="py-4 px-6 font-semibold text-white">{row.ticker}</td>
                  <td className="py-4 px-6 text-slate-400 text-sm">{row.asset_class}</td>
                  <td className="text-right py-4 px-6 text-white font-medium">
                    {row.max_growth > 0 ? `${row.max_growth.toFixed(1)}%` : '-'}
                  </td>
                  <td className="text-right py-4 px-6 text-white font-medium">
                    {row.growth > 0 ? `${row.growth.toFixed(1)}%` : '-'}
                  </td>
                  <td className="text-right py-4 px-6 text-white font-medium">
                    {row.moderate > 0 ? `${row.moderate.toFixed(1)}%` : '-'}
                  </td>
                  <td className="text-right py-4 px-6 text-white font-medium">
                    {row.max_income > 0 ? `${row.max_income.toFixed(1)}%` : '-'}
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
