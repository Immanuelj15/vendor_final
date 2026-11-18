# BAAPOO MART — SECURITY RETEST & HARDENING REPORT

**Target Platform:** BAAPOO MART Application & API Layer  
**Execution Date:** October 2026  
**Security Role:** Application Security Engineer & Payment Systems Auditor  
**Audit Findings Addressed:** `SEC-01`, `SEC-02`, `SEC-03`, `BE-11`, `BE-14`, `BE-19`, `BE-20`  
**Security Status:** Hardened & Verified  

---

## 1. Summary of Vulnerability Remediation

| Vulnerability ID | Title | CVSS Severity | Remediation Summary | Retest Status |
|---|---|---|---|:---:|
| **SEC-01** | Payment Signature Bypass | **Critical (9.8)** | Removed `webhook_verified` bypass for HTTP callers; enforced order ownership; bound gateway amount to order paise. | **REMEDIATED & VERIFIED** |
| **SEC-02** | Weak Production Secrets | **Critical (9.1)** | Process halts on startup in production if JWT secret is weak/default or Razorpay keys are missing. | **REMEDIATED & VERIFIED** |
| **SEC-03** | Secret Exposure & Token Revocation | **High (7.5)** | Added `.env*` to `.gitignore`; documented key rotation; removed fallbacks. | **REMEDIATED & VERIFIED** |
| **BE-11** | Information Disclosure & Stack Leaks | **Medium (5.3)** | Mongoose `CastError` mapped to HTTP 400; duplicate keys mapped to 409; stack traces suppressed. | **REMEDIATED & VERIFIED** |
| **BE-14** | Privilege Escalation / Unapproved Vendor Ops | **High (7.2)** | Enforced `vendor.status === 'APPROVED'` on withdrawals, product publishing, and catalog mutation. | **REMEDIATED & VERIFIED** |
| **BE-19** | Financial Config Authorization | **High (7.8)** | Restricted commission and platform settings exclusively to authenticated `SUPER_ADMIN` role. | **REMEDIATED & VERIFIED** |
| **BE-20** | Distributable Archive Secrets | **Medium (6.5)** | Ensured `.env` files and local database backups are excluded from version control and release archives. | **REMEDIATED & VERIFIED** |

---

## 2. In-Depth Security Analysis & Implementation

### 2.1 SEC-01: Payment Verification Hardening
- **Attack Vector**: An attacker could craft an HTTP POST to `/api/payments/verify`:
  ```json
  {
    "razorpayOrderId": "order_xyz",
    "razorpayPaymentId": "pay_fake123",
    "razorpaySignature": "webhook_verified"
  }
  ```
  The legacy system checked `if (signature === 'webhook_verified')` and marked the payment as `CAPTURED` without contacting Razorpay or computing HMAC-SHA256 signatures. Furthermore, any logged-in user could verify any other customer's order ID.
- **Remediation**:
  1. In `paymentService.verifyPaymentSignature()`:
     ```javascript
     if (razorpaySignature === 'webhook_verified' && !options.isInternalWebhook) {
       throw new ApiError(400, 'Invalid payment signature', ERROR_CODES.BAD_REQUEST);
     }
     ```
  2. Enforced caller authorization:
     ```javascript
     if (requestingUser && payment.userId.toString() !== requestingUser._id.toString()) {
       throw new ApiError(403, 'Unauthorized to verify payment for this order', ERROR_CODES.FORBIDDEN);
     }
     ```
  3. Validated HMAC signature against `env.RAZORPAY_KEY_SECRET`.
  4. Verified that the payment amount equals the exact order amount in paise.

### 2.2 SEC-02 & SEC-03: Production Secret Enforcement
- **Remediation**:
  In `server/src/config/env.js`:
  ```javascript
  const defaultSecrets = [
    'dev_jwt_secret_change_in_production',
    'secret',
    'changeme',
    'jwt_secret',
    'default_secret'
  ];

  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || defaultSecrets.includes(process.env.JWT_SECRET)) {
      throw new Error('[Security Error] In production, JWT_SECRET must be set to a strong secret of at least 32 characters.');
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('[Security Error] Real Razorpay credentials and webhook secret are required in production.');
    }
  }
  ```

### 2.3 BE-11: Public Error Sanitization & CastError Handling
- **Remediation**:
  In `server/src/middleware/errorMiddleware.js`:
  ```javascript
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ID_FORMAT',
      message: `Invalid identifier format for ${err.path}: ${err.value}`,
    });
  }
  ```
  Stack traces are conditionally omitted based on environment, preventing internal schema, paths, and server architecture leakage.

---

## 3. Automated Security Regression Results

From `node scripts/testMasterAuditVerification.js`:
```text
--- 2. SEC-01 PAYMENT VERIFICATION SECURITY ---
  [PASS] Rejected "webhook_verified" bypass with 400 (Invalid payment signature)
  [PASS] Prohibited external bypass "webhook_verified"
  [PASS] Cross-user verification rejected with 403 (Unauthorized to verify payment for this order)
  [PASS] Customer cannot verify another customer's payment

--- 4. FIN-07 & BE-14 VENDOR WITHDRAWAL HARDENING ---
  [PASS] Non-approved vendor withdrawal rejected with 403 (Only approved vendors can request withdrawals)
  [PASS] Only APPROVED vendors can request withdrawals
  [PASS] String withdrawal amount rejected
  [PASS] Amount with >2 decimal places rejected

--- 5. FIN-10 SUBSCRIPTION REPLAY PROTECTION ---
  [PASS] Subscription successfully activated on first payment verification
  [PASS] Replay of consumed payment did NOT extend subscription endDate
  [PASS] Replay of consumed payment on another subscription rejected with 400
  [PASS] Payment ID replay for another subscription activation rejected
```
All critical vulnerabilities have been successfully remediated and verified.
