'use client'

import { ParsedCSVData } from '@/lib/types/csv'

interface DataPreviewProps {
  data: ParsedCSVData
  fileName: string
}

export default function DataPreview({ data, fileName }: DataPreviewProps) {
  if (!data || !data.records || data.records.length === 0) {
    return null
  }

  const columns = data.columns || Object.keys(data.records[0] as unknown as Record<string, unknown>)
  const hasWarnings = data.warnings && data.warnings.length > 0
  const hasErrors = data.errors && data.errors.length > 0

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-white mb-4">
        Data Preview
      </h3>

      {/* File Info */}
      <div className="mb-4 flex items-center gap-4 text-sm">
        <div>
          <span className="text-slate-400">File: </span>
          <span className="font-medium text-white">{fileName}</span>
        </div>
        <div>
          <span className="text-slate-400">Rows: </span>
          <span className="font-medium text-white">{data.rowCount}</span>
        </div>
        <div>
          <span className="text-slate-400">Columns: </span>
          <span className="font-medium text-white">{columns.length}</span>
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                Warnings
              </h4>
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                {data.warnings!.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {hasErrors && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
                Errors
              </h4>
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                {data.errors!.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto border border-slate-600 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              {columns.slice(0, 6).map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left font-medium text-white border-b border-slate-600"
                >
                  {col}
                </th>
              ))}
              {columns.length > 6 && (
                <th className="px-4 py-3 text-left font-medium text-white border-b border-slate-600">
                  ...
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.records.slice(0, 10).map((record, idx) => {
              const recordObj = record as unknown as Record<string, unknown>
              return (
                <tr
                  key={idx}
                  className="border-b border-slate-700 last:border-0 hover:bg-slate-700/50"
                >
                  {columns.slice(0, 6).map((col) => (
                    <td
                      key={col}
                      className="px-4 py-3 text-white"
                    >
                      {formatValue(recordObj[col])}
                    </td>
                  ))}
                  {columns.length > 6 && (
                    <td className="px-4 py-3 text-slate-400">
                      ...
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Show more indicator */}
      {data.rowCount > 10 && (
        <p className="mt-3 text-sm text-slate-400 text-center">
          Showing first 10 of {data.rowCount} rows
        </p>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-3">
        {!hasErrors && (
          <button className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            Data looks good
          </button>
        )}
        {hasWarnings && !hasErrors && (
          <button className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Review warnings
          </button>
        )}
      </div>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return String(value)
}
