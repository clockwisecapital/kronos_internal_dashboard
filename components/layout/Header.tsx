'use client'

import { useState, useEffect } from 'react'

export default function Header() {
  const [lastUpdated, setLastUpdated] = useState<string>('')

  useEffect(() => {
    // Set initial time
    const updateTime = () => {
      const now = new Date()
      const formatted = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      setLastUpdated(formatted)
    }
    
    updateTime()
    // Update every minute
    const interval = setInterval(updateTime, 60000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-20 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xl">C</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
            Clockwise Capital
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Internal Dashboard
          </p>
        </div>
      </div>

      {/* Last Updated */}
      <div className="flex items-center gap-6">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium">Last Updated:</span>{' '}
          <span className="text-zinc-900 dark:text-white">{lastUpdated || 'Loading...'}</span>
        </div>

        {/* User Menu */}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  )
}
