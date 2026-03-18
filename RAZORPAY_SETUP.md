# Razorpay Integration Setup Guide

This guide explains how to set up Razorpay payment integration for ComplianceHub's subscription and monetization system.

## Overview

The system supports:
- Annual and Quarterly subscription plans (NO monthly subscriptions)
- Three tier architecture: Free, Pro (₹999/year), Enterprise (₹2,999/year)
- Micro-transactions for WhatsApp credits and storage top-ups
- UPI-first payment experience
- Secure webhook verification for payment confirmations

## Prerequisites

1. **Razorpay Account**: Sign up at [https://razorpay.com](https://razorpay.com)
2. **Test Mode Credentials**: Use test mode for development
3. **Supabase Project**: Already configured with subscriptions table

## Step 1: Get Razorpay Credentials

### For Test Mode (Development)

1. Log in to your Razorpay Dashboard
2. Go to **Settings** → **API Keys**
3. Under **Test Mode**, you'll find:
   - **Key ID**: Starts with `rzp_test_`
   - **Key Secret**: Click "Generate Key" if you haven't already

### For Production Mode

1. Complete KYC verification on Razorpay
2. Activate your account
3. Go to **Settings** → **API Keys**
4. Switch to **Live Mode** and generate live keys
   - **Key ID**: Starts with `rzp_live_`
   - **Key Secret**: Keep this absolutely secure!

## Step 2: Configure Environment Variables

Add these variables to your `.env.local` file (create it if it doesn't exist):

```env
# Supabase Configuration (Already configured)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Razorpay Configuration (Test Mode)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### Important Notes:

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: This is public and safe to expose in the frontend
- `RAZORPAY_KEY_SECRET`: Keep this SECRET. Never commit to git or expose to frontend
- `RAZORPAY_WEBHOOK_SECRET`: Generated when setting up webhooks (see Step 3)
- `SUPABASE_SERVICE_ROLE_KEY`: Required to bypass RLS when updating subscriptions

## Step 3: Set Up Webhooks

Webhooks allow Razorpay to notify your application when payments are successful.

### Local Development (Using ngrok or similar)

1. Install ngrok: `npm install -g ngrok`
2. Start your Next.js app: `npm run dev`
3. In a new terminal, expose your local server: `ngrok http 3000`
4. Copy the HTTPS URL (e.g., `https://abcd1234.ngrok.io`)

### Configure Webhook in Razorpay Dashboard

1. Go to **Settings** → **Webhooks**
2. Click **Create New Webhook**
3. Enter webhook URL: `https://your-domain.com/api/webhooks/razorpay`
   - For local: `https://abcd1234.ngrok.io/api/webhooks/razorpay`
4. Select events to listen to:
   - ✅ `payment.captured`
5. Click **Create Webhook**
6. Copy the **Webhook Secret** and add it to `.env.local` as `RAZORPAY_WEBHOOK_SECRET`

## Step 4: Test the Integration

### Testing Subscriptions

1. Start your application: `npm run dev`
2. Log in as a business owner
3. Navigate to `/pricing`
4. Click "Upgrade via UPI" on any paid plan
5. Razorpay checkout modal will open

### Test Card Numbers (Test Mode Only)

Razorpay provides test cards for different scenarios:

**Successful Payment:**
- Card: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- Name: Any name

**Failed Payment:**
- Card: `4000 0000 0000 0002`
- CVV: Any 3 digits
- Expiry: Any future date

**UPI Testing:**
- VPA: `success@razorpay`

### Verify Payment Flow

After successful test payment:

1. Check browser console for success message
2. Verify in Supabase:
   - `subscriptions` table should show updated `plan_type` and `status: 'active'`
   - `razorpay_payment_id` and `razorpay_order_id` should be populated
3. Check Razorpay Dashboard → **Payments** to see the test transaction

## Step 5: Production Deployment

### Before Going Live:

1. **Complete Razorpay KYC**: Submit all required documents
2. **Get Live Credentials**: Switch to Live mode in Razorpay Dashboard
3. **Update Environment Variables**:
   ```env
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXX
   RAZORPAY_KEY_SECRET=your_live_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_live_webhook_secret
   ```
4. **Configure Production Webhook**:
   - Use your production domain: `https://yourdomain.com/api/webhooks/razorpay`
5. **Test thoroughly** in production environment

## Architecture Overview

### Frontend Flow (`/app/pricing/page.tsx`)

1. User clicks "Upgrade via UPI"
2. Frontend calls `/api/razorpay/create-order` with plan details
3. Razorpay Checkout modal opens
4. User completes payment
5. On success, frontend calls `/api/razorpay/verify-payment`
6. Subscription updated in Supabase

### Backend Routes

**`/api/razorpay/create-order`**
- Creates Razorpay order with amount and business metadata
- Returns order ID for checkout modal

**`/api/razorpay/verify-payment`**
- Verifies payment signature for security
- Updates subscription in Supabase using Service Role Key
- Updates WhatsApp credits and storage limits based on plan

**`/api/webhooks/razorpay`**
- Receives webhook events from Razorpay
- Verifies webhook signature
- Updates subscription as backup to frontend verification
- Provides audit trail

## Security Best Practices

1. **Never expose secrets**: Keep `RAZORPAY_KEY_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` server-side only
2. **Always verify signatures**: Both payment verification and webhooks use signature verification
3. **Use HTTPS in production**: Required for PCI compliance
4. **Validate amounts**: Always verify the payment amount matches expected plan price
5. **Audit logs**: All subscription changes are logged in `audit_logs` table

## Database Schema

### Subscriptions Table
```sql
- id: UUID (primary key)
- business_id: UUID (references businesses)
- plan_type: 'free' | 'pro' | 'enterprise'
- status: 'active' | 'inactive' | 'cancelled'
- billing_cycle: 'annual' | 'quarterly'
- amount_paid: Numeric
- razorpay_customer_id: Text (nullable)
- razorpay_order_id: Text (nullable)
- razorpay_payment_id: Text (nullable)
- start_date: Timestamp
- end_date: Timestamp
- created_at: Timestamp
- updated_at: Timestamp
```

## Troubleshooting

### Payment Modal Not Opening

**Issue**: Razorpay script not loaded
**Solution**: Check browser console. Ensure Razorpay script loads successfully from CDN.

### "Invalid Signature" Error

**Issue**: Webhook secret mismatch
**Solution**:
1. Copy webhook secret exactly from Razorpay dashboard
2. Update `RAZORPAY_WEBHOOK_SECRET` in `.env.local`
3. Restart Next.js server

### Subscription Not Updating

**Issue**: RLS blocking update
**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly. This key bypasses RLS.

### Testing Webhooks Locally

**Issue**: Razorpay can't reach localhost
**Solution**: Use ngrok or similar tool to expose your local server:
```bash
ngrok http 3000
# Use the HTTPS URL in Razorpay webhook settings
```

## Support Resources

- **Razorpay Documentation**: https://razorpay.com/docs/
- **Razorpay Test Cards**: https://razorpay.com/docs/payments/payments/test-card-details/
- **Razorpay Dashboard**: https://dashboard.razorpay.com/
- **Supabase Documentation**: https://supabase.com/docs

## Contact

For integration issues, contact:
- Razorpay Support: support@razorpay.com
- Refer to Razorpay docs for technical implementation details

---

## Quick Checklist

- [ ] Razorpay account created
- [ ] Test mode API keys obtained
- [ ] Environment variables configured in `.env.local`
- [ ] Webhook URL configured in Razorpay dashboard
- [ ] Webhook secret added to environment variables
- [ ] Test payment successful
- [ ] Subscription updated in Supabase
- [ ] Audit log created
- [ ] Ready for production deployment
