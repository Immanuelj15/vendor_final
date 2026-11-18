import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema(
  {
    sNo: { type: Number, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    sku: { type: String, default: '' },
    name: { type: String, required: true },
    hsnCode: { type: String, default: '' },
    quantity: { type: Number, required: true },
    mrp: { type: Number, default: 0 },
    unitPrice: { type: Number, required: true }, // Selling price per unit
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
    totalAmount: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ['TAX_INVOICE', 'RETAIL_INVOICE', 'CREDIT_NOTE', 'PROFORMA'],
      default: 'TAX_INVOICE',
      index: true,
    },
    status: {
      type: String,
      enum: ['ISSUED', 'PAID', 'CANCELLED', 'REFUNDED'],
      default: 'ISSUED',
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // ── Order Association ─────────────────────────────────────────────────────
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    suborderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorOrder',
      default: null,
      index: true,
    },
    subOrderNumber: {
      type: String,
      default: '',
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Snapshots (Preserve original identity & details at time of issue) ─────
    brandingSnapshot: {
      brandName: { type: String, default: 'BAAPOO MART' },
      legalName: { type: String, default: 'BAAPOO MART Digital Commerce Pvt. Ltd.' },
      tagline: { type: String, default: 'BUY INDIAN • BUILD INDIA' },
      logoPath: { type: String, default: '/images/baapoo-mart-logo.png' },
      websiteUrl: { type: String, default: 'https://baapoomart.com' },
      supportEmail: { type: String, default: 'support@baapoomart.com' },
      supportPhone: { type: String, default: '+91 80 4567 8900' },
      registeredAddress: { type: String, default: '' },
      gstin: { type: String, default: '' },
      pan: { type: String, default: '' },
      primaryColor: { type: String, default: '#30358F' },
      secondaryColor: { type: String, default: '#F7941D' },
    },

    sellerSnapshot: {
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
      storeName: { type: String, required: true },
      legalBusinessName: { type: String, default: '' },
      businessType: { type: String, default: '' },
      gstin: { type: String, default: '' },
      pan: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zip: { type: String, default: '' },
        country: { type: String, default: 'India' },
      },
    },

    buyerSnapshot: {
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, required: true },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      customerGstin: { type: String, default: '' },
      billingAddress: {
        name: String,
        phone: String,
        streetAddress: String,
        city: String,
        state: String,
        postalCode: String,
        country: { type: String, default: 'India' },
      },
      shippingAddress: {
        name: String,
        phone: String,
        streetAddress: String,
        city: String,
        state: String,
        postalCode: String,
        country: { type: String, default: 'India' },
      },
    },

    // ── Product Line Items ────────────────────────────────────────────────────
    items: [invoiceItemSchema],

    // ── Financial Breakdown ───────────────────────────────────────────────────
    pricing: {
      subtotal: { type: Number, required: true },
      discountTotal: { type: Number, default: 0 },
      couponCode: { type: String, default: '' },
      couponDiscount: { type: Number, default: 0 },
      fairCoinsUsed: { type: Number, default: 0 },
      fairCoinsDiscount: { type: Number, default: 0 },
      shippingFee: { type: Number, default: 0 },
      taxableAmount: { type: Number, required: true },
      cgstTotal: { type: Number, default: 0 },
      sgstTotal: { type: Number, default: 0 },
      igstTotal: { type: Number, default: 0 },
      taxTotal: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
      amountPaid: { type: Number, required: true },
      outstandingAmount: { type: Number, default: 0 },
    },

    paymentSnapshot: {
      method: { type: String, default: 'ONLINE' },
      transactionId: { type: String, default: '' },
      status: { type: String, default: 'PAID' },
      paidAt: { type: Date, default: null },
    },

    shippingSnapshot: {
      courierPartnerName: { type: String, default: '' },
      awbNumber: { type: String, default: '' },
      trackingUrl: { type: String, default: '' },
    },

    // ── PDF Document Reference ────────────────────────────────────────────────
    pdfStoragePath: {
      type: String,
      default: '',
    },

    // ── Credit Note / Cancellation Support ────────────────────────────────────
    isCreditNote: {
      type: Boolean,
      default: false,
    },
    originalInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    creditNoteReason: {
      type: String,
      default: '',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Indexes for high-performance dashboard searches
invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ vendorId: 1, createdAt: -1 });
invoiceSchema.index({ orderId: 1, suborderId: 1 });
invoiceSchema.index({ status: 1, issueDate: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;

