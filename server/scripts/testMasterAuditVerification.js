import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from '../src/config/db.js';
import { platformCommissionService } from '../src/services/platformCommissionService.js';
import { paymentService } from '../src/services/paymentService.js';
import { subscriptionService } from '../src/services/subscriptionService.js';
import { vendorService } from '../src/services/vendorService.js';
import { cartService } from '../src/services/cartService.js';
import { orderService } from '../src/services/orderService.js';
import { User } from '../src/models/User.js';
import { Vendor } from '../src/models/Vendor.js';
import { Payment } from '../src/models/Payment.js';
import { Order } from '../src/models/Order.js';
import { Subscription } from '../src/models/Subscription.js';
import { SubscriptionPlan } from '../src/models/SubscriptionPlan.js';
import { Cart } from '../src/models/Cart.js';
import { Product } from '../src/models/Product.js';
import { Category } from '../src/models/Category.js';

async function runAuditValidation() {
  console.log('========================================================');
  console.log('  MASTER AUDIT REMEDIATION VERIFICATION SUITE');
  console.log('========================================================\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. FINANCIAL CASES A, B, C
    // -------------------------------------------------------------
    console.log('--- 1. COMMISSION CASES A, B, C VERIFICATION ---');
    
    // Case A: ₹500 sale with no vendor referrer
    const caseA = platformCommissionService.calculate(500, 1, false);
    assert(caseA.platformCommission === 25, `Case A: Platform commission is ₹25 (got: ${caseA.platformCommission})`);
    assert(caseA.referralCommission === 0, `Case A: Vendor referral commission is ₹0 (got: ${caseA.referralCommission})`);
    assert(caseA.vendorShare === 475, `Case A: Vendor proceeds is ₹475 (got: ${caseA.vendorShare})`);
    assert(caseA.platformCommission + caseA.referralCommission + caseA.vendorShare === 500, `Case A: Total allocation matches ₹500`);

    // Case B: ₹500 sale with direct vendor referrer
    const caseB = platformCommissionService.calculate(500, 1, true);
    assert(caseB.platformCommission === 25, `Case B: Platform commission is ₹25 (got: ${caseB.platformCommission})`);
    assert(caseB.referralCommission === 15, `Case B: Vendor referral commission is ₹15 (got: ${caseB.referralCommission})`);
    assert(caseB.vendorShare === 460, `Case B: Selling vendor proceeds is ₹460 (got: ${caseB.vendorShare})`);
    assert(caseB.platformCommission + caseB.referralCommission + caseB.vendorShare === 500, `Case B: Total allocation matches ₹500`);

    // Case C: ₹11,000 sale across 4 vendors (all referred)
    const vendorsSales = [1000, 2000, 3000, 5000];
    let totalPlatform = 0;
    let totalReferral = 0;
    let totalVendorNet = 0;

    for (const sale of vendorsSales) {
      const calc = platformCommissionService.calculate(sale, 1, true);
      totalPlatform += calc.platformCommission;
      totalReferral += calc.referralCommission;
      totalVendorNet += calc.vendorShare;
    }

    assert(totalPlatform === 550, `Case C: Total platform commission is ₹550 (got: ${totalPlatform})`);
    assert(totalReferral === 330, `Case C: Total referral commission is ₹330 (got: ${totalReferral})`);
    assert(totalVendorNet === 10120, `Case C: Total vendor net proceeds is ₹10,120 (got: ${totalVendorNet})`);
    assert(totalPlatform + totalReferral + totalVendorNet === 11000, `Case C: Grand total reconciles to ₹11,000`);

    // -------------------------------------------------------------
    // 2. SEC-01: PAYMENT VERIFICATION BYPASS & CROSS-USER REJECTION
    // -------------------------------------------------------------
    console.log('\n--- 2. SEC-01 PAYMENT VERIFICATION SECURITY ---');
    const userA = await User.create({
      name: 'User A',
      email: `usera_${Date.now()}@fairkart.local`,
      passwordHash: 'Pass12345!',
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`
    });

    const userB = await User.create({
      name: 'User B',
      email: `userb_${Date.now()}@fairkart.local`,
      passwordHash: 'Pass12345!',
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`
    });

    const testPayOrder = await Order.create({
      orderNumber: `ORD-PAY-${Date.now()}`,
      publicOrderId: `ORD-PAY-${Date.now()}`,
      userId: userA._id,
      items: [],
      subtotal: 1000,
      itemsSubtotal: 1000,
      total: 1000,
      grandTotal: 1000,
      paymentStatus: 'PENDING',
      deliveryAddressSnapshot: {
        street: '123 Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India'
      }
    });

    const testPayment = await Payment.create({
      orderId: testPayOrder._id,
      userId: userA._id,
      amount: 1000,
      currency: 'INR',
      paymentMethod: 'RAZORPAY',
      status: 'PENDING',
      transactionId: `tx_audit_${Date.now()}`,
      razorpayOrderId: `order_${Date.now()}`
    });

    // Test bypass rejection for external request
    let bypassCaught = false;
    try {
      await paymentService.verifyPaymentSignature({
        razorpayOrderId: testPayment.razorpayOrderId,
        razorpayPaymentId: `pay_${Date.now()}`,
        razorpaySignature: 'webhook_verified',
        requestingUser: userA
      });
    } catch (err) {
      bypassCaught = true;
      assert(err.statusCode === 400, `Rejected "webhook_verified" bypass with 400 (${err.message})`);
    }
    assert(bypassCaught, 'Prohibited external bypass "webhook_verified"');

    // Test cross-user verification rejection
    let crossUserCaught = false;
    try {
      await paymentService.verifyPaymentSignature({
        razorpayOrderId: testPayment.razorpayOrderId,
        razorpayPaymentId: `pay_${Date.now()}`,
        razorpaySignature: 'valid_looking_signature',
        requestingUser: userB
      });
    } catch (err) {
      crossUserCaught = true;
      assert(err.statusCode === 403, `Cross-user verification rejected with 403 (${err.message})`);
    }
    assert(crossUserCaught, 'Customer cannot verify another customer\'s payment');

    // -------------------------------------------------------------
    // 3. FIN-01: FAIR COINS REDEMPTION CAP
    // -------------------------------------------------------------
    console.log('\n--- 3. FIN-01 FAIR COINS 50% REDEMPTION CAP ---');
    // 10 Fair Coins = ₹1
    // For a ₹1000 order, max discount allowed is 50% = ₹500 (5,000 coins).
    // Requesting 8000 coins (₹800) should be capped to 5000 coins (₹500).
    const cappedCoins = orderService.calculateMaxRedeemableCoins({
      netPayableRupees: 1000,
      availableCoins: 10000,
      requestedCoins: 8000
    });
    assert(cappedCoins.coinsToRedeem === 5000, `Fair coins capped at 50% max order value (5000 coins = ₹500, got: ${cappedCoins.coinsToRedeem})`);
    assert(cappedCoins.discountRupees === 500, `Discount correctly equals ₹500 (got: ${cappedCoins.discountRupees})`);

    // -------------------------------------------------------------
    // 4. FIN-07 & BE-14: VENDOR WITHDRAWAL HARDENING
    // -------------------------------------------------------------
    console.log('\n--- 4. FIN-07 & BE-14 VENDOR WITHDRAWAL HARDENING ---');
    const pendingVendor = await Vendor.create({
      userId: userB._id,
      storeName: 'Pending Store',
      slug: `pending-store-${Date.now()}`,
      status: 'PENDING',
      balance: 10000
    });

    // Rejection of non-approved vendor
    let unapprovedCaught = false;
    try {
      await vendorService.requestWithdrawal(pendingVendor._id, 1000, { bankName: 'HDFC', accountNumber: '123' });
    } catch (err) {
      unapprovedCaught = true;
      assert(err.statusCode === 403, `Non-approved vendor withdrawal rejected with 403 (${err.message})`);
    }
    assert(unapprovedCaught, 'Only APPROVED vendors can request withdrawals');

    // Test invalid amount inputs
    pendingVendor.status = 'APPROVED';
    await pendingVendor.save();

    let invalidAmountCaught = false;
    try {
      await vendorService.requestWithdrawal(pendingVendor._id, 'one thousand', { bankName: 'HDFC', accountNumber: '123' });
    } catch (err) {
      invalidAmountCaught = true;
    }
    assert(invalidAmountCaught, 'String withdrawal amount rejected');

    let excessiveDecimalsCaught = false;
    try {
      await vendorService.requestWithdrawal(pendingVendor._id, 100.999, { bankName: 'HDFC', accountNumber: '123' });
    } catch (err) {
      excessiveDecimalsCaught = true;
    }
    assert(excessiveDecimalsCaught, 'Amount with >2 decimal places rejected');

    // -------------------------------------------------------------
    // 5. FIN-10: SUBSCRIPTION REPLAY PROTECTION
    // -------------------------------------------------------------
    console.log('\n--- 5. FIN-10 SUBSCRIPTION REPLAY PROTECTION ---');
    const subPlan = await SubscriptionPlan.create({
      name: `Gold Plan ${Date.now()}`,
      code: `PLAN_GOLD_${Date.now()}`,
      applicableEntityType: 'SHOPKEEPER',
      monthlyPrice: 99,
      yearlyPrice: 999,
      isActive: true
    });

    const testSubscription = await Subscription.create({
      ownerUserId: userA._id,
      entityType: 'SHOPKEEPER',
      entityId: userA._id,
      planId: subPlan._id,
      billingCycle: 'YEARLY',
      amount: 999,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 86400000),
      status: 'PENDING'
    });

    const subPayment = await Payment.create({
      userId: userA._id,
      subscriptionId: testSubscription._id,
      amount: 999,
      currency: 'INR',
      paymentMethod: 'RAZORPAY',
      status: 'CAPTURED',
      transactionId: `tx_sub_${Date.now()}`,
      razorpayPaymentId: `pay_sub_${Date.now()}`
    });

    // First activation succeeds
    const sub1 = await subscriptionService.activateSubscription(testSubscription._id, subPayment._id);
    assert(sub1 !== null && sub1.status === 'ACTIVE', 'Subscription successfully activated on first payment verification');
    const initialEndDate = new Date(sub1.endDate).getTime();

    // Second activation replay with same consumed payment cannot extend end date
    const subReplay = await subscriptionService.activateSubscription(testSubscription._id, subPayment._id);
    const replayedEndDate = new Date(subReplay.endDate).getTime();
    assert(initialEndDate === replayedEndDate, 'Replay of consumed payment did NOT extend subscription endDate');

    // Attempting to activate another subscription using this already-consumed payment must be rejected
    const testSubscription2 = await Subscription.create({
      ownerUserId: userA._id,
      entityType: 'SHOPKEEPER',
      entityId: userA._id,
      planId: subPlan._id,
      billingCycle: 'YEARLY',
      amount: 999,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 86400000),
      status: 'PENDING'
    });

    let replayCaught = false;
    try {
      await subscriptionService.activateSubscription(testSubscription2._id, subPayment._id);
    } catch (err) {
      replayCaught = true;
      assert(err.statusCode === 400, `Replay of consumed payment on another subscription rejected with 400 (${err.message})`);
    }
    assert(replayCaught, 'Payment ID replay for another subscription activation rejected');

    // -------------------------------------------------------------
    // 6. BE-01 & FE-04: CART ITEM & COUPON REMOVAL
    // -------------------------------------------------------------
    console.log('\n--- 6. BE-01 & FE-04 CART & COUPON REMOVAL ---');
    let testCat = await Category.findOne({ status: 'ACTIVE' });
    if (!testCat) {
      testCat = await Category.create({
        name: 'Test Category',
        slug: `test-cat-${Date.now()}`
      });
    }

    const cartProduct = await Product.create({
      name: 'Cart Test Product',
      sku: `SKU-CART-${Date.now()}`,
      slug: `cart-prod-${Date.now()}`,
      categoryId: testCat._id,
      price: 499,
      mrp: 699,
      stock: 50,
      approvalStatus: 'APPROVED',
      status: 'ACTIVE'
    });

    // Add item to cart
    await cartService.addToCart(userA._id, {
      productId: cartProduct._id.toString(),
      quantity: 3
    });

    // Update quantity to 5
    const cartUpdated = await cartService.updateQuantity(userA._id, {
      productId: cartProduct._id.toString(),
      quantity: 5
    });
    const updatedItem = cartUpdated.items.find(i => String(i.productId?._id || i.productId) === cartProduct._id.toString());
    assert(updatedItem && updatedItem.quantity === 5, `Cart quantity updated to 5 (got: ${updatedItem?.quantity})`);

    // Remove coupon
    const cartWithoutCoupon = await cartService.removeCoupon(userA._id);
    assert(cartWithoutCoupon.couponCode === null || cartWithoutCoupon.couponCode === undefined, 'Coupon removed successfully from cart');

    // Remove item (quantity = 0)
    const cartAfterRemoval = await cartService.updateQuantity(userA._id, {
      productId: cartProduct._id.toString(),
      quantity: 0
    });
    const removedItem = cartAfterRemoval.items.find(i => String(i.productId?._id || i.productId) === cartProduct._id.toString());
    assert(!removedItem, 'Setting quantity to 0 removes item from cart');

    console.log('\n========================================================');
    console.log(`  AUDIT VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

  } catch (err) {
    console.error('Fatal error during audit validation:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runAuditValidation();
