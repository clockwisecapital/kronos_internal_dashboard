'use client'

interface ScoreCellProps {
  score: number | null
  format?: 'percentile' | 'percentage' | 'ratio' | 'number'
  invertColor?: boolean
  decimals?: number
}

export default function ScoreCell({ 
  score, 
  format = 'percentile',
  invertColor = false,
  decimals = 1
}: ScoreCellProps) {
  if (score === null || score === undefined) {
    return (
      <div className="text-center text-slate-500 text-sm">
        N/A
      </div>
    )
  }
  
  // Determine color based on score (0-100 scale for percentiles)
  let colorClass = 'text-slate-300'
  let bgClass = 'bg-slate-700'
  
  if (format === 'percentile') {
    // For percentile scores, higher is better (unless inverted)
    const effectiveScore = invertColor ? 100 - score : score
    
    if (effectiveScore >= 80) {
      colorClass = 'text-green-400'
      bgClass = 'bg-green-900/30'
    } else if (effectiveScore >= 60) {
      colorClass = 'text-green-300'
      bgClass = 'bg-green-900/20'
    } else if (effectiveScore >= 40) {
      colorClass = 'text-yellow-400'
      bgClass = 'bg-yellow-900/30'
    } else if (effectiveScore >= 20) {
      colorClass = 'text-orange-400'
      bgClass = 'bg-orange-900/30'
    } else {
      colorClass = 'text-red-400'
      bgClass = 'bg-red-900/30'
    }
  }
  
  // Format the display value
  let displayValue: string
  switch (format) {
    case 'percentage':
      displayValue = `${(score * 100).toFixed(decimals)}%`
      break
    case 'ratio':
      displayValue = score.toFixed(decimals)
      break
    case 'number':
      displayValue = score.toFixed(decimals)
      break
    case 'percentile':
    default:
      displayValue = score.toFixed(decimals)
      break
  }
  
  return (
    <div 
      className={`inline-flex items-center justify-center px-2 py-1 rounded text-sm font-medium ${colorClass} ${bgClass}`}
      title={format === 'percentile' ? `Percentile rank: ${displayValue}` : displayValue}
    >
      {displayValue}
    </div>
  )
}

