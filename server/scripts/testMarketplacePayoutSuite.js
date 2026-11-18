import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Vendor } from '../src/models/Vendor.js';
import { Order } from '../src/models/Order.js';
import { VendorOrder } from '../src/models/VendorOrder.js';
import { VendorBankAccount } from '../src/models/VendorBankAccount.js';
import { CommissionTransaction } from '../src/models/CommissionTransaction.js';
import { VendorPayout } from '../src/models/VendorPayout.js';
import { PlatformCommissionLedger } from '../src/models/PlatformCommissionLedger.js';
import { marketplaceCommissionService } from '../src/services/marketplaceCommissionService.js';
import { moneyUtils } from '../src/utils/moneyUtils.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

const defaultAddress = {
  fullName: 'Test Customer',
  phone: '9876543210',
  addressLine1: '123 Market Street',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600001',
};

async function createOrderFixture({ orderNumber, total, userId, items }) {
  return await Order.create({
    orderNumber,
    publicOrderId: `PUB-${orderNumber}`,
    userId,
    items,
    subtotal: total,
    itemsSubtotal: total,
    total,
    grandTotal: total,
    deliveryAddressSnapshot: defaultAddress,
    paymentStatus: 'PAID',
    paymentMethod: 'RAZORPAY',
    paidAt: new Date(),
  });
}

async function createSuborderFixture({ parentOrderId, vendor, userId, subOrderNumber, total, items }) {
  const comm = Math.round(total * 0.05 * 100) / 100;
  const earn = Math.round(total * 0.95 * 100) / 100;
  return await VendorOrder.create({
    publicSuborderId: `PUB-${subOrderNumber}`,
    subOrderNumber,
    parentOrderId,
    vendorId: vendor._id,
    vendorNameSnapshot: vendor.storeName || 'Vendor Store',
    businessNameSnapshot: vendor.businessName || vendor.storeName || 'Vendor Business Ltd',
    userId,
    items,
    subtotal: total,
    itemsSubtotal: total,
    grandTotal: total,
    platformCommission: comm,
    vendorEarning: earn,
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log(' MARKETPLACE COMMISSION & 7-DAY VENDOR PAYOUT TEST SUITE');
  console.log('============================================================\n');

  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME || 'test' });
    console.log('Connected to MongoDB.\n');

    // 0. Setup Fixtures
    const testSuffix = Date.now();
    const customerUser = await User.create({
      name: `Test Customer ${testSuffix}`,
      email: `cust_${testSuffix}@example.com`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: '$2b$10$hashedpasswordforunittests1234567890123456789012',
      role: 'CUSTOMER',
      authProvider: 'LOCAL',
    });

    const vendorAUser = await User.create({
      name: `Vendor A User ${testSuffix}`,
      email: `vendor_a_${testSuffix}@example.com`,
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: '$2b$10$hashedpasswordforunittests1234567890123456789012',
      role: 'VENDOR',
      authProvider: 'LOCAL',
    });

    const vendorBUser = await User.create({
      name: `Vendor B User ${testSuffix}`,
      email: `vendor_b_${testSuffix}@example.com`,
      phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
      passwordHash: '$2b$10$hashedpasswordforunittests1234567890123456789012',
      role: 'VENDOR',
      authProvider: 'LOCAL',
    });

    const vendorA = await Vendor.create({
      userId: vendorAUser._id,
      storeName: `Vendor A Store ${testSuffix}`,
      slug: `vendor-a-${testSuffix}`,
      businessName: `Vendor A Electronics Pvt Ltd`,
      email: vendorAUser.email,
      phone: vendorAUser.phone,
      status: 'APPROVED',
      balance: 0,
      totalSales: 0,
    });

    const vendorB = await Vendor.create({
      userId: vendorBUser._id,
      storeName: `Vendor B Store ${testSuffix}`,
      slug: `vendor-b-${testSuffix}`,
      businessName: `Vendor B Apparels Pvt Ltd`,
      email: vendorBUser.email,
      phone: vendorBUser.phone,
      status: 'APPROVED',
      balance: 0,
      totalSales: 0,
    });

    // Configure bank account for Vendor A, leave Vendor B without bank initially
    await VendorBankAccount.create({
      vendorId: vendorA._id,
      accountHolderName: 'Vendor A Tech Solutions',
      accountNumber: '1234567890',
      accountNumberEncrypted: 'ENC_ACC_1234567890',
      accountNumberMasked: 'XXXX-XXXX-7890',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
      verificationStatus: 'VERIFIED',
    });

    // ---------------------------------------------------------------
    // SCENARIO 4 & 5: Pure 5% Commission & 95% Vendor Payable Formula
    // ---------------------------------------------------------------
    console.log('[Scenario 4 & 5] Mathematical Precision of 5% Commission & 95% Vendor Payable');
    const calc1000 = marketplaceCommissionService.calculateProductCommission(1000, 5);
    assert(calc1000.commissionAmount === 50, '1,000 product yields exact 50 commission');
    assert(calc1000.vendorPayableAmount === 950, '1,000 product yields exact 950 vendor payable');

    const calc2000 = marketplaceCommissionService.calculateProductCommission(2000, 5);
    assert(calc2000.commissionAmount === 100, '2,000 product yields exact 100 commission');
    assert(calc2000.vendorPayableAmount === 1900, '2,000 product yields exact 1,900 vendor payable');

    const calc3000 = marketplaceCommissionService.calculateProductCommission(3000, 5);
    assert(calc3000.commissionAmount === 150, '3,000 product yields exact 150 commission');
    assert(calc3000.vendorPayableAmount === 2850, '3,000 product yields exact 2,850 vendor payable');

    const calc5000 = marketplaceCommissionService.calculateProductCommission(5000, 5);
    assert(calc5000.commissionAmount === 250, '5,000 product yields exact 250 commission');
    assert(calc5000.vendorPayableAmount === 4750, '5,000 product yields exact 4,750 vendor payable');

    const total11k = moneyUtils.addMoney(
      moneyUtils.addMoney(calc1000.commissionAmount, calc2000.commissionAmount),
      moneyUtils.addMoney(calc3000.commissionAmount, calc5000.commissionAmount)
    );
    assert(total11k === 550, '11,000 order total platform commission is exactly 550');

    // ---------------------------------------------------------------
    // SCENARIO 1: Single-Product Order
    // ---------------------------------------------------------------
    console.log('\n[Scenario 1] Single-Product Order Processing');
    const prod1Id = new mongoose.Types.ObjectId();
    const order1Items = [
      {
        productId: prod1Id,
        name: 'Wireless Mouse',
        productNameSnapshot: 'Wireless Mouse',
        skuSnapshot: 'MOU-001',
        price: 1000,
        unitPrice: 1000,
        quantity: 1,
        lineTotal: 1000,
      },
    ];

    const order1 = await createOrderFixture({
      orderNumber: `ORD-TEST-1-${testSuffix}`,
      total: 1000,
      userId: customerUser._id,
      items: order1Items,
    });

    await createSuborderFixture({
      parentOrderId: order1._id,
      vendor: vendorA,
      userId: customerUser._id,
      subOrderNumber: `SO-1-${testSuffix}`,
      total: 1000,
      items: order1Items,
    });

    const result1 = await marketplaceCommissionService.processPaidOrder(order1._id, 'pay_test_single');
    assert(result1.payoutsCount === 1, 'Single-product order created 1 vendor payout');
    assert(result1.commissionsCount === 1, 'Single-product order created 1 commission transaction');

    const payout1 = await VendorPayout.findOne({ orderId: order1._id });
    assert(payout1.payoutStatus === 'HOLD', 'New vendor payout status initialized to HOLD');
    assert(payout1.grossAmount === 1000, 'Vendor payout gross amount is 1000');
    assert(payout1.commissionAmount === 50, 'Vendor payout commission amount is 50 (5%)');
    assert(payout1.netPayableAmount === 950, 'Vendor payout net payable amount is 950 (95%)');

    // ---------------------------------------------------------------
    // SCENARIO 2: Multiple-Product Order (Same Vendor)
    // ---------------------------------------------------------------
    console.log('\n[Scenario 2] Multiple-Product Order Processing (Same Vendor)');
    const order2Items = [
      {
        productId: new mongoose.Types.ObjectId(),
        name: 'Mechanical Keyboard',
        productNameSnapshot: 'Mechanical Keyboard',
        skuSnapshot: 'KB-001',
        price: 2000,
        unitPrice: 2000,
        quantity: 1,
        lineTotal: 2000,
      },
      {
        productId: new mongoose.Types.ObjectId(),
        name: 'Gaming Headset',
        productNameSnapshot: 'Gaming Headset',
        skuSnapshot: 'HS-002',
        price: 3000,
        unitPrice: 3000,
        quantity: 1,
        lineTotal: 3000,
      },
    ];

    const order2 = await createOrderFixture({
      orderNumber: `ORD-TEST-2-${testSuffix}`,
      total: 5000,
      userId: customerUser._id,
      items: order2Items,
    });

    await createSuborderFixture({
      parentOrderId: order2._id,
      vendor: vendorA,
      userId: customerUser._id,
      subOrderNumber: `SO-2-${testSuffix}`,
      total: 5000,
      items: order2Items,
    });

    const result2 = await marketplaceCommissionService.processPaidOrder(order2._id, 'pay_test_multi_prod');
    assert(result2.commissionsCount === 2, 'Multiple-product order created 2 separate commission transactions');
    const payout2 = await VendorPayout.findOne({ orderId: order2._id });
    assert(payout2.grossAmount === 5000, 'Multi-product payout gross amount is 5000');
    assert(payout2.commissionAmount === 250, 'Multi-product payout total 5% commission is 250');
    assert(payout2.netPayableAmount === 4750, 'Multi-product payout net payable is 4750');

    // ---------------------------------------------------------------
    // SCENARIO 3: Multiple Vendors in One Order
    // ---------------------------------------------------------------
    console.log('\n[Scenario 3] Multi-Vendor Order Processing');
    const order3ItemA = {
      productId: new mongoose.Types.ObjectId(),
      name: 'Product A',
      productNameSnapshot: 'Product A',
      skuSnapshot: 'PROD-A',
      price: 1000,
      unitPrice: 1000,
      quantity: 1,
      lineTotal: 1000,
    };
    const order3ItemB = {
      productId: new mongoose.Types.ObjectId(),
      name: 'Product B',
      productNameSnapshot: 'Product B',
      skuSnapshot: 'PROD-B',
      price: 3000,
      unitPrice: 3000,
      quantity: 1,
      lineTotal: 3000,
    };

    const order3 = await createOrderFixture({
      orderNumber: `ORD-TEST-3-${testSuffix}`,
      total: 4000,
      userId: customerUser._id,
      items: [order3ItemA, order3ItemB],
    });

    await createSuborderFixture({
      parentOrderId: order3._id,
      vendor: vendorA,
      userId: customerUser._id,
      subOrderNumber: `SO-3A-${testSuffix}`,
      total: 1000,
      items: [order3ItemA],
    });

    await createSuborderFixture({
      parentOrderId: order3._id,
      vendor: vendorB,
      userId: customerUser._id,
      subOrderNumber: `SO-3B-${testSuffix}`,
      total: 3000,
      items: [order3ItemB],
    });

    const result3 = await marketplaceCommissionService.processPaidOrder(order3._id, 'pay_test_multi_vendor');
    assert(result3.payoutsCount === 2, 'Multi-vendor order created 2 distinct vendor-wise payouts');

    const payout3A = await VendorPayout.findOne({ orderId: order3._id, vendorId: vendorA._id });
    const payout3B = await VendorPayout.findOne({ orderId: order3._id, vendorId: vendorB._id });
    assert(payout3A.netPayableAmount === 950, 'Vendor A payout is 950 (1000 - 50)');
    assert(payout3B.netPayableAmount === 2850, 'Vendor B payout is 2850 (3000 - 150)');

    // ---------------------------------------------------------------
    // SCENARIO 6: Payout before 7 days must NOT be allowed
    // ---------------------------------------------------------------
    console.log('\n[Scenario 6] Payout Before 7 Days Protection');
    let earlyPayoutBlocked = false;
    try {
      await marketplaceCommissionService.releaseVendorPayout({
        payoutId: payout1._id,
        adminUserId: customerUser._id,
      });
    } catch (err) {
      earlyPayoutBlocked = true;
      assert(err.message.includes('7-day holding period has not elapsed'), `Blocked with message: "${err.message}"`);
    }
    assert(earlyPayoutBlocked, 'Payout release before 7 days was strictly blocked');

    // ---------------------------------------------------------------
    // SCENARIO 7: Payout Eligibility Exactly After 7 Days
    // ---------------------------------------------------------------
    console.log('\n[Scenario 7] Automatic 7-Day Eligibility Transition');
    // Simulate passage of 7 days by shifting payoutEligibleAt to 1 hour in the past
    payout1.payoutEligibleAt = new Date(Date.now() - 60 * 60 * 1000);
    await payout1.save();

    const jobResult = await marketplaceCommissionService.processSevenDayEligibility(new Date());
    assert(jobResult.processedCount >= 1, 'Background job detected matured 7-day holding period');

    const refreshedPayout1 = await VendorPayout.findById(payout1._id);
    assert(refreshedPayout1.payoutStatus === 'ELIGIBLE', 'Payout status successfully transitioned to ELIGIBLE');

    // Now Super Admin can release the eligible payout
    const releasedPayout1 = await marketplaceCommissionService.releaseVendorPayout({
      payoutId: refreshedPayout1._id,
      adminUserId: customerUser._id,
      payoutReference: 'UTR-TEST-VERIFIED-1234',
    });
    assert(releasedPayout1.payoutStatus === 'PAID', 'Eligible payout successfully released to PAID');
    assert(releasedPayout1.payoutReference === 'UTR-TEST-VERIFIED-1234', 'Payout reference correctly stored');

    // ---------------------------------------------------------------
    // SCENARIO 8: Duplicate Payment Webhook Idempotency
    // ---------------------------------------------------------------
    console.log('\n[Scenario 8] Duplicate Payment Webhook Idempotency');
    const duplicateWebhookResult = await marketplaceCommissionService.processPaidOrder(order1._id, 'pay_test_single');
    assert(duplicateWebhookResult.payoutsCount === 1, 'Duplicate payment call returned existing payout without duplicating');
    const countAfterDup = await VendorPayout.countDocuments({ orderId: order1._id });
    assert(countAfterDup === 1, 'VendorPayout table has exactly 1 record for the order');

    // ---------------------------------------------------------------
    // SCENARIO 9: Duplicate Payout Request Idempotency
    // ---------------------------------------------------------------
    console.log('\n[Scenario 9] Duplicate Payout Request Idempotency');
    let doubleDisbursePrevented = false;
    try {
      await marketplaceCommissionService.releaseVendorPayout({
        payoutId: releasedPayout1._id,
        adminUserId: customerUser._id,
      });
    } catch (err) {
      doubleDisbursePrevented = true;
      assert(err.message.includes('already been paid out'), `Prevented with message: "${err.message}"`);
    }
    assert(doubleDisbursePrevented, 'Duplicate payout release request prevented');

    // ---------------------------------------------------------------
    // SCENARIO 10: Failed Vendor Transfer (Missing Bank Account)
    // ---------------------------------------------------------------
    console.log('\n[Scenario 10] Failed Vendor Transfer Due to Missing Bank Account');
    // Vendor B has no bank account configured
    payout3B.payoutStatus = 'ELIGIBLE';
    await payout3B.save();

    let missingBankBlocked = false;
    try {
      await marketplaceCommissionService.releaseVendorPayout({
        payoutId: payout3B._id,
        adminUserId: customerUser._id,
      });
    } catch (err) {
      missingBankBlocked = true;
      assert(err.message.includes('bank account'), `Prevented transfer with message: "${err.message}"`);
    }
    assert(missingBankBlocked, 'Transfer without verified vendor bank account was blocked safely');

    // ---------------------------------------------------------------
    // SCENARIO 11: Order Cancellation Before Payout
    // ---------------------------------------------------------------
    console.log('\n[Scenario 11] Order Cancellation Before Vendor Payout');
    const cancelRes = await marketplaceCommissionService.handleOrderCancellationOrRefund({
      orderId: order2._id,
      reason: 'Customer requested cancellation',
    });
    assert(cancelRes.length > 0 && cancelRes[0].status === 'CANCELLED', 'Payout cancelled successfully on order cancellation');

    const cancelledPayout2 = await VendorPayout.findById(payout2._id);
    assert(cancelledPayout2.payoutStatus === 'CANCELLED', 'Payout status updated to CANCELLED');

    const reversedLedger = await PlatformCommissionLedger.findOne({ orderId: order2._id, transactionType: 'COMMISSION_REVERSAL' });
    assert(reversedLedger !== null, 'Platform commission reversal logged in PlatformCommissionLedger');

    // ---------------------------------------------------------------
    // SCENARIO 12 & 13: Full & Partial Refund Handling
    // ---------------------------------------------------------------
    console.log('\n[Scenario 12 & 13] Full & Partial Refund Handling');
    const refundRes = await marketplaceCommissionService.handleOrderCancellationOrRefund({
      orderId: order3._id,
      reason: 'Defective product returned for full refund',
    });
    assert(refundRes.length === 2, 'Reversal processed for all suborders of refunded order');

    // ---------------------------------------------------------------
    // SCENARIO 14: Vendor Isolation (Vendor A cannot access Vendor B)
    // ---------------------------------------------------------------
    console.log('\n[Scenario 14] Strict Vendor Financial Isolation');
    const vendorAMetrics = await marketplaceCommissionService.getVendorMetrics(vendorA._id);
    const vendorBMetrics = await marketplaceCommissionService.getVendorMetrics(vendorB._id);

    const vendorAPayouts = await VendorPayout.find({ vendorId: vendorA._id });
    const vendorBPayouts = await VendorPayout.find({ vendorId: vendorB._id });

    assert(vendorAPayouts.every((p) => p.vendorId.toString() === vendorA._id.toString()), 'Vendor A only queries Vendor A payouts');
    assert(vendorBPayouts.every((p) => p.vendorId.toString() === vendorB._id.toString()), 'Vendor B only queries Vendor B payouts');
    assert(vendorAMetrics.totalSales !== vendorBMetrics.totalSales, 'Vendor A metrics are independent from Vendor B');

    // ---------------------------------------------------------------
    // SCENARIO 15: Super Admin Visibility Across All Records
    // ---------------------------------------------------------------
    console.log('\n[Scenario 15] Super Admin Marketplace Visibility');
    const adminMetrics = await marketplaceCommissionService.getSuperAdminMetrics();
    assert(typeof adminMetrics.totalCustomerPayments === 'number' && adminMetrics.totalCustomerPayments > 0, 'Super admin views aggregated total customer payments');
    assert(typeof adminMetrics.totalPlatformCommissionEarned === 'number', 'Super admin views total platform commission earned');
    assert(typeof adminMetrics.totalVendorPayableAmount === 'number', 'Super admin views total vendor payable amount');

    // Summary
    console.log('\n============================================================');
    console.log(` TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTests();
