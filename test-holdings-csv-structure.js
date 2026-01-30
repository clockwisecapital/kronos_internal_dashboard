// Test to see the exact structure of the holdings CSV
const { google } = require('googleapis')

const CREDENTIALS = {
  type: 'service_account',
  project_id: 'claudecode-connections',
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
}

const FOLDER_ID = '1fW5LtfZCoS8pWyR2-M4CSQpgX4N9DCHY'

async function inspectHoldingsCSV() {
  console.log('\nInspecting DAILY HOLDINGS CSV structure...\n')
  
  const auth = new google.auth.GoogleAuth({
    credentials: CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  // Find DAILY HOLDINGS file
  const response = await drive.files.list({
    q: `name='DAILY HOLDINGS' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)',
  })

  const fileId = response.data.files[0].id

  // Get tabs
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: fileId,
    fields: 'sheets(properties(title))',
  })

  const latestTab = spreadsheet.data.sheets[spreadsheet.data.sheets.length - 1].properties.title

  console.log(`Reading from tab: ${latestTab}\n`)

  // Read first few rows
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: fileId,
    range: `'${latestTab}'!A1:Z5`,
  })

  const rows = dataResponse.data.values

  console.log('='.repeat(70))
  console.log('HEADERS (Row 1):')
  console.log('='.repeat(70))
  console.log(rows[0].join(' | '))
  console.log()
  
  console.log('Column mapping needed:')
  rows[0].forEach((header, idx) => {
    console.log(`  ${idx + 1}. "${header}"`)
  })

  console.log('\n' + '='.repeat(70))
  console.log('SAMPLE DATA (Rows 2-3):')
  console.log('='.repeat(70))
  rows.slice(1, 3).forEach((row, idx) => {
    console.log(`\nRow ${idx + 2}:`)
    row.forEach((val, i) => {
      console.log(`  ${rows[0][i]}: ${val}`)
    })
  })
  console.log()
}

inspectHoldingsCSV()
