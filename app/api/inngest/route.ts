// Inngest API Route
// Serves Inngest functions to Inngest Cloud
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { syncAllDataSources, syncDataManual } from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncAllDataSources,
    syncDataManual,
  ],
})
