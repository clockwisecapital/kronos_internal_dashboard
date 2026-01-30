'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/utils/supabase/client'

interface SyncHistoryRecord {
  id: string
  sync_date: string
  sync_type: string
  file_type: string
  status: string
  files_synced: Array<{
    file: string
    tab: string
    rowsProcessed: number
    status: string
    error?: string
  }>
  total_rows: number
  duration_ms: number
  error_message?: string
  triggered_by: string
}

export default function DataSyncHistory() {
  const [history, setHistory] = useState<SyncHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      
      const { data, error: fetchError } = await supabase
        .from('sync_history')
        .select('*')
        .order('sync_date', { ascending: false })
        .limit(50)

      if (fetchError) throw fetchError

      setHistory(data || [])
    } catch (err) {
      console.error('Error loading sync history:', err)
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`
    const seconds = (ms / 1000).toFixed(1)
    return `${seconds}s`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-900/20 border-green-700'
      case 'partial':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
      case 'failed':
        return 'text-red-400 bg-red-900/20 border-red-700'
      default:
        return 'text-slate-400 bg-slate-900/20 border-slate-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        )
      case 'partial':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Sync History</h3>
        <div className="flex items-center justify-center py-12">
          <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Sync History</h3>
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-red-400">Error loading history: {error}</p>
          <button
            onClick={loadHistory}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Sync History</h3>
        <button
          onClick={loadHistory}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-400">No sync history yet</p>
          <p className="text-sm text-slate-500 mt-1">Run your first sync to see it here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {history.map((record) => (
            <div
              key={record.id}
              className="border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Status Icon */}
                    <div className={`p-1 rounded border ${getStatusColor(record.status)}`}>
                      {getStatusIcon(record.status)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white capitalize">
                          {record.file_type === 'all' ? 'All Files' : record.file_type}
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-sm text-slate-400">{formatDate(record.sync_date)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{record.total_rows} rows</span>
                        <span>•</span>
                        <span>{formatDuration(record.duration_ms)}</span>
                        <span>•</span>
                        <span className="capitalize">{record.sync_type}</span>
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${
                        expandedId === record.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === record.id && (
                <div className="px-4 pb-4 border-t border-slate-700 pt-3 bg-slate-900/50">
                  {/* Files Synced */}
                  {record.files_synced && record.files_synced.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-400 mb-2">Files Synced:</p>
                      {record.files_synced.map((file, idx) => (
                        <div
                          key={idx}
                          className={`text-sm p-2 rounded border ${
                            file.status === 'success'
                              ? 'bg-green-900/10 border-green-800/30 text-green-300'
                              : 'bg-red-900/10 border-red-800/30 text-red-300'
                          }`}
                        >
                          <div className="font-medium">{file.file}</div>
                          <div className="text-xs mt-1 opacity-75">
                            Tab: {file.tab} • {file.rowsProcessed} rows
                          </div>
                          {file.error && (
                            <div className="text-xs mt-1 text-red-400">{file.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error Message */}
                  {record.error_message && (
                    <div className="mt-3 p-2 bg-red-900/10 border border-red-800/30 rounded text-sm text-red-300">
                      <p className="font-medium mb-1">Error:</p>
                      <p className="text-xs">{record.error_message}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="mt-3 text-xs text-slate-500">
                    Triggered by: {record.triggered_by}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
