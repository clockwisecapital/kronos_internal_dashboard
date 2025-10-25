'use client'

import { useState } from 'react'
import CSVUploader from '@/components/data/CSVUploader'
import DataPreview from '@/components/data/DataPreview'
import { UploadResponse, MultiUploadResponse } from '@/lib/types/csv'

export default function DataUploadPage() {
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | MultiUploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<{
    step: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
  }[]>([
    { step: 'File uploaded', status: 'pending' },
    { step: 'Sent to Claude API', status: 'pending' },
    { step: 'Parsing CSV data', status: 'pending' },
    { step: 'Validating structure', status: 'pending' },
    { step: 'Storing in database', status: 'pending' },
  ])

  const handleUploadComplete = (response: UploadResponse | MultiUploadResponse) => {
    setUploadResponse(response)
    setError(null)
    
    // Update all steps to completed
    setProcessingStatus(prev => prev.map(step => ({ ...step, status: 'completed' })))
  }

  const isMultiResponse = (response: unknown): response is MultiUploadResponse => {
    return typeof response === 'object' && response !== null && 'results' in response && 'totalFiles' in response
  }

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage)
    setUploadResponse(null)
    
    // Mark last step as failed
    setProcessingStatus(prev => {
      const lastCompletedIndex = prev.findIndex(s => s.status === 'processing')
      return prev.map((step, idx) => ({
        ...step,
        status: idx < lastCompletedIndex ? 'completed' : idx === lastCompletedIndex ? 'failed' : 'pending'
      }))
    })
  }

  const resetUpload = () => {
    setUploadResponse(null)
    setError(null)
    setProcessingStatus(prev => prev.map(step => ({ ...step, status: 'pending' })))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
          CSV Data Upload
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Upload daily/weekly CSV files exported from FactSet for processing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Uploader */}
        <div className="space-y-6">
          <CSVUploader
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />

          {/* Processing Status */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Processing Status
            </h3>

            {uploadResponse && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    {isMultiResponse(uploadResponse) 
                      ? `Successfully uploaded ${uploadResponse.successCount} of ${uploadResponse.totalFiles} files`
                      : uploadResponse.message}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-red-900 dark:text-red-100">
                    {error}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {processingStatus.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {step.status === 'completed' && (
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    )}
                    {step.status === 'processing' && (
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {step.status === 'failed' && (
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                    )}
                    {step.status === 'pending' && (
                      <svg className="w-5 h-5 text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>

                  {/* Step Label */}
                  <span
                    className={`text-sm ${
                      step.status === 'completed'
                        ? 'text-zinc-900 dark:text-zinc-100'
                        : step.status === 'processing'
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : step.status === 'failed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-zinc-500 dark:text-zinc-500'
                    }`}
                  >
                    {step.step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Accepted File Types
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• <strong>holdings.csv</strong> - Portfolio positions</li>
              <li>• <strong>prices.csv</strong> - Historical OHLCV data</li>
              <li>• <strong>fundamentals.csv</strong> - 22 scoring metrics</li>
              <li>• <strong>benchmarks.csv</strong> - Index performance</li>
              <li>• <strong>sector_valuations.csv</strong> - Sector metrics</li>
              <li>• <strong>cycle_indicators.csv</strong> - Investment cycle data</li>
              <li>• <strong>model_portfolios.csv</strong> - TIME+ model allocations</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div>
          {uploadResponse && isMultiResponse(uploadResponse) && (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white sticky top-0 bg-zinc-50 dark:bg-black py-2 z-10">
                Upload Results ({uploadResponse.successCount} successful, {uploadResponse.failureCount} failed)
              </h3>
              {uploadResponse.results.map((result, idx) => (
                <div key={idx}>
                  {result.success && result.preview ? (
                    <DataPreview
                      data={result.preview}
                      fileName={result.fileName || `File ${idx + 1}`}
                    />
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="font-medium text-red-900 dark:text-red-100">{result.fileName || `File ${idx + 1}`}</p>
                      <p className="text-sm text-red-800 dark:text-red-200">{result.error || 'Upload failed'}</p>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={resetUpload}
                className="sticky bottom-0 w-full px-6 py-3 bg-zinc-600 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
              >
                Upload More Files
              </button>
            </div>
          )}

          {uploadResponse && !isMultiResponse(uploadResponse) && uploadResponse.preview && (
            <>
              <DataPreview
                data={uploadResponse.preview}
                fileName={uploadResponse.fileName || 'Uploaded File'}
              />
              
              <button
                onClick={resetUpload}
                className="mt-4 w-full px-6 py-3 bg-zinc-600 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
              >
                Upload Another File
              </button>
            </>
          )}

          {!uploadResponse && !error && (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
              <svg className="w-24 h-24 mx-auto mb-4 text-zinc-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Ready to Upload
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Select "Any (Auto-Detect)" to upload multiple files at once, or choose a specific file type
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
