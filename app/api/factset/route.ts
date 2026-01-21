// FactSet Data API Route - Updated for factset_data_v2
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/app/utils/supabase/service-role'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('Fetching factset_data_v2...')
    const supabase = createServiceRoleClient()

    // Supabase has a hard 1000 row limit, so we need to fetch in batches
    const batchSize = 1000
    let allData: any[] = []
    let start = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('factset_data_v2')
        .select('"Ticker", "1 yr Beta", "3 yr beta", "5 yr beta - monthly", "Next Earnings Date", "Next Earnings Date Time of day"')
        .range(start, start + batchSize - 1)

      if (error) {
        console.error('FactSet API error:', error)
        throw error
      }

      if (data && data.length > 0) {
        allData = allData.concat(data)
        start += batchSize
        hasMore = data.length === batchSize
      } else {
        hasMore = false
      }
    }

    console.log(`FactSet API: Loaded ${allData.length} records from factset_data_v2 (fetched in batches of ${batchSize})`)

    return NextResponse.json({
      success: true,
      data: allData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('FactSet API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch factset data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}








