// Simple test script for Google Drive access
// Run with: node test-google-access.js

const { google } = require('googleapis')

// Paste your credentials directly here for testing
const CREDENTIALS = {
  type: 'service_account',
  project_id: 'claudecode-connections',
  private_key_id: '7da68e758a6b3e4c80424216f400da66765e131a',
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC/j29gGAHyP8Ax
G8Jm9qLjAGRtxaSEDgfNBBYrlEgJknokb1+ZA+9lF+Km3SY69TJ5xobdsqMyZRNR
Gb25peqYpfuPn7Nbp4EE3KE5HntJvFwZJVcqgfl9TRU0beoDqWpGdlvr/9GpxJor
g1nArsUnwy8Xh46tTHcu5w6ZtLi5uA74LAhpI+1qmwFwhjgcwZ5IODgktNJrMf7N
iez3l16NGO6LCsw3AzFUOGhzujt3Q9J+UciJ4MdUB+Ovq882oMsn+MsPH4DOgEKQ
upkom8VuzN6Q64Uv8U4hcP/5B2LpQ65DzohS2K7jUzXaNnXBGNwpQ6peA7OPPhCY
QATenqblAgMBAAECggEAG/OXNKYxe9fZ40Xh1ySsPkOw4871Q1WexXIQCsTaFsIl
CMr9iot8njuJgCqrKOrdYM/bSbSGw/7j/i9WM/rQoVHa7qlGwnF4eIKkaHwY+6M8
rGilRZfDQAmENhXHEfNhsALA7/ibRH03t8YJ+H0oBIt3rs8XaRR2xu/CfXgq2je6
D7Uy+foYQxyNRPOaqDxWcjcBwRZ1VN8VVCT+ima6dk2b3cOFYu9NylCWOPbVSjzW
Ln9A41Zupa7SNUmolNExSttlhIJu3F9blDnXEQzxY6xR8z+xIgM9H4pjoVaRti8M
SGkr5pKqJ2hs8XZWfsLL+JDE6CYgvuG135q+whDz0wKBgQDno0Nz0Ap63WaGDd/i
dmwdJBUJWtAP48XHEp8SlD+gQjnZSHi969Xt4q0bZA4aXS12YWyJo9gU3BPfLHAa
HzK81rqVEeULYPAANra5+3Ev4+gShFebzG8KhWxW9FFeeBKxvvTmujxK67A/AZRW
hSNYqNn4ypS9SuAUroLZ+J2tIwKBgQDTtRrofdGMpakDCO2QH/XoQ3Ety61TP9dY
3HlosDzbMK8Gm1Eu0h3LCVN/T+ts5CaUkAFN1qMOHju8+r1NLueTqdRvkxpudsew
O4oPHbXwSCie7QneiWtGEJkdZ7hZeKT3FxNCZho9le+rbIONLDpmnsFKkytVhkST
nvGorejwVwKBgQDQtMisy7D1nRCoDk4/9KVa6EzP/fPjrT1hLcUH720YjzMiNGsd
7CT3zrpcKJ2QYY350LQDnA2wVc7N0XM8BgooHW1FrTbrNq9n8eRX1FbaaIWMUZPC
O8N8/lRsUHwUGyn03vI4BWsXsh491sV540HCu3iR8q1rlNArskUR8jDXcwKBgF0x
PswS/phsIA8O8gxclVINxheDriOUWcZrHyKfWdqe/pzo5/61TZof29qSIq9Ha1hA
X+KU1igT1PYmZghA2n3c53/KAHuZ2+NPAkIPMRS5nu/+pjaIxWkNS2lvS+5Otkdy
p+61pV1w0BTk6q/NRVQBFFMwn4XBWhSlhflbvMt3AoGBAK7FtMCVLa+veCBeaq07
QukMJtYb+MADGXN5Z9mdx1nyhlncQxJ+xzRxsEW2GSXb92FjxbpMKNFRkzWOZJMK
GBDzGJCWNa7PbpJLlUNVbqxsk00ifXl7zUXcBF2UiukmaWV31UeC97rOmDgclFaa
ADXGTzUK/LnQ9pmDSF51/QKu
-----END PRIVATE KEY-----`,
  client_email: 'supabase-automation@claudecode-connections.iam.gserviceaccount.com',
  client_id: '103148048738968585464',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/supabase-automation%40claudecode-connections.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com'
}

const FOLDER_ID = '1fW5LtfZCoS8pWyR2-M4CSQpgX4N9DCHY'
const TARGET_FILES = [
  'DAILY HOLDINGS',
  'FACTSET BI-WEEKLY DOWNLOADS',
  'ETF Weight Matrix',
  'GIC & YAHOO DATA'
]

async function test() {
  console.log('\n' + '='.repeat(60))
  console.log('Google Drive Access Test')
  console.log('='.repeat(60) + '\n')

  try {
    console.log('📋 Step 1: Creating Google API clients...')
    const auth = new google.auth.GoogleAuth({
      credentials: CREDENTIALS,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    })

    const drive = google.drive({ version: 'v3', auth })
    const sheets = google.sheets({ version: 'v4', auth })
    console.log('   ✓ Clients created\n')

    console.log('📋 Step 2: Listing files in folder...')
    console.log(`   Folder ID: ${FOLDER_ID}\n`)
    
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      spaces: 'drive',
    })

    const files = response.data.files || []
    console.log(`   ✓ Found ${files.length} files:\n`)
    
    files.forEach(file => {
      console.log(`   • ${file.name}`)
      console.log(`     ID: ${file.id}`)
      console.log(`     Modified: ${file.modifiedTime}\n`)
    })

    console.log('📋 Step 3: Checking for target files...\n')
    const results = []
    
    for (const targetName of TARGET_FILES) {
      const file = files.find(f => f.name === targetName)
      if (file) {
        console.log(`   ✓ ${targetName}`)
        results.push({ name: targetName, id: file.id, found: true })
      } else {
        console.log(`   ✗ ${targetName} - NOT FOUND`)
        results.push({ name: targetName, id: null, found: false })
      }
    }

    const holdingsFile = results.find(r => r.name === 'DAILY HOLDINGS')
    
    if (holdingsFile?.found) {
      console.log('\n📋 Step 4: Testing sheet access (DAILY HOLDINGS)...\n')
      
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: holdingsFile.id,
        fields: 'sheets(properties(title,sheetId,index))',
      })

      const tabs = spreadsheet.data.sheets || []
      console.log(`   ✓ Found ${tabs.length} tabs:\n`)
      
      tabs.slice(0, 10).forEach((sheet, idx) => {
        const title = sheet.properties?.title || 'Untitled'
        const index = sheet.properties?.index ?? idx
        console.log(`     [${index}] ${title}`)
      })

      if (tabs.length > 10) {
        console.log(`     ... and ${tabs.length - 10} more tabs`)
      }

      // Test reading data from rightmost tab
      const latestTab = tabs.reduce((latest, current) => {
        const latestIdx = latest.properties?.index ?? 0
        const currentIdx = current.properties?.index ?? 0
        return currentIdx > latestIdx ? current : latest
      })

      const tabName = latestTab.properties?.title || 'Sheet1'
      console.log(`\n   Reading data from latest tab: "${tabName}"...\n`)
      
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: holdingsFile.id,
        range: `'${tabName}'!A1:F10`,
      })

      const rows = dataResponse.data.values || []
      console.log(`   ✓ Successfully read ${rows.length} rows\n`)
      
      if (rows.length > 0) {
        console.log('   Sample data (first 3 rows):\n')
        rows.slice(0, 3).forEach((row, idx) => {
          console.log(`     Row ${idx + 1}: ${row.slice(0, 6).join(' | ')}`)
        })
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✓ TEST PASSED')
    console.log('='.repeat(60))
    
    const foundCount = results.filter(r => r.found).length
    console.log(`\nFiles accessible: ${foundCount}/${results.length}`)
    
    if (foundCount === results.length) {
      console.log('\n✓ All target files are accessible!')
      console.log('✓ Ready to use /api/google-sync endpoint\n')
    } else {
      console.log('\n⚠ Some files are missing.')
      console.log('Share the folder with:', CREDENTIALS.client_email, '\n')
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED\n')
    console.error('Error:', error.message)
    
    if (error.code === 403) {
      console.error('\nPermission denied. Make sure the folder is shared with:')
      console.error(CREDENTIALS.client_email)
    } else if (error.code === 404) {
      console.error('\nFolder not found. Check the FOLDER_ID.')
    }
    
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

test()
