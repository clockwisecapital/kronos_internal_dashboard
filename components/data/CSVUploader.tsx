'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { CSVFileType, UploadResponse, MultiUploadResponse } from '@/lib/types/csv'

interface CSVUploaderProps {
  onUploadComplete: (response: UploadResponse | MultiUploadResponse) => void
  onUploadError: (error: string) => void
}

const FILE_TYPE_OPTIONS: { value: CSVFileType; label: string; description?: string }[] = [
  { value: 'any', label: 'Any (Auto-Detect)', description: 'Upload multiple files at once' },
  { value: 'holdings', label: 'Holdings' },
  { value: 'prices', label: 'Prices' },
  { value: 'fundamentals', label: 'Fundamentals' },
  { value: 'benchmarks', label: 'Benchmarks' },
  { value: 'sector_valuations', label: 'Sector Valuations' },
  { value: 'cycle_indicators', label: 'Cycle Indicators' },
  { value: 'model_portfolios', label: 'Model Portfolios' },
]

export default function CSVUploader({ onUploadComplete, onUploadError }: CSVUploaderProps) {
  const [fileType, setFileType] = useState<CSVFileType>('any')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const isMultiMode = fileType === 'any'

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      if (isMultiMode) {
        handleMultipleFiles(files)
      } else if (files[0]) {
        handleFileSelect(files[0])
      }
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      if (isMultiMode) {
        handleMultipleFiles(files)
      } else if (files[0]) {
        handleFileSelect(files[0])
      }
    }
  }

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      onUploadError('Please select a CSV file')
      return
    }
    setSelectedFiles([file])
  }

  const handleMultipleFiles = (files: File[]) => {
    const csvFiles = files.filter(f => f.name.endsWith('.csv'))
    if (csvFiles.length === 0) {
      onUploadError('Please select CSV files')
      return
    }
    if (csvFiles.length !== files.length) {
      onUploadError(`Filtered out ${files.length - csvFiles.length} non-CSV files`)
    }
    setSelectedFiles(csvFiles)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      onUploadError('Please select at least one file')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setCurrentFileIndex(0)

    try {
      if (isMultiMode) {
        // Multi-file upload
        const results: UploadResponse[] = []
        
        for (let i = 0; i < selectedFiles.length; i++) {
          setCurrentFileIndex(i)
          const file = selectedFiles[i]
          
          const formData = new FormData()
          formData.append('file', file)
          formData.append('fileType', 'any') // Auto-detect
          formData.append('fileName', file.name)

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })

          const data: UploadResponse = await response.json()
          data.fileName = file.name
          results.push(data)
          
          // Update progress
          setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
        }

        const multiResponse: MultiUploadResponse = {
          results,
          totalFiles: selectedFiles.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length
        }

        onUploadComplete(multiResponse)
      } else {
        // Single file upload
        const formData = new FormData()
        formData.append('file', selectedFiles[0])
        formData.append('fileType', fileType)

        const progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 80))
        }, 200)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        clearInterval(progressInterval)
        setUploadProgress(100)

        const data: UploadResponse = await response.json()
        data.fileName = selectedFiles[0].name

        if (data.success) {
          onUploadComplete(data)
        } else {
          onUploadError(data.error || 'Upload failed')
        }
      }
      
      // Reset
      setSelectedFiles([])
      setUploadProgress(0)
      setCurrentFileIndex(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      onUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
        Upload Files
      </h3>

      {/* File Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Select File Type:
        </label>
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as CSVFileType)}
          disabled={isUploading}
          className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {FILE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragging 
            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/10' 
            : 'border-zinc-300 dark:border-zinc-700 hover:border-cyan-400 dark:hover:border-cyan-600'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple={isMultiMode}
          onChange={handleFileInputChange}
          disabled={isUploading}
          className="hidden"
        />

        <svg className="w-16 h-16 mx-auto mb-4 text-zinc-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        
        {selectedFiles.length > 0 ? (
          <div>
            {selectedFiles.length === 1 ? (
              <>
                <p className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                  {selectedFiles[0].name}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {(selectedFiles[0].size / 1024).toFixed(2)} KB
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                  {selectedFiles.length} files selected
                </p>
                <div className="text-sm text-zinc-600 dark:text-zinc-400 max-h-20 overflow-y-auto">
                  {selectedFiles.map((f, idx) => (
                    <div key={idx}>• {f.name}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <p className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              {isMultiMode ? 'Drag & Drop Multiple CSV Files' : 'Drag & Drop CSV File Here'}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              or click to browse
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              {isMultiMode ? 'Drop multiple files for batch upload' : 'Accepted: holdings.csv, prices.csv, fundamentals.csv,'}<br />
              {!isMultiMode && 'benchmarks.csv, sector_valuations.csv,'}<br />
              {!isMultiMode && 'cycle_indicators.csv, model_portfolios.csv'}
            </p>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isMultiMode ? `Uploading file ${currentFileIndex + 1} of ${selectedFiles.length}...` : 'Uploading...'}
            </span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {uploadProgress}%
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || isUploading}
        className="mt-4 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
      >
        {isUploading ? 'Processing...' : (isMultiMode && selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : 'Upload & Process')}
      </button>
    </div>
  )
}
