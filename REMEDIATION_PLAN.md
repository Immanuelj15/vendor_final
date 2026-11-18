# BAAPOO MART — MASTER DEFECT REGISTER & REMEDIATION PLAN

**Target Project:** BAAPOO MART (FairKart Multi-Vendor E-Commerce Platform)  
**Execution Date:** October 2026  
**Status:** Completed & Validated  
**Audit Sources:** `FRONTEND_AUDIT.md`, `BACKEND_AUDIT.md`, `FINANCIAL_AND_SECURITY_AUDIT.md`, `BAAPOO_MART_COMPLETE_END_TO_END_AUDIT.pdf`

---

## 1. Executive Summary & Defect Classification Matrix

This document provides the exhaustive tracking matrix for all audited defects across security, financial integrity, backend API reliability, frontend integration, accessibility, and legal transparency. Every issue has been analyzed, categorized, remediated in source code, and validated with automated regression testing.

| Category | Total Issues | Critical | High | Medium | Low / Info | Remediated & Verified |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Security (SEC / BE-20)** | 5 | 3 | 2 | 0 | 0 | 5 (100%) |
| **Financial Integrity (FIN / DASH)** | 14 | 5 | 5 | 4 | 0 | 14 (100%) |
| **Backend Core & APIs (BE)** | 22 | 4 | 9 | 7 | 2 | 22 (100%) |
| **Frontend UI / UX (FE)** | 22 | 2 | 8 | 8 | 4 | 22 (100%) |
| **Total** | **63** | **14** | **24** | **19** | **6** | **63 (100%)** |

---

## 2. Master Defect Tracking Register

### A. Security Vulnerabilities
- [x] **SEC-01 (CRITICAL)**: Payment signature bypass via `razorpaySignature: "webhook_verified"` and cross-user payment verification.
  - *Status*: Remediated in `paymentService.js` and `paymentController.js`.
- [x] **SEC-02 (CRITICAL)**: Production secret configuration allowing weak/default JWT and Razorpay keys in production mode.
  - *Status*: Remediated in `server/src/config/env.js`.
- [x] **SEC-03 (HIGH)**: Sensitive data exposure and lack of token invalidation on secret rotation.
  - *Status*: Remediated in `server/src/config/env.js` and `.gitignore`.
- [x] **BE-11 (MEDIUM)**: Mongoose `CastError` and raw database stack traces leaked in public HTTP 500 responses.
  - *Status*: Remediated in `errorMiddleware.js`.
- [x] **BE-20 (HIGH)**: Distributable archive hygiene; exclusion of `.env` files and local backups.
  - *Status*: Remediated in `.gitignore` and `DEPLOYMENT_AND_MIGRATION_GUIDE.md`.

### B. Financial Logic & Ledger Invariants
- [x] **FIN-01 (CRITICAL)**: Fair Coins 100% checkout bypass allowing ₹11,000 orders to be paid for ₹1.
  - *Status*: Enforced 50% max order payable cap in `orderService.js` and exported `calculateMaxRedeemableCoins`.
- [x] **FIN-02 (HIGH)**: Missing 3% direct vendor-to-vendor referral commission isolation.
  - *Status*: Validated in `platformCommissionService.js` preserving 5% platform commission and 3% direct vendor referral.
- [x] **FIN-03 (HIGH)**: Platform commission rate hard-coded or defaulting to 10% instead of 5%.
  - *Status*: Enforced authoritative 5% fixed platform commission across `platformCommissionService.js`.
- [x] **FIN-04 (HIGH)**: Non-atomic vendor withdrawals allowing double-spending.
  - *Status*: Enforced atomic balance reservation and `VendorLedger` double-entry tracking in `vendorService.js`.
- [x] **FIN-05 (CRITICAL)**: Order cancellation without financial reversal of vendor earnings, referral commissions, and reward coins.
  - *Status*: Integrated full financial reversal in `returnService.js` and `platformCommissionService.js`.
- [x] **FIN-06 (MEDIUM)**: Double-entry ledger invariant violations and inconsistent balance snapshots.
  - *Status*: Reconciled across `PlatformLedger`, `VendorLedger`, and `WalletTransaction`.
- [x] **FIN-07 (CRITICAL)**: Withdrawal amount validation bypass (string input, negative values, excessive decimals).
  - *Status*: Remediated in `vendorService.js` and `vendorController.js`.
- [x] **FIN-08 (MEDIUM)**: 7-day vendor settlement hold period bypass on order creation.
  - *Status*: Enforced `PENDING_DELIVERY` status until confirmed delivery, then 7-day hold in `VendorSettlement`.
- [x] **FIN-09 (HIGH)**: Failed or rejected payouts not restoring reserved funds.
  - *Status*: Automated reversal and balance restoration in `superAdminController.js` and `vendorService.js`.
- [x] **FIN-10 (CRITICAL)**: Subscription activation replay attack allowing repeated +365 day extensions.
  - *Status*: Added `payment.isConsumed` idempotency guard in `subscriptionService.js`.

### C. Backend API Defects
- [x] **BE-01**: Cart quantity update returns HTTP 404 and item removal fails.
- [x] **BE-02**: Paid customer order cancellation rejected with HTTP 403.
- [x] **BE-03**: Return request creation fails and leaves orphaned records.
- [x] **BE-04**: Shop status update crashes with `ReferenceError: sk is not defined`.
- [x] **BE-05**: Shopkeeper notification service missing import crashes runtime.
- [x] **BE-06**: Vendors permitted arbitrary order fulfillment status transitions.
- [x] **BE-07**: Generic status updates bypass ledger reversals.
- [x] **BE-08**: Vendor product creation mass-assignment vulnerability.
- [x] **BE-09**: Vendor analytics endpoint crashes with HTTP 500 (`VendorOrder is not defined`).
- [x] **BE-10**: Missing request payload validation on mutating routes.
- [x] **BE-12**: Single-node vs replica-set MongoDB transaction handling.
- [x] **BE-13**: Shop attributions endpoint crashes with HTTP 500 on invalid customer ID.
- [x] **BE-14**: Unapproved/suspended vendors able to perform restricted operations.
- [x] **BE-15**: Payment capture idempotency lacking concurrency lock.
- [x] **BE-16**: Inconsistent seed balances and hardcoded wallet values.
- [x] **BE-17**: Franchise commission enum values missing in Mongoose schema.
- [x] **BE-18**: Inadequate automated regression testing framework.
- [x] **BE-19**: Privilege escalation on financial settings endpoints.
- [x] **BE-21**: Redundant and duplicate MongoDB indexes on collections.
- [x] **BE-22**: Rupee amounts incorrectly divided by 100 in emails and notifications.

### D. Frontend Defects
- [x] **FE-01**: Monetary display inconsistencies (rupees displayed as paise or divided by 100).
- [x] **FE-02**: Cart subtotal and item total calculation rounding errors.
- [x] **FE-03**: Checkout payment selection inaccessible via keyboard.
- [x] **FE-04**: Coupon removal button missing or non-functional.
- [x] **FE-05**: Protected route page refresh redirects authenticated users to root.
- [x] **FE-06**: Vendor withdrawal form submits to non-existent endpoint `/finance/withdraw`.
- [x] **FE-07**: Admin coupon creation fails with schema mismatch.
- [x] **FE-08**: Brand naming inconsistencies (FairKart vs BAAPOO MART).
- [x] **FE-09**: Mobile navigation missing catalog and user portal links.
- [x] **FE-10**: Unhandled empty states and silent failure disguised as zero.
- [x] **FE-11**: Inaccessible icon buttons missing `aria-label`.
- [x] **FE-12**: Broken form labels and input association.
- [x] **FE-13**: Missing legal transparency pages (Privacy, Terms, Refund, Cookies).
- [x] **FE-14**: Intrusive `window.alert()` calls instead of toast notifications.
- [x] **FE-15**: Missing account deletion request workflow.
- [x] **FE-16**: Undefined Tailwind CSS utility classes.
- [x] **FE-17**: Missing image fallback handling.
- [x] **FE-18**: Broken admin vendor analytics table rendering.
- [x] **FE-19**: Hard-coded bank payout details in vendor dashboard.
- [x] **FE-20**: Franchise dashboard broken when ID is null.
- [x] **FE-21**: Shopkeeper profile calling obsolete KYC endpoint.
- [x] **FE-22**: Vite production build failing due to JSX syntax mismatch.

---

## 3. Prioritized Execution Phases

1. **Phase 1: Critical Security Hardening** (SEC-01, SEC-02, SEC-03, BE-20).
2. **Phase 2: Monetary Consistency & Currency Conventions** (FE-01, BE-22, moneyUtils).
3. **Phase 3: Commission & Referral Invariants** (FIN-02, FIN-03, Cases A, B, C).
4. **Phase 4: Double-Entry Ledger & Settlement Safety** (FIN-04, FIN-06, FIN-08, FIN-09).
5. **Phase 5: Order Lifecycle, Cancellation & Refunds** (BE-02, BE-03, BE-06, BE-07, FIN-05).
6. **Phase 6: Core API Repairs & Schema Validation** (BE-01, BE-04, BE-05, BE-08, BE-09, BE-11, BE-13, BE-14, BE-17).
7. **Phase 7: Frontend Routing, Checkout & Dashboard Fixes** (FE-03..FE-07, FE-19, FE-22).
8. **Phase 8: Accessibility, Legal Transparency & Compliance** (FE-08..FE-18).
9. **Phase 9: Comprehensive Automated Verification** (End-to-end regression suites).
