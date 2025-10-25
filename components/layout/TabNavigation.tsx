'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { name: 'Data Upload', path: '/data-upload' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Performance', path: '/performance' },
  { name: 'Risk', path: '/risk' },
  { name: 'Sectors', path: '/sectors' },
  { name: 'Cycle', path: '/cycle' },
  { name: 'Market', path: '/market' },
  { name: 'TIME+', path: '/timeplus' },
  { name: 'Cycles', path: '/cycles' },
  { name: 'Scenarios', path: '/scenarios' },
  { name: 'Trading', path: '/trading' },
  { name: 'Exposure', path: '/exposure' },
  { name: 'Holdings', path: '/holdings' },
  { name: 'Scoring', path: '/scoring' },
]

export default function TabNavigation() {
  const pathname = usePathname()

  return (
    <nav className="h-15 bg-slate-800 border-b border-slate-700 overflow-x-auto">
      <div className="flex items-center h-full px-6">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`
                px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                border-b-2 -mb-px
                ${
                  isActive
                    ? 'border-blue-500 text-blue-400 bg-slate-700/50'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-700/30 hover:border-slate-600'
                }
              `}
            >
              {tab.name}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
