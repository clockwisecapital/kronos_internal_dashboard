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
    <header className="h-20 bg-slate-800 border-b border-slate-700 px-6 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/50">
          <span className="text-white font-bold text-xl">C</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Clockwise Capital
          </h1>
          <p className="text-xs text-slate-400">
            Internal Dashboard
          </p>
        </div>
      </div>

      {/* Last Updated */}
      <div className="flex items-center gap-6">
        <div className="text-sm text-slate-300">
          <span className="font-medium">Last Updated:</span>{' '}
          <span className="text-white">{lastUpdated || 'Loading...'}</span>
        </div>

        {/* User Menu */}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Logout
          </button>
        </form>
      </div>
    </header>
  )
}
