'use client'

import { useState } from 'react'

interface GoogleDriveSyncProps {
  onSyncComplete: (message: string) => void
  onSyncError: (error: string) => void
}

type SyncFileType = 'holdings' | 'weightings' | 'factset' | 'all'

interface FileSyncResult {
  file: string
  tab: string
  rowsProcessed: number
  status: 'success' | 'error'
  error?: string
}

interface GoogleSyncResponse {
  success: boolean
  synced: FileSyncResult[]
  timestamp: string
  message?: string
  error?: string
}

const SYNC_OPTIONS: { value: SyncFileType; label: string; description: string }[] = [
  { 
    value: 'holdings', 
    label: 'Holdings Only', 
    description: 'Daily portfolio positions' 
  },
  { 
    value: 'weightings', 
    label: 'Weightings Only', 
    description: 'ETF weight matrix (QQQ/SPY)' 
  },
  { 
    value: 'factset', 
    label: 'FactSet Only', 
    description: 'Betas, earnings, target prices (Coming Soon)' 
  },
  { 
    value: 'all', 
    label: 'Sync All Files', 
    description: 'Holdings + Weightings (recommended)' 
  },
]

export default function GoogleDriveSync({ onSyncComplete, onSyncError }: GoogleDriveSyncProps) {
  const [selectedType, setSelectedType] = useState<SyncFileType>('all')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncResults, setSyncResults] = useState<FileSyncResult[]>([])
  const [showResults, setShowResults] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncProgress(10)
    setSyncResults([])
    setShowResults(false)

    try {
      // Simulate initial progress
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => Math.min(prev + 10, 70))
      }, 300)

      const response = await fetch('/api/google-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileType: selectedType,
          dryRun: false,
        }),
      })

      clearInterval(progressInterval)
      setSyncProgress(90)

      const data: GoogleSyncResponse = await response.json()

      setSyncProgress(100)
      setSyncResults(data.synced)
      setShowResults(true)

      if (data.success) {
        const successCount = data.synced.filter(r => r.status === 'success').length
        onSyncComplete(data.message || `Successfully synced ${successCount} file(s)`)
      } else {
        onSyncError(data.error || 'Sync failed')
      }

    } catch (error) {
      setSyncProgress(0)
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync with Google Drive'
      onSyncError(errorMessage)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <svg 
          className="w-6 h-6 text-blue-400" 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/>
        </svg>
        <h3 className="text-lg font-semibold text-white">
          Sync from Google Drive
        </h3>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Automatically pull the latest data from your Google Sheets
      </p>

      {/* Sync Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Select Data to Sync:
        </label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as SyncFileType)}
          disabled={isSyncing}
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        >
          {SYNC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-2">
          {SYNC_OPTIONS.find(o => o.value === selectedType)?.description}
        </p>
      </div>

      {/* Sync Progress */}
      {isSyncing && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">
              Syncing from Google Drive...
            </span>
            <span className="text-sm font-medium text-slate-300">
              {syncProgress}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Sync Results */}
      {showResults && syncResults.length > 0 && (
        <div className="mb-4 space-y-2">
          {syncResults.map((result, idx) => (
            <div 
              key={idx}
              className={`p-3 rounded-lg border ${
                result.status === 'success' 
                  ? 'bg-green-900/20 border-green-700' 
                  : 'bg-red-900/20 border-red-700'
              }`}
            >
              <div className="flex items-start gap-2">
                {result.status === 'success' ? (
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${result.status === 'success' ? 'text-green-100' : 'text-red-100'}`}>
                    {result.file}
                  </p>
                  <p className={`text-xs ${result.status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                    {result.status === 'success' 
                      ? `Tab: ${result.tab} • ${result.rowsProcessed} rows`
                      : result.error || 'Failed to sync'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
      >
        {isSyncing ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Sync Now</span>
          </>
        )}
      </button>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-blue-200">
            This syncs data directly from your Google Drive folder. The system automatically detects the latest tab in each sheet.
          </p>
        </div>
      </div>
    </div>
  )
}
