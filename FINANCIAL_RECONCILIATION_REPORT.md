# BAAPOO MART — FINANCIAL RECONCILIATION & COMMISSION REPORT

**Target Platform:** BAAPOO MART Financial Accounting & Commission Ledger  
**Execution Date:** October 2026  
**Auditor Role:** Financial Reconciliation Specialist & Payment Systems Architect  
**Reconciliation Status:** Fully Reconciled & 100% Balanced  

---

## 1. Unified Monetary Unit Architecture

The platform operates on a single, unambiguous monetary unit architecture:

| Domain | Entity / Model | Stored Unit | Example Value | Display Format |
|---|---|---|---|---|
| **Catalog & Cart** | `Product.price`, `Cart.items.price` | Rupees (Float/Int) | `2499` | `₹2,499.00` |
| **Order & Suborder** | `Order.grandTotal`, `VendorOrder.subtotal` | Rupees (Float/Int) | `2499` | `₹2,499.00` |
| **Commissions** | `Commission.commissionAmount` | Rupees (Float/Int) | `124.95` | `₹124.95` |
| **Vendor Ledger** | `VendorLedger.credit`, `debit`, `balanceSnapshot`| Rupees (Float/Int) | `2299.08` | `₹2,299.08` |
| **Platform Ledger** | `PlatformLedger.credit`, `debit`, `balanceSnapshot`| Rupees (Float/Int) | `124.95` | `₹124.95` |
| **Vendor Settlement** | `VendorSettlement.netPayable` | Rupees (Float/Int) | `2299.08` | `₹2,299.08` |
| **Payment Gateway** | `Payment.amount` (Internal) / Razorpay API | Paise (Integer) | `249900` | Gateway Charge: ₹2,499 |
| **Fair Coins** | `User.fairCoinBalance`, `CoinTransaction.amount`| Coins (Integer) | `1000` | 1,000 Coins (= ₹100.00) |

> **Monetary Precision Rule (`moneyUtils.js`)**: All calculations use integer-paise math internally (`toPaise` -> round/add/subtract -> `fromPaise`) to eliminate JavaScript floating-point errors (e.g., `0.1 + 0.2 === 0.30`).

---

## 2. Commission Allocation Rules & Formulas

### 2.1 The Two Invariant Commission Streams
1. **Super Admin Platform Commission**: Fixed at **5%** of the eligible product line's selling price.
2. **Direct Vendor Referral Commission**: Fixed at **3%** of the eligible product line's selling price, payable exclusively to the qualifying direct vendor referrer of the selling vendor.
3. **Selling Vendor Net Proceeds**:
   - If the selling vendor **has** a qualifying direct referrer: **92%** (`100% - 5% - 3%`).
   - If the selling vendor **does not have** a qualifying referrer: **95%** (`100% - 5% - 0%`).

### 2.2 Mathematical Balance Invariant
For every order line and vendor suborder:
$$\text{Platform Commission} + \text{Vendor Referral Commission} + \text{Selling Vendor Net Proceeds} = \text{Gross Merchandise Value (100\%)}$$

No money is created or destroyed. Unreferred vendors do not generate unallocated referral balances.

---

## 3. Mandatory Audit Test Cases (A, B, C) Validation

### Case A: ₹500 Sale with No Vendor Referrer
- **Selling Price**: ₹500
- **Platform Commission (5%)**: ₹25.00
- **Vendor Referral Commission (0%)**: ₹0.00
- **Selling Vendor Proceeds (95%)**: ₹475.00
- **Total Allocation**: $25 + 0 + 475 = 500$ (Reconciles: **100.0%**)
- **Test Result**: `[PASS] Case A: Total allocation matches ₹500`

### Case B: ₹500 Sale with Direct Vendor Referrer
- **Selling Price**: ₹500
- **Platform Commission (5%)**: ₹25.00
- **Vendor Referral Commission (3%)**: ₹15.00
- **Selling Vendor Proceeds (92%)**: ₹460.00
- **Total Allocation**: $25 + 15 + 460 = 500$ (Reconciles: **100.0%**)
- **Test Result**: `[PASS] Case B: Total allocation matches ₹500`

### Case C: ₹11,000 Sale Across Four Referred Vendors

| Vendor Suborder | Gross Sale | Platform 5% | Referral 3% | Vendor Net 92% | Reconciled Total |
|---|:---:|:---:|:---:|:---:|:---:|
| **Vendor 1** | ₹1,000.00 | ₹50.00 | ₹30.00 | ₹920.00 | ₹1,000.00 |
| **Vendor 2** | ₹2,000.00 | ₹100.00 | ₹60.00 | ₹1,840.00 | ₹2,000.00 |
| **Vendor 3** | ₹3,000.00 | ₹150.00 | ₹90.00 | ₹2,760.00 | ₹3,000.00 |
| **Vendor 4** | ₹5,000.00 | ₹250.00 | ₹150.00 | ₹4,600.00 | ₹5,000.00 |
| **Total** | **₹11,000.00** | **₹550.00** | **₹330.00** | **₹10,120.00** | **₹11,000.00** |

- **Reconciliation Audit**:
  - Total Gross Collected: ₹11,000.00
  - Total Allocated: $550 + 330 + 10,120 = \mathbf{₹11,000.00}$
  - Variance: **₹0.00**
- **Test Result**: `[PASS] Case C: Grand total reconciles to ₹11,000`

---

## 4. Vendor Settlement Hold Lifecycle (7-Day Period)

```
[Order Placed & Paid]
         │
         ▼
[VendorSettlement: PENDING_DELIVERY] ─── (Vendor Balance: Unchanged)
         │
         │ Delivery Confirmed
         ▼
[Order Status: DELIVERED]
         │
         ├─► PlatformLedger CREDIT (5% Commission recognized)
         │
         ├─► 7-Day Settlement Countdown Starts (eligibleAt = now + 7 days)
         │
         ▼
[After 7 Days (No Returns/Disputes)]
         │
         ▼
[VendorSettlement: ELIGIBLE] ─── (Balance added to Vendor withdrawable balance)
```

1. **Online & COD Orders**: Do not credit withdrawable balance on placement.
2. **Delivery Requirement**: Platform commission and settlement countdown require order delivery.
3. **Cancellation Prior to Settlement**: Sets `VendorSettlement` to `CANCELLED` / `REVERSED` and rolls back reward coins and commissions.

---

## 5. Fair Coins Accounting & Valuation Invariants

- **Conversion Rate**: 10 Fair Coins = ₹1.00 (`FAIR_COIN_CONVERSION.COINS_PER_RUPEE = 10`).
- **50% Redemption Cap**: A customer cannot fund more than 50% of the post-coupon order total using Fair Coins.
- **Double-Entry Coin Accounting**: All credits and debits must have an associated `CoinTransaction` record with opening and closing snapshots.
- **Order Cancellation**: Any reward coins issued for the purchase are debited; redeemed coins are restored to the customer's balance.

---

## 6. Super Admin Financial Dashboard Invariants

The Super Admin Analytics and Finance dashboards query the double-entry ledgers directly:
- **Gross Merchandise Value**: Sum of `Order.grandTotal` where `orderStatus != 'CANCELLED'`.
- **Paid Sales**: Sum of captured `Payment.amount` records.
- **Platform Commission Recognized**: Sum of `PlatformLedger` credit entries (`type: 'ORDER_COMMISSION'`) minus refund reversals.
- **Vendor Referral Commission**: Query of `VendorReferralCommission` records.
- **Vendor Withdrawable Liabilities**: Aggregate of `Vendor.balance` across approved vendors.
- **Reserved Withdrawal Hold**: Sum of `VendorWithdrawal` records in `PENDING` status.
- **Executed Payouts**: Sum of `VendorWithdrawal` records in `COMPLETED` status.
