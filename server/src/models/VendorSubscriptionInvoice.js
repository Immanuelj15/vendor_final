import mongoose from 'mongoose';

const vendorSubscriptionInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      comment: 'Sequential format: VSI/YYYY-YY/XXXXXX',
    },
    invoiceType: {
      type: String,
      enum: ['TAX_INVOICE', 'SUBSCRIPTION_INVOICE'],
      default: 'SUBSCRIPTION_INVOICE',
      index: true,
    },
    status: {
      type: String,
      enum: ['PAID', 'PENDING', 'CANCELLED', 'REFUNDED'],
      default: 'PAID',
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // ── Associations ──────────────────────────────────────────────────────────
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorSubscription',
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorSubscriptionPlan',
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },

    // ── Transaction & Payment Information ─────────────────────────────────────
    transactionId: {
      type: String,
      default: '',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'ONLINE',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentStatus: {
      type: String,
      default: 'SUCCESS',
    },
    currency: {
      type: String,
      default: 'INR',
    },

    // ── Subscription Term Dates ───────────────────────────────────────────────
    subscriptionDates: {
      purchaseDate: { type: Date, default: Date.now },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      expiryDate: { type: Date, required: true },
      durationValue: { type: Number, default: 1 },
      durationUnit: { type: String, default: 'months' },
      planType: { type: String, default: 'Monthly' },
      subscriptionStatus: { type: String, default: 'Active' },
    },

    // ── Plan Snapshot (Preserved at time of purchase) ─────────────────────────
    planSnapshot: {
      name: { type: String, required: true },
      code: { type: String, default: '' },
      planType: { type: String, default: 'Monthly' },
      price: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      benefits: [{ type: String }],
      featureLimits: { type: mongoose.Schema.Types.Mixed, default: {} },
      badge: { type: String, default: '' },
    },

    // ── Price & Tax Breakdown ─────────────────────────────────────────────────
    pricing: {
      planPrice: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      taxableAmount: { type: Number, required: true },
      taxRate: { type: Number, default: 0 },
      isInterState: { type: Boolean, default: false },
      cgstRate: { type: Number, default: 0 },
      cgstAmount: { type: Number, default: 0 },
      sgstRate: { type: Number, default: 0 },
      sgstAmount: { type: Number, default: 0 },
      igstRate: { type: Number, default: 0 },
      igstAmount: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
      finalAmount: { type: Number, required: true },
      amountPaid: { type: Number, required: true },
      balanceDue: { type: Number, default: 0 },
    },

    // ── Seller / Platform Snapshot ────────────────────────────────────────────
    sellerSnapshot: {
      brandName: { type: String, default: 'BAAPOO MART' },
      legalName: { type: String, default: 'BAAPOO MART Digital Commerce Pvt. Ltd.' },
      tagline: { type: String, default: 'BUY INDIAN • BUILD INDIA' },
      logoPath: { type: String, default: '' },
      websiteUrl: { type: String, default: 'https://baapoomart.com' },
      supportEmail: { type: String, default: 'support@baapoomart.com' },
      supportPhone: { type: String, default: '+91 80 4567 8900' },
      registeredAddress: { type: String, default: '' },
      gstin: { type: String, default: '' },
      pan: { type: String, default: '' },
      sacCode: { type: String, default: '998315' }, // SAC for Hosting and IT SaaS
      primaryColor: { type: String, default: '#30358F' },
      secondaryColor: { type: String, default: '#F7941D' },
    },

    // ── Vendor / Buyer Snapshot ───────────────────────────────────────────────
    vendorSnapshot: {
      vendorId: { type: String, required: true },
      storeName: { type: String, required: true },
      ownerName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      businessAddress: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      gstin: { type: String, default: '' },
      pan: { type: String, default: '' },
    },

    // ── Internal Super Admin Referral Log (NEVER exposed to vendor) ───────────
    referralCommissionSnapshot: {
      isReferred: { type: Boolean, default: false },
      referredByVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
      referredByStoreName: { type: String, default: '' },
      commissionRatePercent: { type: Number, default: 0 },
      commissionAmount: { type: Number, default: 0 },
      processed: { type: Boolean, default: false },
    },

    // ── Storage & Delivery ────────────────────────────────────────────────────
    pdfStoragePath: {
      type: String,
      default: '',
    },
    pdfGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const VendorSubscriptionInvoice = mongoose.model(
  'VendorSubscriptionInvoice',
  vendorSubscriptionInvoiceSchema
);

export default VendorSubscriptionInvoice;

