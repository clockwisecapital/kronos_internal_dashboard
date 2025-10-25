'use client'

import { useState } from 'react'

export default function RiskPage() {
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

  const riskMetrics = [
    { label: 'Sharpe Ratio', value: '0.67', description: 'Risk-adjusted return' },
    { label: 'Annualized Volatility', value: '55.69%', description: 'Standard deviation' },
    { label: 'VaR 95%', value: '-3.41%', description: 'Value at Risk' },
    { label: 'Max Drawdown', value: '-12.5%', description: 'Largest decline' },
  ]

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
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Risk Assessment
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Portfolio risk metrics, market conditions, and stock scoring system
        </p>
      </div>

      {/* Top Section: Risk Metrics + VIX + Market Downside */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Metrics */}
        <div className="lg:col-span-4 space-y-4">
          {riskMetrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
            >
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                {metric.label}
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                {metric.value}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                {metric.description}
              </p>
            </div>
          ))}
        </div>

        {/* VIX Indicator + Market Downside */}
        <div className="lg:col-span-8 space-y-6">
          {/* VIX Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">
              VIX Fear Index
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-zinc-900 dark:text-white">
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
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Market Downside
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Distance from moving averages
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      Index
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      9D MA
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      50D MA
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      100D MA
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      200D MA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {marketDownside.map((row) => (
                    <tr
                      key={row.index}
                      className="border-b border-zinc-100 dark:border-zinc-800/50"
                    >
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white">
                        {row.index}
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma9d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {row.ma9d > 0 ? '+' : ''}{row.ma9d.toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma50d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {row.ma50d > 0 ? '+' : ''}{row.ma50d.toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma100d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {row.ma100d > 0 ? '+' : ''}{row.ma100d.toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 px-4 ${row.ma200d >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Stock Scoring Calculator
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Enter 22 metrics across 4 categories to calculate composite score
          </p>
        </div>

        {/* Ticker Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Ticker Symbol
          </label>
          <input
            type="text"
            value={scoreInputs.ticker}
            onChange={(e) => setScoreInputs({ ...scoreInputs, ticker: e.target.value.toUpperCase() })}
            placeholder="AAPL"
            className="w-full max-w-xs px-4 py-2 border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Valuation Section */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-zinc-900 dark:text-white mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            Valuation (40% weight)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                P/E Ratio
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                EV/EBITDA
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                EV/Sales
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Base Upside %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Optionality Upside %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Momentum Section */}
        <div className="mb-6">
          <h3 className="text-md font-semibold text-zinc-900 dark:text-white mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            Momentum (30% weight)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                12M Return (ex 1M) %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                3M Return %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                52W High %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                EPS Surprise %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Revenue Surprise %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                NTM EPS Change %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                NTM Rev Change %
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                className="w-full px-3 py-2 text-sm border-2 border-cyan-400 dark:border-cyan-500 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Calculate Button and Result */}
        <div className="flex items-center justify-between pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
            Calculate Score
          </button>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-6 py-4 border-2 border-orange-400 dark:border-orange-500">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Total Score</p>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
              --<span className="text-lg text-zinc-500">/100</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
