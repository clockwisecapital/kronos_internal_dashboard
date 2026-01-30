# Inngest Setup Guide

This guide walks you through setting up Inngest for automated data syncing.

## 🚀 Step 1: Start Dev Server

First, make sure your Next.js dev server is running:

```bash
npm run dev
```

Your app should be running at: `http://localhost:3001`

---

## 🔌 Step 2: Connect Inngest Dev Server

Inngest uses a local dev server to test functions during development.

### Option A: Using npx (Recommended)

Open a **new terminal** and run:

```bash
npx inngest-cli@latest dev
```

This will:
1. Start the Inngest Dev Server (usually at `http://localhost:8288`)
2. Auto-discover your functions at `http://localhost:3001/api/inngest`
3. Open the Inngest Dev UI in your browser

### Option B: Install Globally

If you prefer to install the CLI globally:

```bash
npm install -g inngest-cli
inngest dev
```

---

## 📋 Step 3: Verify Functions Are Registered

Once the Inngest Dev Server starts, you should see:

```
✓ Dev server ready at http://localhost:8288
✓ Found functions at http://localhost:3001/api/inngest
  
Functions discovered:
  • sync-all-data-sources (Sync All Data Sources from Google Drive)
  • sync-data-manual (Manual Data Sync)
```

If you see this, you're all set! 🎉

---

## 🧪 Step 4: Test the Functions

### Test Automated Sync (Cron)

In the Inngest Dev UI (`http://localhost:8288`):

1. Go to **Functions** tab
2. Click **"sync-all-data-sources"**
3. Click **"Invoke"** button
4. Watch the function execute in real-time

You'll see:
- Each step (sync-holdings, sync-factset, etc.)
- Live logs
- Success/failure status
- Duration (~9-12 seconds)

### Test Manual Sync (Event-driven)

1. In Inngest Dev UI, go to **Events** tab
2. Click **"Send Event"**
3. Use this payload:

```json
{
  "name": "data/sync.manual",
  "data": {
    "fileType": "all"
  }
}
```

4. Click **"Send Event"**
5. Watch the function run

---

## 🔑 Step 5: Add Environment Variables (Optional for Dev)

Inngest doesn't require keys for local development, but you can add them:

```bash
# .env.local
INNGEST_EVENT_KEY=your-key-here
INNGEST_SIGNING_KEY=your-signing-key-here
```

Get these from: https://app.inngest.com/env/production/manage/keys

**Note:** These are only needed for production deployment.

---

## 📊 What the Functions Do

### 1. `sync-all-data-sources` (Automated)

**Schedule:** 8 AM EST, Monday-Friday  
**Trigger:** Cron (`0 8 * * 1-5`)  
**What it syncs:**
- Holdings: 40 rows
- FactSet: 2,307 rows
- Weightings: 633 rows
- GIC & Yahoo: 2,274 rows

**Total:** 5,254 rows in ~9-12 seconds

### 2. `sync-data-manual` (On-Demand)

**Trigger:** Event `data/sync.manual`  
**Parameters:** `{ fileType: 'holdings' | 'factset' | 'weightings' | 'gic_yahoo' | 'all' }`

Use this for:
- Testing specific data sources
- Ad-hoc syncs from the UI
- Manual triggers

---

## 🎯 Step 6: Trigger from Your App

You can trigger syncs from your Next.js app:

```typescript
// In any component or API route
import { inngest } from '@/inngest/client'

// Trigger a sync
await inngest.send({
  name: 'data/sync.manual',
  data: {
    fileType: 'all' // or 'holdings', 'factset', etc.
  }
})
```

---

## 🚢 Step 7: Deploy to Production

### 1. Deploy Your App

```bash
git add .
git commit -m "Add Inngest automated syncing"
git push
```

### 2. Connect Inngest Cloud

1. Go to https://app.inngest.com
2. Create a new app or use existing "clockwise-dashboard"
3. Click **"Sync"** → **"Create Sync"**
4. Enter your app URL: `https://your-app.vercel.app/api/inngest`
5. Click **"Sync App"**

### 3. Add Environment Variables to Vercel

In Vercel → Settings → Environment Variables:

```
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key
```

Get these from: https://app.inngest.com/env/production/manage/keys

### 4. Configure Schedule

In Inngest Dashboard:
1. Go to **Functions** → **sync-all-data-sources**
2. Click **"Schedule"** tab
3. Verify: `0 8 * * 1-5` (8 AM EST, Monday-Friday)
4. Enable the schedule

---

## 📈 Monitoring

### In Development
- Inngest Dev UI: `http://localhost:8288`
- See all function runs, logs, and errors

### In Production
- Inngest Dashboard: https://app.inngest.com
- Monitor runs, retries, and failures
- Get alerts for errors

### In Your App
- Check `sync_history` table in Supabase
- View sync logs in `/data-sync` page

---

## 🔧 Troubleshooting

### "No functions discovered"

1. Make sure dev server is running on `http://localhost:3001`
2. Check `/api/inngest` route exists
3. Restart both servers

### Function fails with TypeScript errors

```bash
npm run build
```

Fix any TypeScript errors, then restart dev server.

### "Cannot find module @/inngest/..."

1. Check `inngest/client.ts` exists
2. Check `inngest/functions.ts` exists
3. Restart dev server

### Sync fails with Google Drive error

1. Check Google credentials in `.env.local`
2. Verify service account has access to the folder
3. Check folder ID is correct

---

## 🎉 Success Checklist

- [ ] Dev server running on `http://localhost:3001`
- [ ] Inngest dev server running on `http://localhost:8288`
- [ ] Functions appear in Inngest Dev UI
- [ ] Can manually trigger sync from UI
- [ ] Sync completes successfully (5,254 rows)
- [ ] `sync_history` table shows new entry
- [ ] Schedule is configured for 8 AM EST weekdays

---

## 📚 Resources

- Inngest Docs: https://www.inngest.com/docs
- Inngest Dashboard: https://app.inngest.com
- Support: https://www.inngest.com/discord

---

## 🚀 Quick Start Commands

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start Inngest Dev Server
npx inngest-cli@latest dev
```

Then open: http://localhost:8288
