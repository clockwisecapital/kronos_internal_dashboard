export default function PortfolioPage() {
  // Mock data - will be replaced with real API calls
  const nav = 19067048
  const performanceData = [
    { name: 'TIME', daily: 0.8, wtd: 2.1, mtd: 5.4, ytd: 12.3 },
    { name: 'SPY', daily: 0.6, wtd: 1.8, mtd: 4.2, ytd: 10.1 },
    { name: 'QQQ', daily: 0.9, wtd: 2.3, mtd: 6.1, ytd: 14.5 },
    { name: 'DIA', daily: 0.5, wtd: 1.5, mtd: 3.8, ytd: 8.7 },
    { name: 'IWM', daily: 0.4, wtd: 1.2, mtd: 2.9, ytd: 6.2 },
    { name: 'SMH', daily: 1.2, wtd: 3.1, mtd: 8.2, ytd: 18.9 },
  ]

  const keyMetrics = [
    { label: 'Total Cash', value: '1.00%' },
    { label: 'Clockwise Beta', value: '0.91x' },
    { label: 'Beta Report 3-Yr', value: '0.79x' },
    { label: 'Effective Hedge', value: '23.9%' },
    { label: 'Crypto Exposure', value: '6.8%' },
  ]

  const holdings = [
    { ticker: 'NVDA', weight: 8.1 },
    { ticker: 'AAPL', weight: 7.2 },
    { ticker: 'MSFT', weight: 6.8 },
    { ticker: 'TSLA', weight: 5.4 },
    { ticker: 'META', weight: 4.9 },
    { ticker: 'AMZN', weight: 4.5 },
    { ticker: 'GOOGL', weight: 4.2 },
    { ticker: 'NEM', weight: 4.2 },
    { ticker: 'STRF', weight: 3.8 },
    { ticker: 'UNH', weight: 3.5 },
    { ticker: 'JPM', weight: 3.2 },
    { ticker: 'V', weight: 3.0 },
    { ticker: 'BRK.B', weight: 2.8 },
    { ticker: 'JNJ', weight: 2.5 },
    { ticker: 'PG', weight: 2.3 },
    { ticker: 'DIS', weight: 2.1 },
    { ticker: 'NFLX', weight: 2.0 },
    { ticker: 'ADBE', weight: 1.9 },
    { ticker: 'CRM', weight: 1.8 },
    { ticker: 'INTC', weight: 1.7 },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
          Portfolio Overview
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Current portfolio holdings and performance metrics
        </p>
      </div>

      {/* Top Section: NAV + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* NAV Card */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 h-full flex flex-col justify-center">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              Net Asset Value
            </p>
            <p className="text-4xl font-bold text-zinc-900 dark:text-white">
              ${nav.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Performance Grid */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 overflow-x-auto">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4">
              Performance Metrics
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    Index
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    Daily
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    WTD
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    MTD
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-900 dark:text-white">
                    YTD
                  </th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((row, idx) => (
                  <tr
                    key={row.name}
                    className={`${
                      idx === 0 ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    } border-b border-zinc-100 dark:border-zinc-800/50`}
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white">
                      {row.name}
                    </td>
                    <td className={`text-right py-3 px-4 ${row.daily >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.daily > 0 ? '+' : ''}{row.daily.toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 ${row.wtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.wtd > 0 ? '+' : ''}{row.wtd.toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 ${row.mtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.mtd > 0 ? '+' : ''}{row.mtd.toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 ${row.ytd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.ytd > 0 ? '+' : ''}{row.ytd.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {keyMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
          >
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              {metric.label}
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Holdings Grid */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
          Current Holdings
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {holdings.map((holding) => (
            <div
              key={holding.ticker}
              className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
            >
              <p className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">
                {holding.ticker}
              </p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {holding.weight.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
