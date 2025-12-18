'use client'

import { useState } from 'react'
import ScoreCell from './ScoreCell'

interface MetricDetail {
  name: string
  value: number | null
  score: number | null
  format?: 'percentile' | 'percentage' | 'ratio' | 'number'
  invertColor?: boolean
}

interface CompositeScoreCardProps {
  title: string
  compositeScore: number | null
  metrics: MetricDetail[]
  description?: string
}

export default function CompositeScoreCard({
  title,
  compositeScore,
  metrics,
  description
}: CompositeScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Determine composite score color
  let scoreColorClass = 'text-slate-300 bg-slate-700'
  if (compositeScore !== null) {
    if (compositeScore >= 80) {
      scoreColorClass = 'text-green-400 bg-green-900/40'
    } else if (compositeScore >= 60) {
      scoreColorClass = 'text-green-300 bg-green-900/30'
    } else if (compositeScore >= 40) {
      scoreColorClass = 'text-yellow-400 bg-yellow-900/40'
    } else if (compositeScore >= 20) {
      scoreColorClass = 'text-orange-400 bg-orange-900/40'
    } else {
      scoreColorClass = 'text-red-400 bg-red-900/40'
    }
  }
  
  return (
    <div className="border border-slate-600 rounded-lg overflow-hidden bg-slate-800">
      {/* Header - Composite Score */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">{title}</h3>
          {description && (
            <span className="text-xs text-slate-400">{description}</span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-lg font-bold text-lg ${scoreColorClass}`}>
            {compositeScore !== null ? compositeScore.toFixed(1) : 'N/A'}
          </div>
          
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {/* Expanded Details - Individual Metrics */}
      {isExpanded && (
        <div className="border-t border-slate-600 bg-slate-900/50 px-4 py-3">
          <div className="space-y-2">
            {metrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                <div className="flex-1">
                  <span className="text-sm text-slate-300">{metric.name}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Raw Value */}
                  <div className="text-sm text-slate-400 min-w-[80px] text-right">
                    {metric.value !== null ? (
                      metric.format === 'percentage' ? 
                        `${(metric.value * 100).toFixed(1)}%` :
                      metric.format === 'ratio' ?
                        metric.value.toFixed(2) :
                        metric.value.toFixed(1)
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </div>
                  
                  {/* Percentile Score */}
                  <div className="min-w-[80px]">
                    <ScoreCell 
                      score={metric.score} 
                      format="percentile"
                      invertColor={metric.invertColor}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

