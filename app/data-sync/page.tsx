'use client'

import { useState } from 'react'
import GoogleDriveSync from '@/components/data/GoogleDriveSync'
import DataSyncHistory from '@/components/data/DataSyncHistory'

export default function DataSyncPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshHistory, setRefreshHistory] = useState(0)

  const handleSyncComplete = (successMessage: string) => {
    setMessage(successMessage)
    setError(null)
    // Trigger history refresh
    setRefreshHistory(prev => prev + 1)
  }

  const handleSyncError = (errorMessage: string) => {
    setError(errorMessage)
    setMessage(null)
    // Still refresh history to show failed sync
    setRefreshHistory(prev => prev + 1)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Data Sync
        </h1>
        <p className="text-slate-400">
          Automatically sync data from Google Drive or manually upload CSV files
        </p>
      </div>

      {/* Status Messages */}
      {message && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-green-100">
              {message}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-red-100">
              {error}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sync Actions */}
        <div className="lg:col-span-1">
          {/* Google Drive Sync - Primary Method */}
          <GoogleDriveSync
            onSyncComplete={handleSyncComplete}
            onSyncError={handleSyncError}
          />
        </div>

        {/* Right Column: History */}
        <div className="lg:col-span-2">
          {/* Sync History */}
          <DataSyncHistory key={refreshHistory} />
        </div>
      </div>
    </div>
  )
}
