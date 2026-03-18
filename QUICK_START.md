# Quick Start Guide - ComplianceHub

Get your Compliance Operating System up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A Supabase account with a project
- A Razorpay account (test mode is fine for development)

## Step 1: Clone and Install (1 minute)

```bash
# Install dependencies
npm install
```

## Step 2: Configure Environment Variables (2 minutes)

Create a `.env.local` file in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Razorpay Configuration (Test Mode)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Where to Find These Values:

**Supabase:**
1. Go to your Supabase project dashboard
2. Click Settings → API
3. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

**Razorpay:**
1. Sign up at https://razorpay.com
2. Go to Settings → API Keys (Test Mode)
3. Copy:
   - Key ID → `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - Key Secret → `RAZORPAY_KEY_SECRET` (⚠️ Keep secret!)
4. For webhook secret:
   - Go to Settings → Webhooks
   - Create webhook (we'll configure this in Step 4)

## Step 3: Database Setup (Already Done!)

The database migrations have been automatically applied. Your Supabase project now has:

✅ `profiles` table with user types (business_owner, chartered_accountant)
✅ `businesses` table with compliance scores
✅ `subscriptions` table for plan management
✅ `compliance_tasks` table for statutory deadlines
✅ `documents` table for vault
✅ `audit_logs` table for legal protection
✅ `whatsapp_credits` and `storage_usage` tables
✅ `client_relationships` for CA-business connections

All tables have Row-Level Security (RLS) enabled with proper policies!

## Step 4: Start Development Server (30 seconds)

```bash
npm run dev
```

Visit http://localhost:3000

## Step 5: Test the Application (1 minute)

### Create a Test Account:

1. Go to http://localhost:3000/signup
2. Select "Business Owner"
3. Fill in details:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
4. Click "Create Account"

### Set Up Test Business:

1. You'll be redirected to `/onboarding`
2. Enter business details:
   - Business Name: Test MSME
   - GSTIN: 27AABCT1234L1Z5 (optional)
   - PAN: AABCT1234L (optional)
   - Business Type: Proprietorship
3. Click "Continue to Dashboard"

### Explore the Dashboard:

You'll see:
- Compliance Score dial (starts at 0%)
- Resource meters (storage & WhatsApp credits)
- Upcoming compliance tasks (auto-generated samples)
- Upgrade banner (since you're on free tier)

### Test Payment (Optional):

1. Click "Upgrade" → Go to `/pricing`
2. Select "Pro" plan
3. Click "Upgrade via UPI"
4. Razorpay checkout opens
5. Use test card: `4111 1111 1111 1111`
   - CVV: 123
   - Expiry: Any future date
6. Payment succeeds → Subscription upgraded!

## 🎯 Testing Different User Types

### Business Owner Dashboard:
- Already created above
- Access: `/dashboard-owner`

### CA Dashboard:
1. Sign out
2. Create new account
3. Select "Chartered Accountant"
4. Access: `/dashboard-ca`
5. (To add clients, you'll need to insert test data in `client_relationships` table)

## 🔧 Webhook Setup for Local Testing

To test payment webhooks locally:

### 1. Install ngrok:
```bash
npm install -g ngrok
```

### 2. Expose your local server:
```bash
# In a new terminal
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 3. Configure in Razorpay:
1. Go to Razorpay Dashboard → Settings → Webhooks
2. Create new webhook:
   - URL: `https://abc123.ngrok.io/api/webhooks/razorpay`
   - Events: Select `payment.captured`
3. Copy the Webhook Secret
4. Add to `.env.local` as `RAZORPAY_WEBHOOK_SECRET`
5. Restart your Next.js server

## 📱 Available Routes

| Route | Description | User Type |
|-------|-------------|-----------|
| `/` | Landing page | Public |
| `/signup` | Registration | Public |
| `/login` | Login | Public |
| `/onboarding` | Business setup | Business Owner |
| `/dashboard` | Redirects based on user type | Both |
| `/dashboard-owner` | MSME dashboard | Business Owner |
| `/dashboard-ca` | CA partner dashboard | CA |
| `/vault` | Document vault with audit trail | Business Owner |
| `/pricing` | Plans and payment | Both |

## 🧪 Test Data

The onboarding flow automatically creates sample compliance tasks:
- GSTR-1 (Monthly GST return)
- GSTR-3B (Summary return)
- PF Payment (Monthly contribution)

These are just samples. In production, you'd integrate with actual compliance calendars.

## 🚨 Common Issues & Fixes

### "Invalid signature" error during payment:
- Ensure `RAZORPAY_KEY_SECRET` matches your Razorpay dashboard
- Check that you're using the correct environment (test vs. live)

### Subscription not updating after payment:
- Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Verify in Supabase → Table Editor → `subscriptions`

### Webhook not receiving events:
- Ensure ngrok is running
- Check webhook URL in Razorpay dashboard
- Verify `RAZORPAY_WEBHOOK_SECRET` is correct

### Build errors:
- Run `rm -rf .next && npm run build`
- Check for TypeScript errors: `npx tsc --noEmit`

## 📖 Next Steps

1. **Read `IMPLEMENTATION_SUMMARY.md`** for architecture overview
2. **Read `RAZORPAY_SETUP.md`** for detailed payment setup
3. **Explore the codebase**:
   - `app/` - All pages and API routes
   - `components/ui/` - shadcn/ui components
   - `lib/supabase/` - Database client and types
   - `contexts/` - Auth context provider

## 🎓 Learning Resources

- **Next.js**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **Razorpay**: https://razorpay.com/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com

## 💡 Pro Tips

1. **Use React DevTools**: Install the browser extension to inspect component state
2. **Check Supabase Logs**: Monitor real-time database activity in Supabase dashboard
3. **Test Payment Webhooks**: Use Razorpay dashboard → Developers → Webhooks → Test to simulate events
4. **Use TypeScript**: The entire app is typed - leverage autocomplete in your IDE

## 🐛 Debugging

### Check Application Logs:
```bash
# Terminal where `npm run dev` is running
# Logs appear here
```

### Check Database Activity:
- Supabase Dashboard → Table Editor
- View recent inserts/updates

### Check Payment Activity:
- Razorpay Dashboard → Payments (Test Mode)
- See all test transactions

## 🚀 Ready for Production?

Before going live:
1. ✅ Complete Razorpay KYC
2. ✅ Switch to live Razorpay keys
3. ✅ Configure production webhook URL
4. ✅ Test thoroughly in staging environment
5. ✅ Deploy to Vercel/Netlify
6. ✅ Set production environment variables
7. ✅ Monitor error logs and payments

---

**You're all set! Build something amazing for Indian MSMEs. 🇮🇳**

For questions or issues, refer to the documentation or check the codebase comments.
