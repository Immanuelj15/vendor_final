import fs from 'fs';
import path from 'path';
import { CustomerSubscriptionInvoice } from '../models/CustomerSubscriptionInvoice.js';
import { CustomerSubscription } from '../models/CustomerSubscription.js';
import { CustomerSubscriptionPlan } from '../models/CustomerSubscriptionPlan.js';
import { InvoiceSequence } from '../models/InvoiceSequence.js';
import { User } from '../models/User.js';
import { UserAddress } from '../models/UserAddress.js';
import { brandingService } from './brandingService.js';
import { taxCalculatorService } from './taxCalculatorService.js';
import { pdfCustomerSubscriptionInvoiceGenerator } from './pdfCustomerSubscriptionInvoiceGenerator.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const customerSubscriptionInvoiceService = {
  CustomerSubscriptionInvoice,

  /**
   * Generates a sequential Customer Subscription Invoice with 18% GST breakdown.
   * Completely idempotent: if an invoice already exists for this subscription, returns it.
   *
   * @param {string} subscriptionId - ObjectId of CustomerSubscription
   * @param {Object} [overrideOptions]
   * @returns {Promise<CustomerSubscriptionInvoice>}
   */
  async generateSubscriptionInvoice(subscriptionId, overrideOptions = {}) {
    if (!subscriptionId) {
      throw new ApiError(400, 'Subscription ID is required to generate invoice', ERROR_CODES.BAD_REQUEST);
    }

    // 1. Idempotency Check
    const existing = await CustomerSubscriptionInvoice.findOne({ subscriptionId });
    if (existing) {
      // If PDF file exists, return directly; else regenerate PDF file if missing
      if (existing.pdfStoragePath && fs.existsSync(existing.pdfStoragePath)) {
        return existing;
      }
      try {
        await this.generateAndSavePdf(existing);
      } catch (pdfErr) {
        console.warn('[customerSubscriptionInvoiceService] PDF refresh warning:', pdfErr.message);
      }
      return existing;
    }

    // 2. Fetch authoritative CustomerSubscription record
    const sub = await CustomerSubscription.findById(subscriptionId)
      .populate('planId')
      .populate('customerId');

    if (!sub) {
      throw new ApiError(404, 'Customer subscription record not found', ERROR_CODES.NOT_FOUND);
    }

    // Only generate paid invoice if status is ACTIVE or paymentStatus is Paid / SUCCESS
    const isPaid =
      ['Paid', 'PAID', 'SUCCESS'].includes(sub.paymentStatus) ||
      ['Active', 'ACTIVE'].includes(sub.subscriptionStatus) ||
      ['ACTIVE', 'Active'].includes(sub.status);

    if (!isPaid) {
      throw new ApiError(400, 'Cannot generate paid invoice for an unpaid or pending subscription', ERROR_CODES.BAD_REQUEST);
    }

    // 3. Resolve Customer details & address
    const user = sub.customerId && typeof sub.customerId === 'object' && sub.customerId._id
      ? sub.customerId
      : await User.findById(sub.customerId);

    const defaultAddress = await UserAddress.findOne({ userId: user?._id, isDefault: true }).lean() ||
      await UserAddress.findOne({ userId: user?._id }).lean();

    // 4. Resolve Dynamic Website Branding Snapshot
    const branding = await brandingService.getBrandingSnapshot();

    // 5. Financial & 18% GST Math
    const plan = sub.planId || sub.planSnapshot || {};
    const planPrice = Number(sub.planPriceSnapshot || plan.price || 0);
    const discount = Number(plan.discount || 0);
    const finalAmount = Math.max(0, planPrice - discount);

    // Platform State and Customer State for GST determination
    const platformState = branding.registeredAddress?.toLowerCase().includes('karnataka')
      ? 'Karnataka'
      : 'Karnataka';

    const customerState = defaultAddress?.state || '';
    const isInterState = taxCalculatorService.isInterState(platformState, customerState);

    // Standard 18% GST (SAC 998315)
    const taxRate = 18;
    // Backward calculation for tax-inclusive price (customer paid finalAmount)
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

    // 6. Generate sequential invoice number with 'CSI' prefix
    const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber('CSI', sub.createdAt || new Date());

    const transactionId = sub.transactionId || `TXN-SUB-${sub._id}`;
    const paymentMethod = sub.paymentMethod || 'ONLINE';
    const paymentDate = sub.createdAt || new Date();

    const formattedAddress = defaultAddress
      ? [defaultAddress.streetAddress, defaultAddress.city, defaultAddress.state, defaultAddress.postalCode]
          .filter(Boolean)
          .join(', ')
      : 'Address on file';

    // 7. Construct CustomerSubscriptionInvoice Document
    const invoice = new CustomerSubscriptionInvoice({
      invoiceNumber,
      invoiceType: 'SUBSCRIPTION_INVOICE',
      status: 'PAID',
      issueDate: sub.createdAt || new Date(),
      subscriptionId: sub._id,
      customerId: user?._id || sub.customerId,
      planId: plan._id || sub.planId,
      paymentId: sub.paymentId || null,
      transactionId,
      paymentMethod,
      paymentDate,
      paymentStatus: 'SUCCESS',
      currency: 'INR',

      subscriptionDates: {
        purchaseDate: sub.createdAt || new Date(),
        startDate: sub.startDate || sub.startedAt || new Date(),
        endDate: sub.endDate || sub.expiryDate || sub.expiresAt,
        expiryDate: sub.expiryDate || sub.expiresAt || sub.endDate,
        durationValue: sub.durationSnapshot?.value || sub.durationSnapshot?.durationValue || plan.durationValue || 1,
        durationUnit: sub.durationSnapshot?.unit || sub.durationSnapshot?.durationUnit || plan.durationUnit || 'months',
        planType: sub.durationSnapshot?.planType || plan.planType || 'VIP Membership',
        subscriptionStatus: sub.subscriptionStatus || sub.status || 'Active',
      },

      planSnapshot: {
        name: sub.planNameSnapshot || plan.name || 'VIP Member Pass',
        code: plan.code || '',
        planType: sub.durationSnapshot?.planType || plan.planType || 'VIP Membership',
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

      customerSnapshot: {
        customerId: String(user?._id || ''),
        name: user?.name || 'Valued Customer',
        email: user?.email || '',
        phone: user?.phone || '',
        address: formattedAddress,
        city: defaultAddress?.city || '',
        state: defaultAddress?.state || '',
        pincode: defaultAddress?.postalCode || '',
      },
    });

    await invoice.save();

    // 8. Generate and save PDF document to disk
    try {
      await this.generateAndSavePdf(invoice);
    } catch (pdfErr) {
      console.error('[customerSubscriptionInvoiceService] PDF generation failed:', pdfErr.message);
    }

    return invoice;
  },

  /**
   * Generates PDF buffer and writes to persistent storage
   *
   * @param {CustomerSubscriptionInvoice} invoice
   * @returns {Promise<string>} saved file path
   */
  async generateAndSavePdf(invoice) {
    const storageDir = path.resolve(process.cwd(), 'storage/invoices/customer-subscriptions');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const safeNum = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(storageDir, `Customer_Subscription_Invoice_${safeNum}.pdf`);

    const pdfBuffer = await pdfCustomerSubscriptionInvoiceGenerator.generateBuffer(invoice);
    fs.writeFileSync(filePath, pdfBuffer);

    invoice.pdfStoragePath = filePath;
    invoice.pdfGeneratedAt = new Date();
    await invoice.save();

    return filePath;
  },

  /**
   * Stream or download PDF file with ownership security checks
   */
  async streamInvoicePdf(subscriptionOrInvoiceId, user, res) {
    let invoice = await CustomerSubscriptionInvoice.findById(subscriptionOrInvoiceId);
    if (!invoice) {
      // Try finding by subscriptionId
      invoice = await CustomerSubscriptionInvoice.findOne({ subscriptionId: subscriptionOrInvoiceId });
    }

    // If still no invoice, try auto-generating from CustomerSubscription if valid
    if (!invoice) {
      const sub = await CustomerSubscription.findById(subscriptionOrInvoiceId);
      if (sub) {
        invoice = await this.generateSubscriptionInvoice(sub._id);
      }
    }

    if (!invoice) {
      throw new ApiError(404, 'Customer subscription invoice not found', ERROR_CODES.NOT_FOUND);
    }

    // Role-based authorization: must be customer owner or Admin
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
    if (!isAdmin) {
      const ownsInvoice = String(invoice.customerId) === String(user._id);
      if (!ownsInvoice) {
        throw new ApiError(403, 'You are not authorized to download this subscription invoice', ERROR_CODES.FORBIDDEN);
      }
    }

    // Ensure 18% GST breakdown
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
      invoice.pdfStoragePath = null;
    }

    // Check if file exists on disk, otherwise regenerate
    let filePath = invoice.pdfStoragePath;
    if (!filePath || !fs.existsSync(filePath)) {
      filePath = await this.generateAndSavePdf(invoice);
    }

    const safeNum = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Customer_Subscription_Invoice_${safeNum}.pdf"`);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  },
};

export default customerSubscriptionInvoiceService;

