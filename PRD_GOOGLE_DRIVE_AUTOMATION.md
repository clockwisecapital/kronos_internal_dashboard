# PRD: Google Drive Data Automation

**Status:** Planning  
**Created:** January 29, 2026  
**Owner:** Engineering Team  

---

## 1. Overview

Automate the data pipeline by syncing Google Sheets directly from the client's Google Drive folder, eliminating manual CSV uploads for holdings and FactSet data.

### Problem Statement
Currently, the dashboard requires manual CSV uploads for:
- Daily holdings data
- FactSet data (betas, earnings, target prices)
- Weightings data

This manual process is:
- Time-consuming
- Error-prone
- Delays data availability

### Solution
Build an automated sync system that:
- Connects to client's Google Drive folder
- Reads latest data from Google Sheets
- Processes and stores data in Supabase
- Can run on schedule or on-demand

---

## 2. Data Sources

### Google Drive Folder
**URL:** https://drive.google.com/drive/folders/1fW5LtfZCoS8pWyR2-M4CSQpgX4N9DCHY  
**Owner:** adambreitsimon  

### Files to Sync

| File Name | Type | Update Frequency | Contains |
|-----------|------|------------------|----------|
| DAILY HOLDINGS | Google Sheet | Daily @ 11pm | Portfolio positions |
| FACTSET BI-WEEKLY DOWNLOADS | Google Sheet | 2x per week | Betas, earnings, target prices |
| ETF Weight Matrix | Google Sheet | As needed | QQQ/SPY weights |
| GIC & YAHOO DATA | Google Sheet | As needed | Additional market data |

### Important Notes
- Each file has **multiple tabs** (historical data)
- Must identify and pull **latest tab only**
- Historical tabs should be ignored

---

## 3. Technical Architecture

### Authentication
- **Service Account:** `supabase-automation@claudecode-connections.iam.gserviceaccount.com`
- **Credentials:** Stored in `googleapi.md` (must move to env vars)
- **Required APIs:** Google Drive API, Google Sheets API
- **Access Level:** Viewer (read-only)

### API Endpoints

#### New: `/api/google-sync`
**Purpose:** Fetch data from Google Drive and process  
**Method:** POST  
**Functionality:**
1. Authenticate with Google Sheets API
2. Open each target file
3. Identify latest tab/sheet
4. Read data
5. Pass to existing parsing logic
6. Store in Supabase

**Request Body:**
```json
{
  "fileType": "holdings" | "factset" | "weightings" | "all",
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "synced": [
    {
      "file": "DAILY HOLDINGS",
      "tab": "Jan 29 2026",
      "rowsProcessed": 35,
      "status": "success"
    }
  ],
  "timestamp": "2026-01-29T23:15:00Z"
}
```

### Code Reuse Strategy

**Shared Logic:** Extract from `/api/upload/route.ts`
- `parseCSVWithClaude()` - CSV parsing with AI
- `validateParsedData()` - Data validation
- Database insert logic

**New Components:**
- Google Sheets client initialization
- Tab detection logic (find latest)
- Sheet-to-CSV conversion

---

## 4. Implementation Plan

### Phase 1: Setup & Connection (Week 1)
- [ ] Move credentials to environment variables
- [ ] Install Google APIs client library (`googleapis`)
- [ ] Test connection to Google Drive folder
- [ ] Verify access to all 4 files

### Phase 2: Core Sync Logic (Week 1-2)
- [ ] Build Google Sheets reader utility
- [ ] Implement tab detection (find latest)
- [ ] Convert sheet data to CSV format
- [ ] Integrate with existing parsing pipeline

### Phase 3: API Route (Week 2)
- [ ] Create `/api/google-sync` endpoint
- [ ] Add file type selection
- [ ] Implement dry-run mode
- [ ] Add comprehensive error handling

### Phase 4: UI Integration (Week 2)
- [ ] Add "Sync from Google Drive" button to Data Upload page
- [ ] Show sync status in UI
- [ ] Display last sync timestamp
- [ ] Add loading states

### Phase 5: Scheduling (Week 3)
- [ ] Set up cron job for daily sync @ 11:15pm
- [ ] Add manual trigger option
- [ ] Implement sync logs/history
- [ ] Email notifications on failures

---

## 5. Tab Detection Logic

### Challenge
Each Google Sheet has multiple tabs with historical data. Need to identify the latest tab programmatically.

### Approach Options

**Option A: Rightmost Tab**
- Assume newest data is always in rightmost tab
- Simple but fragile

**Option B: Tab Name Pattern** (Recommended)
- Look for date patterns in tab names (e.g., "Jan 29 2026")
- Parse dates and select most recent
- More reliable

**Option C: Data Inspection**
- Check "date" column in each tab
- Select tab with latest date
- Most accurate but slower

**Decision:** Start with Option B, fallback to Option C

---

## 6. Data Flow

```
Google Drive Folder
    ↓
Google Sheets API (authenticate)
    ↓
Read File → Identify Latest Tab
    ↓
Extract Sheet Data → Convert to CSV format
    ↓
parseCSVWithClaude() [existing]
    ↓
validateParsedData() [existing]
    ↓
Store in Supabase [existing]
    ↓
Success Response
```

---

## 7. File Type Mapping

| Google Sheet | File Type | Supabase Table | Processing Notes |
|--------------|-----------|----------------|------------------|
| DAILY HOLDINGS | holdings | `holdings` | Delete existing, insert new |
| FACTSET BI-WEEKLY DOWNLOADS | factset | `factset_data_v2` | Multiple columns, batch insert |
| ETF Weight Matrix | weightings | `weightings` | Filter to current holdings only |
| GIC & YAHOO DATA | TBD | TBD | Determine structure later |

---

## 8. Error Handling

### Scenarios to Handle
1. **Authentication Failure**
   - Service account not shared with folder
   - Invalid credentials

2. **File Not Found**
   - File renamed or deleted
   - Folder structure changed

3. **Tab Detection Failure**
   - No tabs found
   - Ambiguous tab names

4. **Data Validation Failure**
   - Schema mismatch
   - Missing required columns

5. **Database Errors**
   - Connection timeout
   - Constraint violations

### Response Strategy
- Log all errors with context
- Return detailed error messages
- Don't fail entire sync if one file fails
- Send notifications for critical failures

---

## 9. Security Considerations

### Credentials Management
- **Current:** Credentials in `googleapi.md` (NOT SECURE)
- **Required:** Move to environment variables
  ```
  GOOGLE_SERVICE_ACCOUNT_EMAIL=...
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
  GOOGLE_PROJECT_ID=...
  ```

### Access Control
- Service account has **read-only** access
- API route requires authentication (Supabase RLS)
- Manual sync button only visible to admins

### Data Privacy
- No PII stored
- All connections over HTTPS
- Audit log for sync operations

---

## 10. Testing Strategy

### Unit Tests
- Google Sheets client initialization
- Tab detection logic
- CSV conversion

### Integration Tests
- End-to-end sync for each file type
- Error handling scenarios
- Dry-run mode validation

### Manual Testing Checklist
- [ ] Sync DAILY HOLDINGS successfully
- [ ] Sync FACTSET BI-WEEKLY DOWNLOADS successfully
- [ ] Sync ETF Weight Matrix successfully
- [ ] Handle missing file gracefully
- [ ] Handle invalid tab names
- [ ] Verify data appears in dashboard
- [ ] Test dry-run mode

---

## 11. Success Metrics

### Performance
- Sync completes in < 2 minutes per file
- 99.9% uptime for scheduled syncs

### Reliability
- Zero data loss
- Automatic retry on transient failures

### User Experience
- Eliminate manual uploads
- Data available within 15 minutes of client update
- Clear status indicators in UI

---

## 12. Future Enhancements

### Phase 2 Features (Post-MVP)
- Sync history dashboard
- Diff view (show what changed)
- Rollback capability
- Support for additional file types
- Webhook triggers (sync when file changes)
- Email notifications on successful sync

### Advanced Features
- Real-time sync (watch for changes)
- Partial syncs (only changed data)
- Data validation dashboard
- Performance monitoring

---

## 13. Open Questions

1. **Tab naming convention:** Does client follow consistent pattern?
2. **FactSet file structure:** Single sheet or multiple files?
3. **Failure notifications:** Email, Slack, or in-app only?
4. **Sync frequency:** Just nightly, or also on-demand?
5. **Historical data:** Keep or archive after processing?

---

## 14. Dependencies

### NPM Packages
```json
{
  "googleapis": "^130.0.0"
}
```

### External Services
- Google Drive API (enabled)
- Google Sheets API (enabled)
- Supabase (existing)

### Configuration Required
- Environment variables for credentials
- Folder ID hardcoded or configurable
- File name mappings

---

## 15. Rollout Plan

### Pre-Launch
1. Test with client's approval on staging
2. Verify data accuracy vs manual uploads
3. Document any edge cases

### Launch
1. Deploy `/api/google-sync` endpoint
2. Add UI button for manual trigger
3. Monitor first few syncs manually

### Post-Launch
1. Enable automated daily sync
2. Set up monitoring/alerts
3. Collect feedback from client
4. Iterate based on usage

---

## Appendix A: Client Communication

### Access Request Email
**To:** Adam  
**Subject:** Google Drive Access for Automation  

Hi Adam,

To enable automated data syncing, please share the Google Drive folder with this service account email:

`supabase-automation@claudecode-connections.iam.gserviceaccount.com`

Access level: **Viewer** (read-only)

Once shared, the system will automatically pull the latest data from the files you mentioned.

Thanks!

---

## Appendix B: Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Use Google Sheets API instead of exporting CSVs | Direct API access is more reliable, faster, and doesn't require export step |
| Reuse existing parsing logic | Maintains consistency, reduces bugs, faster implementation |
| Service account over OAuth | Server-side automation doesn't need user interaction |
| Read-only access | Security best practice, prevents accidental modifications |
| Identify latest tab by name pattern | More reliable than position, easier to debug |

---

**End of PRD**
