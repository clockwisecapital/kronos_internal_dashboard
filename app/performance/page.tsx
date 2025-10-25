export default function PerformancePage() {
  // Mock data - will be replaced with real API calls
  const performanceData = [
    { ticker: 'NVDA', weight: 8.1, return1d: 2.3, return5d: 4.5, return30d: 12.1, returnYTD: 85.2 },
    { ticker: 'AAPL', weight: 7.2, return1d: 0.8, return5d: 2.1, return30d: 5.4, returnYTD: 28.3 },
    { ticker: 'MSFT', weight: 6.8, return1d: 1.1, return5d: 3.2, return30d: 7.8, returnYTD: 35.7 },
    { ticker: 'TSLA', weight: 5.4, return1d: -0.5, return5d: 1.8, return30d: 9.2, returnYTD: 42.1 },
    { ticker: 'META', weight: 4.9, return1d: 1.5, return5d: 4.8, return30d: 11.3, returnYTD: 68.9 },
    { ticker: 'AMZN', weight: 4.5, return1d: 0.9, return5d: 2.5, return30d: 6.8, returnYTD: 32.4 },
    { ticker: 'GOOGL', weight: 4.2, return1d: 1.2, return5d: 3.1, return30d: 8.1, returnYTD: 41.2 },
    { ticker: 'NEM', weight: 4.2, return1d: -1.1, return5d: -0.8, return30d: 3.2, returnYTD: 15.6 },
    { ticker: 'STRF', weight: 3.8, return1d: 0.5, return5d: 1.8, return30d: 4.5, returnYTD: 22.1 },
    { ticker: 'UNH', weight: 3.5, return1d: 0.7, return5d: 2.3, return30d: 5.9, returnYTD: 18.7 },
  ]

  // Calculate contributions (weight/100 * return)
  const contributionData = performanceData.map(stock => ({
    ticker: stock.ticker,
    contrib1d: (stock.weight / 100) * stock.return1d,
    contrib5d: (stock.weight / 100) * stock.return5d,
    contrib30d: (stock.weight / 100) * stock.return30d,
    contribYTD: (stock.weight / 100) * stock.returnYTD,
  }))

  // Calculate totals
  const totals = {
    contrib1d: contributionData.reduce((sum, c) => sum + c.contrib1d, 0),
    contrib5d: contributionData.reduce((sum, c) => sum + c.contrib5d, 0),
    contrib30d: contributionData.reduce((sum, c) => sum + c.contrib30d, 0),
    contribYTD: contributionData.reduce((sum, c) => sum + c.contribYTD, 0),
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Performance Attribution
        </h1>
        <p className="text-slate-400 mt-1">
          Individual holding performance and portfolio contribution analysis
        </p>
      </div>

      {/* Holdings Performance Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Holdings Performance
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Individual stock returns across different time periods
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700 border-b border-slate-600">
                <th className="text-left py-3 px-6 font-semibold text-white">
                  Ticker
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  Weight
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  1-Day
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  5-Day
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  30-Day
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  YTD
                </th>
              </tr>
            </thead>
            <tbody>
              {performanceData.map((stock) => (
                <tr
                  key={stock.ticker}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="py-4 px-6 font-semibold text-white">
                    {stock.ticker}
                  </td>
                  <td className="text-right py-4 px-6 text-slate-300">
                    {stock.weight.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return1d > 0 ? '+' : ''}{stock.return1d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return5d > 0 ? '+' : ''}{stock.return5d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.return30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.return30d > 0 ? '+' : ''}{stock.return30d.toFixed(1)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.returnYTD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.returnYTD > 0 ? '+' : ''}{stock.returnYTD.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contribution Breakdown Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Contribution Breakdown
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            How much each position contributed to total portfolio return
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700 border-b border-slate-600">
                <th className="text-left py-3 px-6 font-semibold text-white">
                  Ticker
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  1-Day Contrib.
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  5-Day Contrib.
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  30-Day Contrib.
                </th>
                <th className="text-right py-3 px-6 font-semibold text-white">
                  YTD Contribution
                </th>
              </tr>
            </thead>
            <tbody>
              {contributionData.map((stock) => (
                <tr
                  key={stock.ticker}
                  className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                >
                  <td className="py-4 px-6 font-semibold text-white">
                    {stock.ticker}
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.contrib1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contrib1d > 0 ? '+' : ''}{stock.contrib1d.toFixed(2)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.contrib5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contrib5d > 0 ? '+' : ''}{stock.contrib5d.toFixed(2)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.contrib30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contrib30d > 0 ? '+' : ''}{stock.contrib30d.toFixed(2)}%
                  </td>
                  <td className={`text-right py-4 px-6 font-medium ${stock.contribYTD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.contribYTD > 0 ? '+' : ''}{stock.contribYTD.toFixed(2)}%
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              <tr className="bg-blue-900/30 border-t-2 border-blue-700">
                <td className="py-4 px-6 font-bold text-white">
                  TOTAL PORTFOLIO
                </td>
                <td className={`text-right py-4 px-6 font-bold ${totals.contrib1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totals.contrib1d > 0 ? '+' : ''}{totals.contrib1d.toFixed(2)}%
                </td>
                <td className={`text-right py-4 px-6 font-bold ${totals.contrib5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totals.contrib5d > 0 ? '+' : ''}{totals.contrib5d.toFixed(2)}%
                </td>
                <td className={`text-right py-4 px-6 font-bold ${totals.contrib30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totals.contrib30d > 0 ? '+' : ''}{totals.contrib30d.toFixed(2)}%
                </td>
                <td className={`text-right py-4 px-6 font-bold ${totals.contribYTD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totals.contribYTD > 0 ? '+' : ''}{totals.contribYTD.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
