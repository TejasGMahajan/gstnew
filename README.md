# ComplianceHub - Compliance Operating System for Indian MSMEs

A comprehensive, production-ready SaaS platform for managing tax and regulatory compliance in India. Built specifically for MSMEs, Chartered Accountants, and the Indian statutory compliance ecosystem.

## 🚀 Quick Start

**Get started in 5 minutes:**

```bash
npm install
# Configure .env.local (see QUICK_START.md)
npm run dev
```

📖 **Read the [Quick Start Guide](./QUICK_START.md)** for detailed setup instructions.

## 📚 Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 5 minutes
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Complete architecture overview
- **[Razorpay Setup Guide](./RAZORPAY_SETUP.md)** - Payment integration instructions

## ✨ Key Features

### 1. Habit-Forming MSME Owner Dashboard
- **Compliance Score**: Prominent radial dial showing overall health (0-100%)
- **Smart Resource Meters**:
  - Vault Storage tracker with visual progress
  - WhatsApp Alert Credits meter
- **Compliance Timeline**: Vertical timeline with color-coded deadlines
  - Green: Completed | Yellow: Pending | Red: Overdue
- **Upgrade Hooks**: Sticky banner for free-tier users
- **One-Click UPI Payments**: Seamless Razorpay integration

### 2. CA Partner Dashboard (B2B2B Growth Engine)
- **Client Roster**: Manage multiple MSME clients with compliance scores
- **Reality-Based Workflow**: 4-step process per task:
  1. Request documents (WhatsApp notification)
  2. Review & edit data (JSON editor for professional judgment)
  3. Export for government portals (GST/MCA/EPFO)
  4. Upload acknowledgement (auto-completes task)
- **Portfolio Analytics**: Total clients, pending tasks, average compliance

### 3. Document Vault with Legal Audit Trail
- **Auto-Organized Folders**: GST, PF, ROC, Invoices
- **Audit History**: Complete chronological log for every document
  - User attribution
  - Old vs. New value comparison
  - Timestamped actions
  - Immutable legal protection

### 4. Monetization & Subscription Hub
**Three-Tier Pricing:**
- **Free Forever**: Proprietorships (100MB, email alerts)
- **Pro** (₹999/year): LLPs (2GB, WhatsApp/SMS, 500 credits)
- **Enterprise** (₹2,999/year): Pvt Ltd (10GB, unlimited, multi-user)

**Micro-Transactions:**
- 500 WhatsApp credits for ₹200
- 10GB storage expansion for ₹300

### 5. Secure Payment Integration
- **Razorpay**: UPI-first checkout experience
- **Annual & Quarterly**: No monthly subscriptions
- **Signature Verification**: All payments cryptographically verified
- **Webhook Backup**: Automatic payment confirmation

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Next.js 13 (App Router), React, TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL) with Row-Level Security
- **Authentication**: Supabase Auth (email/password)
- **Payments**: Razorpay (UPI, cards, wallets)
- **Icons**: Lucide React
- **Date Handling**: date-fns

### Color Scheme (Professional & Trustworthy)

- **Primary**: Navy blue (#1e3a8a - blue-900)
- **Accent**: Crisp white (#ffffff)
- **Success**: Green (#22c55e - green-600)
- **Warning**: Yellow (#eab308 - yellow-600)
- **Error**: Red (#ef4444 - red-600)

## 📊 Database Schema

### Core Tables

1. **profiles** - User info (business_owner / chartered_accountant)
2. **businesses** - MSME details with compliance scores
3. **subscriptions** - Plan management (free/pro/enterprise) with Razorpay data
4. **compliance_tasks** - Statutory deadlines with CA editing support
5. **documents** - Vault metadata with categories
6. **audit_logs** - Legal protection trail (immutable history)
7. **whatsapp_credits** - Notification credit tracking
8. **storage_usage** - Vault capacity monitoring
9. **client_relationships** - CA-to-business connections

**All tables have Row-Level Security (RLS) with restrictive policies.**

## 📱 Available Routes

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Landing page | Public |
| `/signup` | Registration with role selection | Public |
| `/login` | Authentication | Public |
| `/onboarding` | Business setup wizard | Business Owners |
| `/dashboard` | Auto-redirects by user type | Both |
| `/dashboard-owner` | MSME compliance dashboard | Business Owners |
| `/dashboard-ca` | CA partner portfolio | Chartered Accountants |
| `/vault` | Document vault with audit trail | Business Owners |
| `/pricing` | Plans & payment | Both |

## 🔒 Security Highlights

- **RLS Everywhere**: All tables locked down by default
- **Signature Verification**: Razorpay payments cryptographically verified
- **Audit Trail**: Every action logged with user attribution
- **Service Role Key**: Used only server-side for privileged operations
- **No Exposed Secrets**: All credentials server-side only

## 🎯 Monetization Model

**Subscription Revenue:**
- Free → Pro: ₹999/year (target: LLPs)
- Free → Enterprise: ₹2,999/year (target: Pvt Ltd companies)
- Pro → Enterprise: Upsell path

**Transaction Revenue:**
- WhatsApp credit top-ups: ₹200 per 500 credits
- Storage expansions: ₹300 per 10GB

**B2B2B Growth:**
- CAs bring their client roster
- Businesses invite their CA partners
- Network effects drive adoption

## 🛠️ Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Razorpay (Test Mode)
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxx
```

**See [RAZORPAY_SETUP.md](./RAZORPAY_SETUP.md) for complete instructions.**

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Netlify

Already configured with `netlify.toml`!

## 🧪 Testing

### Test Accounts

**Business Owner:**
- Email: owner@test.com
- Type: Proprietorship (shows upgrade banner)

**Chartered Accountant:**
- Email: ca@test.com
- Access CA dashboard with client roster

### Test Payments

Razorpay test cards:
- Success: `4111 1111 1111 1111`
- Failed: `4000 0000 0000 0002`
- UPI: `success@razorpay`

CVV: Any 3 digits | Expiry: Any future date

## 📈 Future Roadmap

**Phase 1 (Current)**:
- ✅ Core compliance tracking
- ✅ CA workflow tools
- ✅ Payment integration
- ✅ Audit trails

**Phase 2 (Q2 2026)**:
- WhatsApp notifications (Twilio/Gupshup)
- Document upload (Supabase Storage)
- Email reminders
- CA-client invitations

**Phase 3 (Q3 2026)**:
- Mobile app (React Native)
- Analytics dashboard
- Bulk task templates
- API for integrations

**Phase 4 (Q4 2026)**:
- AI-powered deadline predictions
- OCR for document extraction
- Multi-language support
- Government portal integrations

## 🤝 Contributing

This is a production SaaS application. For contributions:
1. Fork the repository
2. Create a feature branch
3. Test thoroughly
4. Submit a pull request

## 📞 Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Email**: support@compliancehub.in (example)

## 📜 License

Proprietary - All rights reserved

---

**Built with attention to detail for Indian MSMEs. 🇮🇳**

_Tech Stack: Next.js 13 • TypeScript • Supabase • Razorpay • Tailwind CSS • shadcn/ui_
