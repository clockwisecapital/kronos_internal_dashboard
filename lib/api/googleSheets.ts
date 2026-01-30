// Google Sheets API utilities for syncing data from Google Drive

import { google } from 'googleapis'
import { sheets_v4 } from 'googleapis'

/**
 * File type mapping for Google Sheets
 */
export type GoogleSheetFileType = 'holdings' | 'factset' | 'weightings' | 'gic_yahoo'

/**
 * Configuration for Google Drive files
 */
export const GOOGLE_DRIVE_FILES = {
  holdings: {
    name: 'DAILY HOLDINGS',
    fileId: '', // Will be populated by searching the folder
    tableName: 'holdings',
  },
  factset: {
    name: 'FACTSET BI-WEEKLY DOWNLOADS',
    fileId: '',
    tableName: 'factset_data_v2',
  },
  weightings: {
    name: 'ETF Weight Matrix',
    fileId: '',
    tableName: 'weightings',
  },
  gic_yahoo: {
    name: 'GIC & YAHOO DATA',
    fileId: '',
    tableName: 'gic_yahoo_data',
  },
} as const

/**
 * Initialize Google Sheets client with service account credentials
 */
export function createGoogleSheetsClient() {
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID!,
    private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  return { sheets, drive, auth }
}

/**
 * Find file ID in Google Drive folder by name
 */
export async function findFileInFolder(
  drive: ReturnType<typeof google.drive>,
  folderIdOrUrl: string,
  fileName: string
): Promise<string | null> {
  try {
    // Extract folder ID from URL if needed
    const folderId = folderIdOrUrl.includes('/')
      ? folderIdOrUrl.split('/').pop() || folderIdOrUrl
      : folderIdOrUrl

    console.log(`Searching for file "${fileName}" in folder ${folderId}`)

    const response = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    })

    const files = response.data.files || []
    
    if (files.length === 0) {
      console.warn(`File "${fileName}" not found in folder`)
      return null
    }

    if (files.length > 1) {
      console.warn(`Multiple files named "${fileName}" found, using first one`)
    }

    const fileId = files[0].id!
    console.log(`Found file "${fileName}" with ID: ${fileId}`)
    
    return fileId
  } catch (error) {
    console.error(`Error finding file "${fileName}":`, error)
    throw error
  }
}

/**
 * Get all sheet tabs from a Google Sheets file
 */
export async function getSheetTabs(
  sheets: sheets_v4.Sheets,
  fileId: string
): Promise<Array<{ title: string; sheetId: number; index: number }>> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: fileId,
      fields: 'sheets(properties(title,sheetId,index))',
    })

    const tabsList = response.data.sheets?.map((sheet) => ({
      title: sheet.properties?.title || 'Untitled',
      sheetId: sheet.properties?.sheetId || 0,
      index: sheet.properties?.index || 0,
    })) || []

    console.log(`Found ${tabsList.length} tabs:`, tabsList.map(t => t.title))
    
    return tabsList
  } catch (error) {
    console.error('Error getting sheet tabs:', error)
    throw error
  }
}

/**
 * Detect the latest tab using multiple strategies
 * Strategy 1: Date pattern in tab name (e.g., "Jan 29 2026", "2026-01-29")
 * Strategy 2: Rightmost tab (highest index)
 */
export function detectLatestTab(
  tabs: Array<{ title: string; sheetId: number; index: number }>
): { title: string; sheetId: number; index: number } {
  if (tabs.length === 0) {
    throw new Error('No tabs found in spreadsheet')
  }

  // Strategy 1: Try to parse dates from tab names
  const datePatterns = [
    // "Jan 29 2026" format
    /(\w+)\s+(\d{1,2})\s+(\d{4})/i,
    // "2026-01-29" format
    /(\d{4})-(\d{2})-(\d{2})/,
    // "01-29-2026" format
    /(\d{2})-(\d{2})-(\d{4})/,
    // "Jan 29" format (assume current year)
    /(\w+)\s+(\d{1,2})$/i,
  ]

  const monthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ]

  const tabsWithDates = tabs.map((tab) => {
    let parsedDate: Date | null = null

    for (const pattern of datePatterns) {
      const match = tab.title.match(pattern)
      if (match) {
        try {
          if (pattern === datePatterns[0] || pattern === datePatterns[3]) {
            // "Jan 29 2026" or "Jan 29" format
            const monthStr = match[1].toLowerCase().substring(0, 3)
            const monthIndex = monthNames.indexOf(monthStr)
            const day = parseInt(match[2], 10)
            const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear()
            
            if (monthIndex !== -1) {
              parsedDate = new Date(year, monthIndex, day)
            }
          } else if (pattern === datePatterns[1]) {
            // "2026-01-29" format
            parsedDate = new Date(match[0])
          } else if (pattern === datePatterns[2]) {
            // "01-29-2026" format
            const month = parseInt(match[1], 10) - 1
            const day = parseInt(match[2], 10)
            const year = parseInt(match[3], 10)
            parsedDate = new Date(year, month, day)
          }

          if (parsedDate && !isNaN(parsedDate.getTime())) {
            break
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }

    return {
      ...tab,
      parsedDate,
    }
  })

  // Find tab with latest date
  const tabsWithValidDates = tabsWithDates.filter((t) => t.parsedDate !== null)
  
  if (tabsWithValidDates.length > 0) {
    const latestTab = tabsWithValidDates.reduce((latest, current) => {
      return current.parsedDate! > latest.parsedDate! ? current : latest
    })
    
    console.log(`Detected latest tab by date: "${latestTab.title}" (${latestTab.parsedDate})`)
    return latestTab
  }

  // Strategy 2: Fallback to rightmost tab (highest index)
  const rightmostTab = tabs.reduce((rightmost, current) => {
    return current.index > rightmost.index ? current : rightmost
  })

  console.log(`Using rightmost tab as latest: "${rightmostTab.title}" (index: ${rightmostTab.index})`)
  return rightmostTab
}

/**
 * Read data from a specific sheet tab and convert to CSV format
 */
export async function readSheetAsCSV(
  sheets: sheets_v4.Sheets,
  fileId: string,
  tabName: string
): Promise<string> {
  try {
    console.log(`Reading sheet "${tabName}" from file ${fileId}`)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${tabName}'!A:ZZ`, // Read all columns from A to ZZ
    })

    const rows = response.data.values || []

    if (rows.length === 0) {
      throw new Error(`Sheet "${tabName}" is empty`)
    }

    // Convert to CSV format
    const csvLines = rows.map((row) => {
      // Escape fields that contain commas, quotes, or newlines
      const escapedRow = row.map((cell) => {
        const cellStr = cell?.toString() || ''
        
        // If cell contains comma, quote, or newline, wrap in quotes and escape existing quotes
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        
        return cellStr
      })
      
      return escapedRow.join(',')
    })

    const csvContent = csvLines.join('\n')
    
    console.log(`Successfully converted sheet to CSV: ${rows.length} rows, ${rows[0]?.length || 0} columns`)
    
    return csvContent
  } catch (error) {
    console.error(`Error reading sheet "${tabName}":`, error)
    throw error
  }
}

/**
 * Main function: Sync a file from Google Drive
 * Returns CSV content from the latest tab
 */
export async function syncGoogleSheetFile(
  fileType: GoogleSheetFileType
): Promise<{
  csvContent: string
  fileName: string
  tabName: string
  rowCount: number
}> {
  const { sheets, drive } = createGoogleSheetsClient()
  
  const fileConfig = GOOGLE_DRIVE_FILES[fileType]
  const folderIdOrUrl = process.env.GOOGLE_DRIVE_FOLDER_ID!

  // Find file in folder
  const fileId = await findFileInFolder(drive, folderIdOrUrl, fileConfig.name)
  
  if (!fileId) {
    throw new Error(`File "${fileConfig.name}" not found in Google Drive folder`)
  }

  // Get all tabs
  const tabs = await getSheetTabs(sheets, fileId)

  // Detect latest tab
  const latestTab = detectLatestTab(tabs)

  // Read sheet data as CSV
  const csvContent = await readSheetAsCSV(sheets, fileId, latestTab.title)

  // Count rows (excluding header)
  const rowCount = csvContent.split('\n').length - 1

  return {
    csvContent,
    fileName: fileConfig.name,
    tabName: latestTab.title,
    rowCount,
  }
}
