/**
 * Synchronized Refresh Utility
 * Ensures all tabs refresh at the same time (top of each minute)
 */

/**
 * Calculate milliseconds until the next minute starts
 * This ensures all tabs sync to the same refresh schedule
 */
export function getMillisecondsUntilNextMinute(): number {
  const now = new Date()
  const seconds = now.getSeconds()
  const milliseconds = now.getMilliseconds()
  
  // Calculate time until next minute (60 seconds - current seconds)
  const secondsUntilNextMinute = 60 - seconds
  const msUntilNextMinute = (secondsUntilNextMinute * 1000) - milliseconds
  
  return msUntilNextMinute
}

/**
 * Setup synchronized refresh that fires at the top of each minute
 * @param callback Function to call on each refresh
 * @param interval Refresh interval in milliseconds (default: 60000 = 1 minute)
 * @returns Cleanup function to clear the interval
 */
export function setupSynchronizedRefresh(
  callback: () => void,
  interval: number = 60000
): () => void {
  let timeoutId: NodeJS.Timeout | null = null
  let intervalId: NodeJS.Timeout | null = null

  // Calculate initial delay to sync to next minute
  const initialDelay = getMillisecondsUntilNextMinute()
  
  console.log(`[Sync Refresh] Syncing to next minute in ${(initialDelay / 1000).toFixed(1)}s`)
  
  // Wait until next minute, then start interval
  timeoutId = setTimeout(() => {
    console.log('[Sync Refresh] ⏰ Minute mark reached - starting synchronized refresh cycle')
    
    // Fire first refresh at the minute mark
    callback()
    
    // Then repeat every interval (60 seconds)
    intervalId = setInterval(() => {
      const now = new Date()
      console.log(`[Sync Refresh] 🔄 Auto-refresh triggered at ${now.toLocaleTimeString()}`)
      callback()
    }, interval)
  }, initialDelay)

  // Return cleanup function
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      console.log('[Sync Refresh] Cleanup: cleared timeout')
    }
    if (intervalId) {
      clearInterval(intervalId)
      console.log('[Sync Refresh] Cleanup: cleared interval')
    }
  }
}

/**
 * Get the next scheduled refresh time
 */
export function getNextRefreshTime(): Date {
  const now = new Date()
  const nextRefresh = new Date(now)
  nextRefresh.setSeconds(0, 0)
  nextRefresh.setMinutes(nextRefresh.getMinutes() + 1)
  return nextRefresh
}

/**
 * Format time until next refresh
 */
export function getTimeUntilNextRefresh(): string {
  const msUntilNext = getMillisecondsUntilNextMinute()
  const seconds = Math.floor(msUntilNext / 1000)
  
  if (seconds > 55) {
    return 'in a few seconds'
  } else if (seconds > 30) {
    return `in ${seconds}s`
  } else {
    return 'soon'
  }
}
