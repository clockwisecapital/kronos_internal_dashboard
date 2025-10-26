/**
 * Portfolio Snapshot API
 * Triggers daily portfolio snapshot capture
 * Can be called manually or via cron job
 */

import { NextResponse } from 'next/server'
import { capturePortfolioSnapshot, getSnapshotStats } from '@/lib/jobs/daily-snapshot'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/snapshot - Capture today's portfolio snapshot
 * Can be called from UI (authenticated) or via API key (cron jobs)
 */
export async function POST(request: Request) {
  try {
    console.log('Snapshot API: POST request received')
    
    // Optional: Check for API key (for cron jobs/automation)
    // If called from UI, authentication is handled by Next.js middleware
    const apiKey = request.headers.get('x-api-key')
    if (apiKey) {
      const validApiKey = process.env.CRON_SECRET || 'dev-secret-key'
      if (apiKey !== validApiKey) {
        console.warn('Snapshot API: Invalid API key')
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 }
        )
      }
    }
    
    const result = await capturePortfolioSnapshot()
    
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'Snapshot already exists'
        },
        { status: 409 } // Conflict
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Snapshot captured successfully'
    })

  } catch (error) {
    console.error('Snapshot API Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to capture snapshot'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/snapshot - Get snapshot statistics
 */
export async function GET() {
  try {
    const stats = await getSnapshotStats()
    
    if (!stats) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to retrieve snapshot statistics'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Snapshot Stats Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get statistics'
      },
      { status: 500 }
    )
  }
}
