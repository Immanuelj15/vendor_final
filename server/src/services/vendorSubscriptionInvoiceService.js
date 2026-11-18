import fs from 'fs';
import path from 'path';
import { VendorSubscriptionInvoice } from '../models/VendorSubscriptionInvoice.js';
import { VendorSubscription } from '../models/VendorSubscription.js';
import { InvoiceSequence } from '../models/InvoiceSequence.js';
import { Vendor } from '../models/Vendor.js';
import { VendorBusiness } from '../models/VendorBusiness.js';
import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { PlatformFinancialConfig } from '../models/PlatformFinancialConfig.js';
import { brandingService } from './brandingService.js';
import { taxCalculatorService } from './taxCalculatorService.js';
import { pdfVendorSubscriptionInvoiceGenerator } from './pdfVendorSubscriptionInvoiceGenerator.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const vendorSubscriptionInvoiceService = {
  /**
   * Generates a sequential, professional Vendor Subscription Invoice.
   * Completely idempotent: if an invoice already exists for this subscription, returns it.
   *
   * @param {string} subscriptionId - ObjectId of VendorSubscription
   * @param {Object} [overrideOptions]
   * @returns {Promise<VendorSubscriptionInvoice>}
   */
  async generateSubscriptionInvoice(subscriptionId, overrideOptions = {}) {
    if (!subscriptionId) {
      throw new ApiError(400, 'Subscription ID is required to generate invoice', ERROR_CODES.BAD_REQUEST);
    }

    // 1. Idempotency Check
    const existing = await VendorSubscriptionInvoice.findOne({ subscriptionId });
    if (existing) {
      // If PDF file exists, return directly; else regenerate PDF file if missing
      if (existing.pdfStoragePath && fs.existsSync(existing.pdfStoragePath)) {
        return existing;
      }
      try {
        await this.generateAndSavePdf(existing);
      } catch (pdfErr) {
        console.warn('[vendorSubscriptionInvoiceService] PDF refresh warning:', pdfErr.message);
      }
      return existing;
    }

    // 2. Fetch authoritative VendorSubscription record
    const sub = await VendorSubscription.findById(subscriptionId)
      .populate('planId')
      .populate('vendorId')
      .populate('userId');

    if (!sub) {
      throw new ApiError(404, 'Vendor subscription record not found', ERROR_CODES.NOT_FOUND);
    }

    // Only generate paid invoice if status is ACTIVE or paymentStatus is Paid / SUCCESS
    const isPaid =
      ['Paid', 'PAID', 'SUCCESS'].includes(sub.paymentStatus) ||
      ['Active', 'ACTIVE'].includes(sub.subscriptionStatus) ||
      ['ACTIVE', 'Active'].includes(sub.status);

    if (!isPaid) {
      throw new ApiError(400, 'Cannot generate paid invoice for an unpaid or pending subscription', ERROR_CODES.BAD_REQUEST);
    }

    // 3. Resolve Vendor & Contact Person details
    const vendor = sub.vendorId && typeof sub.vendorId === 'object' && sub.vendorId._id
      ? sub.vendorId
      : await Vendor.findById(sub.vendorId);

    const user = sub.userId && typeof sub.userId === 'object' && sub.userId._id
      ? sub.userId
      : await User.findById(sub.userId || vendor?.userId);

    const vendorBusiness = vendor?._id
      ? await VendorBusiness.findOne({ vendorId: vendor._id }).lean()
      : null;

    // 4. Resolve Dynamic Website Branding Snapshot
    const branding = await brandingService.getBrandingSnapshot();
    const finConfig = await PlatformFinancialConfig.findOne().lean().catch(() => null);

    // 5. Financial & Tax Math
    const plan = sub.planId || sub.planSnapshot || {};
    const planPrice = Number(sub.planPriceSnapshot || plan.price || 0);
    const discount = Number(plan.discount || 0);
    const finalAmount = Math.max(0, planPrice - discount);

    // Platform State and Vendor State for GST determination
    const platformState = branding.registeredAddress?.toLowerCase().includes('karnataka')
      ? 'Karnataka'
      : 'Karnataka'; // Platform headquarters

    const vendorAddress = vendor?.address || {};
    const vendorState = vendorAddress.state || '';
    const isInterState = taxCalculatorService.isInterState(platformState, vendorState);

    // GST rate: 18% standard SAC 998315 for IT/Platform subscription
    const taxRate = 18;
    // Backward calculation for tax-inclusive price (vendor paid finalAmount)
    const taxableAmount = taxCalculatorService.round(finalAmount / (1 + taxRate / 100));
    const totalTax = taxCalculatorService.round(finalAmount - taxableAmount);

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    if (isInterState) {
      igstRate = taxRate;
      igstAmount = totalTax;
    } else {
      cgstRate = taxRate / 2;
      cgstAmount = taxCalculatorService.round(totalTax / 2);
      sgstRate = taxRate / 2;
      sgstAmount = taxCalculatorService.round(totalTax - cgstAmount);
    }

    // 6. Referral Commission Info (Super Admin ONLY snapshot)
    let referralSnapshot = {
      isReferred: false,
      referredByVendorId: null,
      referredByStoreName: '',
      commissionRatePercent: 10,
      commissionAmount: 0,
      processed: false,
    };

    if (vendor?.referredByVendorId) {
      try {
        const referrerVendor = await Vendor.findById(vendor.referredByVendorId).select('storeName').lean();
        const commAmount = taxCalculatorService.round(finalAmount * 0.10);
        referralSnapshot = {
          isReferred: true,
          referredByVendorId: vendor.referredByVendorId,
          referredByStoreName: referrerVendor?.storeName || 'Sponsor Vendor',
          commissionRatePercent: 10,
          commissionAmount: commAmount,
          processed: true,
        };
      } catch (refErr) {
        console.warn('[vendorSubscriptionInvoiceService] Referral lookup warning:', refErr.message);
      }
    }

    // 7. Resolve Payment Record details
    let paymentRecord = null;
    if (sub.paymentId) {
      paymentRecord = await Payment.findById(sub.paymentId).lean();
    }
    if (!paymentRecord && sub.transactionId) {
      paymentRecord = await Payment.findOne({ transactionId: sub.transactionId }).lean();
    }

    const transactionId = sub.transactionId || paymentRecord?.transactionId || `txn_vsub_${sub._id}`;
    const paymentMethod = paymentRecord?.paymentMethod || 'RAZORPAY';
    const paymentDate = paymentRecord?.createdAt || sub.createdAt || new Date();

    // 8. Generate sequential invoice number with 'VSI' prefix
    const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber('VSI', sub.createdAt || new Date());

    // 9. Vendor details formatting
    const vendorFormattedAddress = [
      vendorAddress.street,
      vendorAddress.city,
      vendorAddress.state,
      vendorAddress.zip,
      vendorAddress.country || 'India',
    ].filter(Boolean).join(', ') || 'Address on file';

    const vendorGstin = vendorBusiness?.gstNumber || vendor?.taxInfo?.gstin || '';

    // 10. Construct VendorSubscriptionInvoice Document
    const invoice = new VendorSubscriptionInvoice({
      invoiceNumber,
      invoiceType: 'SUBSCRIPTION_INVOICE',
      status: 'PAID',
      issueDate: sub.createdAt || new Date(),
      subscriptionId: sub._id,
      vendorId: vendor?._id || sub.vendorId,
      userId: user?._id || sub.userId,
      planId: plan._id || sub.planId,
      paymentId: sub.paymentId || paymentRecord?._id || null,
      transactionId,
      paymentMethod,
      paymentDate,
      paymentStatus: 'SUCCESS',
      currency: 'INR',

      subscriptionDates: {
        purchaseDate: sub.createdAt || new Date(),
        startDate: sub.startDate || new Date(),
        endDate: sub.endDate || sub.expiryDate,
        expiryDate: sub.expiryDate || sub.endDate,
        durationValue: sub.durationSnapshot?.durationValue || plan.durationValue || 1,
        durationUnit: sub.durationSnapshot?.durationUnit || plan.durationUnit || 'months',
        planType: sub.durationSnapshot?.planType || plan.planType || 'Monthly',
        subscriptionStatus: sub.subscriptionStatus || sub.status || 'Active',
      },

      planSnapshot: {
        name: sub.planNameSnapshot || plan.name || 'Merchant Subscription',
        code: plan.code || '',
        planType: sub.durationSnapshot?.planType || plan.planType || 'Monthly',
        price: planPrice,
        discount,
        benefits: plan.benefits || [],
        featureLimits: plan.featureLimits || {},
        badge: plan.badge || '',
      },

      pricing: {
        planPrice,
        discount,
        taxableAmount,
        taxRate,
        isInterState,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        totalTax,
        finalAmount,
        amountPaid: finalAmount,
        balanceDue: 0,
      },

      sellerSnapshot: {
        brandName: branding.brandName || 'BAAPOO MART',
        legalName: branding.legalName || 'BAAPOO MART Digital Commerce Pvt. Ltd.',
        tagline: branding.tagline || 'BUY INDIAN • BUILD INDIA',
        logoPath: branding.logoPath || '',
        websiteUrl: branding.websiteUrl || 'https://baapoomart.com',
        supportEmail: branding.supportEmail || 'support@baapoomart.com',
        supportPhone: branding.supportPhone || '+91 80 4567 8900',
        registeredAddress: branding.registeredAddress || '',
        gstin: branding.gstin || '',
        pan: branding.pan || '',
        sacCode: '998315',
        primaryColor: branding.primaryColor || '#30358F',
        secondaryColor: branding.secondaryColor || '#F7941D',
      },

      vendorSnapshot: {
        vendorId: String(vendor?._id || ''),
        storeName: vendor?.storeName || 'Merchant Store',
        ownerName: user?.name || '',
        email: vendor?.email || user?.email || '',
        phone: vendor?.phone || user?.phone || '',
        businessAddress: vendorFormattedAddress,
        city: vendorAddress.city || '',
        state: vendorAddress.state || '',
        pincode: vendorAddress.zip || '',
        gstin: vendorGstin,
        pan: vendorBusiness?.panNumber || '',
      },

      referralCommissionSnapshot: referralSnapshot,
    });

    await invoice.save();

    // 11. Generate and save PDF document to disk
    try {
      await this.generateAndSavePdf(invoice);
    } catch (pdfErr) {
      console.error('[vendorSubscriptionInvoiceService] PDF generation failed:', pdfErr.message);
    }

    return invoice;
  },

  /**
   * Generates PDF buffer and writes to persistent storage
   *
   * @param {VendorSubscriptionInvoice} invoice
   * @returns {Promise<string>} saved file path
   */
  async generateAndSavePdf(invoice) {
    const storageDir = path.resolve(process.cwd(), 'storage/invoices/vendor-subscriptions');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const safeNum = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(storageDir, `Vendor_Subscription_Invoice_${safeNum}.pdf`);

    const pdfBuffer = await pdfVendorSubscriptionInvoiceGenerator.generateBuffer(invoice);
    fs.writeFileSync(filePath, pdfBuffer);

    invoice.pdfStoragePath = filePath;
    invoice.pdfGeneratedAt = new Date();
    await invoice.save();

    return filePath;
  },

  /**
   * Vendor: Get paginated list of subscription invoices for the authenticated vendor
   */
  async getVendorInvoices(vendorId, { page = 1, limit = 15, search = '', dateFrom = '', dateTo = '' } = {}) {
    const query = { vendorId };

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { transactionId: { $regex: q, $options: 'i' } },
        { 'planSnapshot.name': { $regex: q, $options: 'i' } },
      ];
    }

    if (dateFrom || dateTo) {
      query.issueDate = {};
      if (dateFrom) query.issueDate.$gte = new Date(dateFrom);
      if (dateTo) query.issueDate.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      VendorSubscriptionInvoice.find(query)
        .sort({ issueDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      VendorSubscriptionInvoice.countDocuments(query),
    ]);

    // Sanitize output for vendor: never return referralCommissionSnapshot to vendor
    const sanitizedInvoices = invoices.map((inv) => {
      const { referralCommissionSnapshot, ...safeInv } = inv;
      return safeInv;
    });

    return {
      invoices: sanitizedInvoices,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  },

  /**
   * Super Admin: Get platform-wide vendor subscription invoices with full search & filtering
   */
  async getAdminInvoices({
    page = 1,
    limit = 15,
    search = '',
    vendorId = '',
    plan = '',
    status = '',
    dateFrom = '',
    dateTo = '',
  } = {}) {
    const query = {};

    if (vendorId) query.vendorId = vendorId;
    if (status && status !== 'ALL') query.status = status;
    if (plan) query['planSnapshot.name'] = { $regex: plan, $options: 'i' };

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { transactionId: { $regex: q, $options: 'i' } },
        { 'vendorSnapshot.storeName': { $regex: q, $options: 'i' } },
        { 'vendorSnapshot.email': { $regex: q, $options: 'i' } },
        { 'planSnapshot.name': { $regex: q, $options: 'i' } },
      ];
    }

    if (dateFrom || dateTo) {
      query.issueDate = {};
      if (dateFrom) query.issueDate.$gte = new Date(dateFrom);
      if (dateTo) query.issueDate.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
      VendorSubscriptionInvoice.find(query)
        .sort({ issueDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      VendorSubscriptionInvoice.countDocuments(query),
    ]);

    return {
      invoices,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  },

  /**
   * Super Admin: Aggregated Subscription Invoice KPIs and Financial Statistics
   */
  async getAdminStats() {
    const [aggResult, activeSubsCount, expiredSubsCount] = await Promise.all([
      VendorSubscriptionInvoice.aggregate([
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.finalAmount' },
            totalTaxCollected: { $sum: '$pricing.totalTax' },
            totalReferralCommissions: { $sum: '$referralCommissionSnapshot.commissionAmount' },
          },
        },
      ]),
      VendorSubscription.countDocuments({
        subscriptionStatus: { $in: ['Active', 'ACTIVE'] },
        expiryDate: { $gt: new Date() },
      }),
      VendorSubscription.countDocuments({
        subscriptionStatus: { $in: ['Expired', 'EXPIRED'] },
      }),
    ]);

    const stats = aggResult[0] || {
      totalInvoices: 0,
      totalRevenue: 0,
      totalTaxCollected: 0,
      totalReferralCommissions: 0,
    };

    return {
      totalInvoices: stats.totalInvoices,
      totalRevenue: stats.totalRevenue,
      totalTaxCollected: stats.totalTaxCollected,
      totalReferralCommissions: stats.totalReferralCommissions,
      activeSubscriptions: activeSubsCount,
      expiredSubscriptions: expiredSubsCount,
    };
  },

  /**
   * Stream or download PDF file with security checks
   */
  async streamInvoicePdf(invoiceId, user, res) {
    const invoice = await VendorSubscriptionInvoice.findById(invoiceId);
    if (!invoice) {
      throw new ApiError(404, 'Subscription invoice not found', ERROR_CODES.NOT_FOUND);
    }

    // Role-based authorization
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
    if (!isAdmin) {
      // Vendor must own this invoice
      const vendor = await Vendor.findOne({ userId: user._id });
      const ownsInvoice =
        (vendor && String(invoice.vendorId) === String(vendor._id)) ||
        String(invoice.userId) === String(user._id);

      if (!ownsInvoice) {
        throw new ApiError(403, 'You are not authorized to download this subscription invoice', ERROR_CODES.FORBIDDEN);
      }
    }

    // Ensure invoice has 18% GST breakdown
    if (!invoice.pricing?.taxRate || invoice.pricing.taxRate === 0 || !invoice.pricing.totalTax) {
      const finalAmount = Number(invoice.pricing?.finalAmount || invoice.pricing?.planPrice || 0);
      const taxRate = 18;
      const taxableAmount = taxCalculatorService.round(finalAmount / (1 + taxRate / 100));
      const totalTax = taxCalculatorService.round(finalAmount - taxableAmount);

      invoice.pricing = invoice.pricing || {};
      invoice.pricing.taxRate = taxRate;
      invoice.pricing.taxableAmount = taxableAmount;
      invoice.pricing.totalTax = totalTax;

      if (invoice.pricing.isInterState) {
        invoice.pricing.igstRate = taxRate;
        invoice.pricing.igstAmount = totalTax;
        invoice.pricing.cgstRate = 0;
        invoice.pricing.cgstAmount = 0;
        invoice.pricing.sgstRate = 0;
        invoice.pricing.sgstAmount = 0;
      } else {
        invoice.pricing.cgstRate = 9;
        invoice.pricing.cgstAmount = taxCalculatorService.round(totalTax / 2);
        invoice.pricing.sgstRate = 9;
        invoice.pricing.sgstAmount = taxCalculatorService.round(totalTax - invoice.pricing.cgstAmount);
        invoice.pricing.igstRate = 0;
        invoice.pricing.igstAmount = 0;
      }

      invoice.markModified('pricing');
      await invoice.save();
      // Force regeneration of PDF with updated 18% GST breakdown
      invoice.pdfStoragePath = null;
    }

    // Check if file exists on disk, otherwise regenerate
    let filePath = invoice.pdfStoragePath;
    if (!filePath || !fs.existsSync(filePath)) {
      filePath = await this.generateAndSavePdf(invoice);
    }

    const safeNum = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Vendor_Subscription_Invoice_${safeNum}.pdf"`);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  },
};

export default vendorSubscriptionInvoiceService;

