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
    <nav className="h-15 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
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
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700'
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
