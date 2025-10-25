# Admin Scripts

## Creating Internal Users

### Setup

1. **Get your Supabase Service Role Key**:
   - Go to Supabase Dashboard → Settings → API
   - Copy the `service_role` key (keep this secret!)
   - Add to your `.env` file:
     ```env
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
     ```

2. **Install tsx** (TypeScript executor):
   ```bash
   npm install -D tsx
   ```

### Usage

1. **Edit `create-users.ts`** and add your employees' emails and passwords
2. **Run the script**:
   ```bash
   npx tsx scripts/create-users.ts
   ```

### Security Note

⚠️ **IMPORTANT**: The service role key bypasses all Row Level Security policies. 
- Never commit it to git
- Never expose it in client-side code
- Only use it in secure server-side scripts
