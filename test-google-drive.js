// Test script to verify Google Drive API access
// Run with: node test-google-drive.js

const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')

// Load .env.local manually (handles multiline values)
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const envVars = {}
  
  let currentKey = null
  let currentValue = ''
  let inMultiline = false
  
  const lines = envContent.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (inMultiline) {
      // Continue accumulating multiline value
      if (line.endsWith('"')) {
        currentValue += '\n' + line.slice(0, -1)
        inMultiline = false
      } else {
        currentValue += '\n' + line
      }
      continue
    }
    
    // Skip empty lines and comments when not in multiline
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue
    }
    
    // Check if this is a new key=value pair
    const match = line.match(/^([^=]+)=(.*)$/)
    
    if (match) {
      // Save previous key if exists
      if (currentKey) {
        envVars[currentKey] = currentValue
      }
      
      currentKey = match[1].trim()
      currentValue = match[2].trim()
      
      // Check if value starts with a quote
      if (currentValue.startsWith('"')) {
        inMultiline = true
        currentValue = currentValue.slice(1) // Remove opening quote
        
        // Check if it also ends with a quote on the same line
        if (currentValue.endsWith('"') && currentValue.length > 1) {
          currentValue = currentValue.slice(0, -1)
          inMultiline = false
        }
      }
    }
  }
  
  // Save the last key
  if (currentKey) {
    envVars[currentKey] = currentValue
  }
  
  return envVars
}

const env = loadEnv()

const FOLDER_ID = env.GOOGLE_DRIVE_FOLDER_ID
const TARGET_FILES = [
  'DAILY HOLDINGS',
  'FACTSET BI-WEEKLY DOWNLOADS',
  'ETF Weight Matrix',
  'GIC & YAHOO DATA'
]

async function testGoogleDriveAccess() {
  console.log('='.repeat(60))
  console.log('Google Drive Access Test')
  console.log('='.repeat(60))
  console.log()

  try {
    // Step 1: Initialize credentials
    console.log('📋 Step 1: Initializing credentials...')
    
    // Debug: Check what we loaded
    console.log('   Loaded env keys:', Object.keys(env).filter(k => k.startsWith('GOOGLE')))
    
    const credentials = {
      type: 'service_account',
      project_id: env.GOOGLE_PROJECT_ID,
      private_key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    }

    if (!credentials.project_id) {
      throw new Error('Missing GOOGLE_PROJECT_ID environment variable')
    }
    if (!credentials.private_key) {
      throw new Error('Missing GOOGLE_PRIVATE_KEY environment variable')
    }
    if (!credentials.client_email) {
      throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable')
    }

    console.log(`   ✓ Service Account: ${credentials.client_email}`)
    console.log(`   ✓ Project ID: ${credentials.project_id}`)
    console.log()

    // Step 2: Create Google API clients
    console.log('📋 Step 2: Creating Google API clients...')
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    })

    const drive = google.drive({ version: 'v3', auth })
    const sheets = google.sheets({ version: 'v4', auth })
    console.log('   ✓ Drive API client created')
    console.log('   ✓ Sheets API client created')
    console.log()

    // Step 3: Test folder access
    console.log('📋 Step 3: Testing folder access...')
    console.log(`   Folder ID: ${FOLDER_ID}`)
    
    const folderResponse = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
    })

    const files = folderResponse.data.files || []
    console.log(`   ✓ Found ${files.length} files in folder`)
    console.log()

    // Step 4: Check for target files
    console.log('📋 Step 4: Checking for target files...')
    const results = []
    
    for (const targetFile of TARGET_FILES) {
      const file = files.find(f => f.name === targetFile)
      
      if (file) {
        console.log(`   ✓ Found: ${targetFile}`)
        console.log(`     ID: ${file.id}`)
        results.push({ name: targetFile, id: file.id, found: true })
      } else {
        console.log(`   ✗ Missing: ${targetFile}`)
        results.push({ name: targetFile, id: null, found: false })
      }
    }
    console.log()

    // Step 5: Test reading a sheet (if DAILY HOLDINGS exists)
    const holdingsFile = results.find(r => r.name === 'DAILY HOLDINGS')
    
    if (holdingsFile?.found && holdingsFile.id) {
      console.log('📋 Step 5: Testing sheet read access...')
      console.log(`   Testing: DAILY HOLDINGS`)
      
      try {
        // Get sheet metadata (tabs)
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: holdingsFile.id,
          fields: 'sheets(properties(title,sheetId,index))',
        })

        const tabs = spreadsheet.data.sheets || []
        console.log(`   ✓ Found ${tabs.length} tabs/sheets`)
        
        if (tabs.length > 0) {
          tabs.forEach((sheet, idx) => {
            const title = sheet.properties?.title || 'Untitled'
            const index = sheet.properties?.index ?? idx
            console.log(`     [${index}] ${title}`)
          })

          // Try to read data from the first sheet
          const firstTab = tabs[0].properties?.title
          console.log()
          console.log(`   Testing data read from tab: "${firstTab}"`)
          
          const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: holdingsFile.id,
            range: `'${firstTab}'!A1:E10`, // First 10 rows, 5 columns
          })

          const rows = dataResponse.data.values || []
          console.log(`   ✓ Successfully read ${rows.length} rows`)
          
          if (rows.length > 0) {
            console.log()
            console.log('   Sample data (first 3 rows):')
            rows.slice(0, 3).forEach((row, idx) => {
              console.log(`     Row ${idx + 1}: ${row.slice(0, 5).join(' | ')}`)
            })
          }
        }
      } catch (error) {
        console.log(`   ✗ Failed to read sheet: ${error.message}`)
      }
    } else {
      console.log('📋 Step 5: Skipping sheet read test (DAILY HOLDINGS not found)')
    }

    console.log()
    console.log('='.repeat(60))
    console.log('Test Summary')
    console.log('='.repeat(60))
    
    const foundCount = results.filter(r => r.found).length
    const totalCount = results.length
    
    console.log(`Files found: ${foundCount}/${totalCount}`)
    
    if (foundCount === totalCount) {
      console.log('✓ All target files are accessible!')
    } else {
      console.log('⚠ Some files are missing. Check folder sharing settings.')
    }
    
    console.log()
    console.log('Next steps:')
    console.log('1. If files are missing, share the folder with:')
    console.log(`   ${credentials.client_email}`)
    console.log('2. If all files found, test the /api/google-sync endpoint')
    console.log('3. Check the data-upload page for the new sync button')
    console.log()
    
    process.exit(0)

  } catch (error) {
    console.error()
    console.error('❌ Error:', error.message)
    console.error()
    
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error('Network error: Check your internet connection')
    } else if (error.message.includes('invalid_grant')) {
      console.error('Authentication error: Check your service account credentials')
    } else if (error.message.includes('403')) {
      console.error('Permission error: Service account may not have access to the folder')
      console.error('Share the folder with:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
    } else {
      console.error('Full error:', error)
    }
    
    process.exit(1)
  }
}

// Run the test
testGoogleDriveAccess()
