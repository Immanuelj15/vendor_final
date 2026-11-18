import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fairkart';

async function runVendorSubscriptionInvoiceVerification() {
  console.log('\n=============================================================');
  console.log('  BAAPOO MART – VENDOR SUBSCRIPTION INVOICE VERIFICATION');
  console.log('=============================================================\n');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('[1/7] Connected to MongoDB database:', mongoose.connection.name);

    // Dynamically import models & services
    const { Vendor } = await import('../src/models/Vendor.js');
    const { User } = await import('../src/models/User.js');
    const { VendorSubscriptionPlan } = await import('../src/models/VendorSubscriptionPlan.js');
    const { VendorSubscription } = await import('../src/models/VendorSubscription.js');
    const { VendorSubscriptionInvoice } = await import('../src/models/VendorSubscriptionInvoice.js');
    const { Payment } = await import('../src/models/Payment.js');
    const { brandingService } = await import('../src/services/brandingService.js');
    const { vendorSubscriptionInvoiceService } = await import('../src/services/vendorSubscriptionInvoiceService.js');

    // ── Test Step 1: Branding Resolution ────────────────────────────────────
    console.log('\n[2/7] Verifying Dynamic Website Branding...');
    const branding = await brandingService.getBrandingSnapshot();
    console.log('  ✓ Brand Name:', branding.brandName);
    console.log('  ✓ Legal Name:', branding.legalName);
    console.log('  ✓ Tagline:', branding.tagline);
    console.log('  ✓ Website URL:', branding.websiteUrl);
    console.log('  ✓ Support Email:', branding.supportEmail);
    console.log('  ✓ Support Phone:', branding.supportPhone);
    console.log('  ✓ Registered Address:', branding.registeredAddress);
    console.log('  ✓ Logo Path Resolved:', branding.logoPath || 'Default brand asset');
    console.log('  ✓ Brand Colors:', branding.primaryColor, branding.secondaryColor);

    // ── Test Step 2: Ensure Vendor & Plan Exist ─────────────────────────────
    console.log('\n[3/7] Setting up Test Vendor & Subscription Plan...');
    let vendor = await Vendor.findOne({ isPaid: true });
    if (!vendor) {
      vendor = await Vendor.findOne();
    }
    if (!vendor) {
      // Create a test vendor
      let user = await User.findOne({ role: 'VENDOR' });
      if (!user) {
        user = await User.create({
          name: 'BAAPOO Merchant Partner',
          email: `test_merchant_${Date.now()}@baapoomart.com`,
          phone: '9876543210',
          role: 'VENDOR',
          passwordHash: 'dummy',
        });
      }
      vendor = await Vendor.create({
        userId: user._id,
        storeName: 'Royal Swadeshi Store',
        slug: `royal-swadeshi-${Date.now()}`,
        phone: '9876543210',
        email: user.email,
        address: {
          street: '123 Swadeshi Avenue',
          city: 'Bengaluru',
          state: 'Karnataka',
          zip: '560001',
          country: 'India',
        },
        status: 'APPROVED',
        isPaid: true,
        paymentStatus: 'PAID',
      });
    }

    console.log(`  ✓ Using Vendor: "${vendor.storeName}" (${vendor._id})`);

    let plan = await VendorSubscriptionPlan.findOne({ status: { $in: ['Active', 'ACTIVE'] } });
    if (!plan) {
      plan = await VendorSubscriptionPlan.create({
        name: 'Annual Merchant Growth Plan',
        code: 'VSP_ANNUAL_TEST',
        planType: 'Annual',
        price: 9999,
        discount: 1000,
        currency: 'INR',
        durationValue: 12,
        durationUnit: 'months',
        status: 'Active',
        benefits: ['Unlimited Products', '0% Processing Surcharge', 'Priority Logistics Dispatch'],
      });
    }
    console.log(`  ✓ Using Plan: "${plan.name}" (Price: Rs. ${plan.price}, Discount: Rs. ${plan.discount})`);

    // ── Test Step 3: Create Active Subscription & Payment ────────────────────
    console.log('\n[4/7] Creating Verified Subscription & Payment Record...');
    const now = new Date();
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + 1);

    const txnId = `txn_vsub_test_${Date.now()}`;
    const finalAmount = Math.max(0, plan.price - (plan.discount || 0));

    const payment = await Payment.create({
      userId: vendor.userId,
      amount: finalAmount,
      currency: 'INR',
      paymentMethod: 'RAZORPAY',
      transactionId: txnId,
      status: 'SUCCESS',
      metadata: {
        vendorId: vendor._id,
        planId: plan._id,
      },
    });

    const subscription = await VendorSubscription.create({
      vendorId: vendor._id,
      userId: vendor.userId,
      planId: plan._id,
      planNameSnapshot: plan.name,
      planPriceSnapshot: finalAmount,
      durationSnapshot: {
        durationValue: plan.durationValue || 12,
        durationUnit: plan.durationUnit || 'months',
        planType: plan.planType || 'Annual',
      },
      startDate: now,
      expiryDate: expiry,
      endDate: expiry,
      paymentStatus: 'Paid',
      subscriptionStatus: 'Active',
      status: 'ACTIVE',
      transactionId: txnId,
      paymentId: payment._id,
      planSnapshot: {
        id: plan._id,
        name: plan.name,
        price: plan.price,
        discount: plan.discount,
        benefits: plan.benefits,
      },
    });

    console.log(`  ✓ Subscription Created: ${subscription._id}`);
    console.log(`  ✓ Transaction ID: ${txnId}`);
    console.log(`  ✓ Validity: ${now.toLocaleDateString('en-IN')} to ${expiry.toLocaleDateString('en-IN')}`);

    // ── Test Step 4: Generate Subscription Invoice ──────────────────────────
    console.log('\n[5/7] Generating Vendor Subscription Invoice (VSI Series)...');
    const invoice = await vendorSubscriptionInvoiceService.generateSubscriptionInvoice(subscription._id);

    console.log('  ✓ Invoice Number Generated:', invoice.invoiceNumber);
    if (!invoice.invoiceNumber.startsWith('VSI/')) {
      throw new Error(`Invalid invoice prefix! Expected VSI/..., got ${invoice.invoiceNumber}`);
    }
    console.log('  ✓ Invoice Issue Date:', invoice.issueDate);
    console.log('  ✓ Base Plan Price: Rs.', invoice.pricing.planPrice);
    console.log('  ✓ Plan Discount: Rs.', invoice.pricing.discount);
    console.log('  ✓ Taxable Amount: Rs.', invoice.pricing.taxableAmount);
    console.log('  ✓ Total Tax (GST): Rs.', invoice.pricing.totalTax);
    console.log('  ✓ Final Paid Amount: Rs.', invoice.pricing.finalAmount);
    console.log('  ✓ Payment Status:', invoice.paymentStatus);
    console.log('  ✓ Vendor Store:', invoice.vendorSnapshot.storeName);
    console.log('  ✓ Vendor Address:', invoice.vendorSnapshot.businessAddress);

    // ── Test Step 5: Verify Idempotency ─────────────────────────────────────
    console.log('\n[6/7] Verifying Idempotency Against Webhook / Duplicate Calls...');
    const duplicateCallInvoice = await vendorSubscriptionInvoiceService.generateSubscriptionInvoice(subscription._id);
    if (String(duplicateCallInvoice._id) !== String(invoice._id)) {
      throw new Error('Idempotency failed! Duplicate invoice was created for the same subscription.');
    }
    if (duplicateCallInvoice.invoiceNumber !== invoice.invoiceNumber) {
      throw new Error('Idempotency failed! Invoice number changed on duplicate invocation.');
    }
    console.log('  ✓ Idempotency Confirmed: Same invoice returned smoothly with zero duplicate rows.');

    // ── Test Step 6: Verify PDF Binary & Storage ────────────────────────────
    console.log('\n[7/7] Verifying PDF Generation, Storage, and Binary Format...');
    console.log('  ✓ PDF File Path:', invoice.pdfStoragePath);
    if (!fs.existsSync(invoice.pdfStoragePath)) {
      throw new Error(`PDF file not found on disk at: ${invoice.pdfStoragePath}`);
    }

    const pdfStat = fs.statSync(invoice.pdfStoragePath);
    console.log(`  ✓ PDF File Size: ${pdfStat.size} bytes`);
    if (pdfStat.size < 1000) {
      throw new Error('PDF file size is suspiciously small!');
    }

    const pdfBuffer = fs.readFileSync(invoice.pdfStoragePath);
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    if (!pdfHeader.startsWith('%PDF-')) {
      throw new Error(`Invalid PDF header: ${pdfHeader}`);
    }
    console.log(`  ✓ Valid PDF Binary Signature: "${pdfHeader}"`);

    // Verify Query methods
    console.log('\n[Bonus] Verifying Vendor & Admin Query Methods...');
    const vendorInvoicesResult = await vendorSubscriptionInvoiceService.getVendorInvoices(vendor._id, { page: 1, limit: 10 });
    console.log(`  ✓ Vendor Invoices Query: Found ${vendorInvoicesResult.total} invoice(s) for vendor.`);
    if (vendorInvoicesResult.invoices.some((inv) => inv.referralCommissionSnapshot)) {
      throw new Error('Security leak! referralCommissionSnapshot must not be returned to vendor.');
    }
    console.log('  ✓ Security Verified: Vendor response never leaks internal referral commissions.');

    const adminStats = await vendorSubscriptionInvoiceService.getAdminStats();
    console.log('  ✓ Admin Stats Verified:', {
      totalInvoices: adminStats.totalInvoices,
      totalRevenue: adminStats.totalRevenue,
      activeSubscriptions: adminStats.activeSubscriptions,
    });

    console.log('\n=============================================================');
    console.log('  🎉 ALL VENDOR SUBSCRIPTION INVOICE TESTS PASSED (100%)');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runVendorSubscriptionInvoiceVerification();

