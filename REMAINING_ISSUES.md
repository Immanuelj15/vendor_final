# BAAPOO MART — REMAINING ISSUES, EXTERNAL BLOCKERS & POLICY DECISIONS

**Target Platform:** BAAPOO MART  
**Execution Date:** October 2026  
**Document Status:** Action Items for Stakeholder Review  

---

## 1. External Third-Party Dependencies & Production Credentials

The application code is fully remediated and safe. However, actual production operation requires the deployment of live credentials and third-party provider accounts that cannot be provisioned purely at the code level:

### 1.1 Live Payment Gateway (Razorpay)
- **Status**: Tested and verified in sandbox / test mode.
- **Blocker**: Production activation requires live merchant KYC approval from Razorpay.
- **Required Environment Variables**:
  - `RAZORPAY_KEY_ID`: Live Production Key (starts with `rzp_live_...`)
  - `RAZORPAY_KEY_SECRET`: Live Production Secret
  - `RAZORPAY_WEBHOOK_SECRET`: Configured in the Razorpay Merchant Dashboard pointing to `https://<domain>/api/payments/webhook`

### 1.2 Live SMS Gateway & WhatsApp API
- **Status**: Local logger and mock simulator implemented.
- **Blocker**: Sending real OTP SMS / WhatsApp order confirmations to customers requires a registered DLT entity and template approval in India (e.g., via MSG91, Twilio, or Fast2SMS).
- **Required Action**: Configure `SMS_GATEWAY_API_KEY`, `SMS_SENDER_ID`, and approved DLT template IDs.

### 1.3 Cloud Object Storage (AWS S3 / Cloudinary)
- **Status**: Local uploads and static fallbacks supported.
- **Blocker**: Production multi-image catalog storage requires an AWS S3 bucket or Cloudinary account.
- **Required Environment Variables**:
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` (or `CLOUDINARY_URL`).

---

## 2. Business Policy Decisions Requiring Formal Stakeholder Approval

| Policy Topic | Current Remediated Rule | Alternative Options | Stakeholder Action |
|---|---|---|:---:|
| **Fair Coins Redemption Cap** | Max 50% of payable order total can be paid using Fair Coins | 20%, 30%, or tiered caps by product category | Approve 50% cap or define category exceptions |
| **Vendor Settlement Hold** | 7 days post confirmed delivery | 3 days, 14 days, or immediate for trusted vendors | Approve standard 7-day return window hold |
| **Vendor Direct Referral Duration** | Perpetual 3% referral commission on eligible sales | 1 year from vendor registration or milestone-capped | Confirm perpetual single-level 3% model |
| **Minimum Withdrawal Amount** | Minimum ₹500.00 per withdrawal | ₹100, ₹1,000, or custom by tier | Confirm minimum withdrawal threshold |
| **Platform Branding Consistency** | Standardized to **BAAPOO MART** across title, nav, and UI | Keep FairKart or transition gradually | Confirm full brand transition |

---

## 3. Database Infrastructure Recommendation

- **Current Environment**: Single-node standalone MongoDB (`127.0.0.1:27017`).
  - Single-node transactions are safely stubbed via `src/config/db.js` so that atomicity checks and single-document atomic operators (`$inc`, conditional updates) function correctly.
- **Production Recommendation**:
  - Deploy a **3-node MongoDB Replica Set** (e.g., MongoDB Atlas M10+ or self-hosted 3-node replica set).
  - This enables native distributed multi-document ACID transactions (`session.startTransaction()`) across orders, settlements, and commissions.
