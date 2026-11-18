# BAAPOO MART — DEPLOYMENT, MIGRATION & OPERATIONAL GUIDE

**Target Platform:** BAAPOO MART (FairKart Multi-Vendor E-Commerce Platform)  
**Execution Date:** October 2026  
**Audience:** DevOps Engineers, Platform Architects, Full-Stack Developers  

---

## 1. System Architecture & Prerequisites

### 1.1 Technology Stack
- **Frontend**: React 18, Vite 5, Tailwind CSS 3, Redux Toolkit, React Router 6.
- **Backend**: Node.js 18+ / 20+ LTS, Express.js 4, Mongoose 8.
- **Database**: MongoDB 6.0+ (Replica Set recommended for production).
- **Payment Gateway**: Razorpay (Webhooks + API signature verification).

---

## 2. Environment Configuration

### 2.1 Backend Environment Variables (`server/.env`)
Create `server/.env` based on `server/.env.example`:

```env
NODE_ENV=production
PORT=5000
CLIENT_URL=https://baapoomart.com

# MongoDB URI (Replica Set connection string)
MONGODB_URI=mongodb://user:password@node1:27017,node2:27017,node3:27017/fairkart?replicaSet=rs0&authSource=admin

# JWT Authentication (Min 32 characters, non-default)
JWT_SECRET=super_strong_random_jwt_secret_at_least_32_characters_long_12345
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# Razorpay Production Credentials
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx

# SMTP Email Service
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM="BAAPOO MART <orders@baapoomart.com>"
```

### 2.2 Frontend Environment Variables (`client/.env`)
```env
VITE_API_URL=https://api.baapoomart.com/api
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
```

---

## 3. Database Migrations & Replica Set Setup

### 3.1 Enabling Replica Set on Standalone MongoDB (Linux / Docker)
If using Docker or self-hosted MongoDB, convert standalone instance to a single-node replica set to enable native transactions:
```bash
# In mongod.conf:
replication:
  replSetName: rs0

# In mongosh:
rs.initiate()
```

### 3.2 Running Database Reconciliations & Seed Verification
Before initiating live traffic, execute the idempotent database audit scripts:
```bash
cd server
# 1. Audit schema indexes and compound unique constraints
node scripts/auditDatabaseIntegrity.js

# 2. Reconcile ledger balances against historical vendor orders
node scripts/reconcileFinancials.js
```

---

## 4. Pre-Deployment Validation Checklist

Before switching traffic to the production cluster, run the automated verification suites:

```bash
# 1. Verify all master audit fixes (Security, Commissions, Cap, Subscriptions)
cd server
node scripts/testMasterAuditVerification.js
# Expected output: AUDIT VALIDATION RESULTS: 29 PASSED, 0 FAILED

# 2. Verify complete end-to-end ledger and lifecycle invariants
node scripts/verifyAllFixesE2E.js
# Expected output: VERIFICATION RESULTS: 34 PASSED, 0 FAILED

# 3. Test Vite Production Frontend Build
cd ../client
npm run build
# Expected output: ✓ built in ~15s, dist/ created without errors
```

---

## 5. Razorpay Webhook Configuration

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Navigate to **Settings** -> **Webhooks** -> **Add New Webhook**.
3. **Webhook URL**: `https://api.baapoomart.com/api/payments/webhook`
4. **Secret**: Enter a cryptographically secure string matching `RAZORPAY_WEBHOOK_SECRET`.
5. **Active Events**:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - `refund.created`
   - `refund.processed`
6. Save and send a test ping to verify endpoint connectivity.

---

## 6. Backup & Rollback Strategy

1. **Automated Daily Backups**:
   ```bash
   mongodump --uri="mongodb://..." --archive="/backups/fairkart_$(date +%Y%m%d).gz" --gzip
   ```
2. **Point-In-Time Rollback**:
   In the event of an unrecoverable operational failure:
   ```bash
   mongorestore --uri="mongodb://..." --archive="/backups/fairkart_pre_migration.gz" --gzip --drop
   ```
3. **Zero Data Loss Guarantee**: All ledger tables (`PlatformLedger`, `VendorLedger`, `WalletTransaction`, `CoinTransaction`) are append-only; adjustments must be made using compensating credit/debit records rather than table deletions.
