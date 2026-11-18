import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    orderItemId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    image: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
    serialNumber: { type: String, default: '' }, // For electronics IMEI/serial verification
  },
  { _id: true }
);

const actionHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    fromStatus: { type: String, default: '' },
    toStatus: { type: String, default: '' },
    byRole: {
      type: String,
      enum: ['CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM'],
      required: true,
    },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const returnRequestSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ['RETURN', 'REPLACEMENT', 'CANCELLATION'],
      default: 'RETURN',
      required: true,
      index: true,
    },
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
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fulfillmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Fulfillment',
      default: null,
      index: true,
    },

    items: [returnItemSchema],

    reason: {
      type: String,
      required: true,
    },
    subReason: {
      type: String,
      default: '',
    },
    detailedDescription: {
      type: String,
      default: '',
    },
    evidenceImages: {
      type: [String],
      default: [],
    },
    evidenceVideos: {
      type: [String],
      default: [],
    },

    returnPolicySnapshot: {
      policyName: { type: String, default: '' },
      returnWindowDays: { type: Number, default: 7 },
      replacementWindowDays: { type: Number, default: 7 },
      conditions: [{ type: String }],
    },

    status: {
      type: String,
      enum: [
        'REQUEST_SUBMITTED',
        'REQUESTED',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'PICKUP_SCHEDULED',
        'PICKUP_COMPLETED',
        'RECEIVED',
        'QUALITY_INSPECTION',
        'REFUND_PROCESSING',
        'REFUND_COMPLETED',
        'REPLACEMENT_APPROVED',
        'REPLACEMENT_SHIPPED',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'REQUEST_SUBMITTED',
      index: true,
    },

    // ── Reverse Pickup / Shipment Details ──────────────────────────────────
    pickupDetails: {
      courierPartner: { type: String, default: '' },
      awbNumber: { type: String, default: '' },
      scheduledDate: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      status: { type: String, default: 'PENDING' },
      trackingUrl: { type: String, default: '' },
      shiprocketReturnShipmentId: { type: String, default: '' },
      pickupAddress: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // ── Replacement Details ───────────────────────────────────────────────
    replacementDetails: {
      replacementOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
      replacementOrderNumber: { type: String, default: '' },
      replacementAwbNumber: { type: String, default: '' },
      shippedAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
      status: { type: String, default: 'PENDING' },
    },

    // ── Refund Details ────────────────────────────────────────────────────
    refundDetails: {
      refundableAmount: { type: Number, default: 0 },
      refundAmount: { type: Number, default: 0 },
      refundMethod: { type: String, default: 'ORIGINAL_PAYMENT_METHOD' },
      gatewayRefundId: { type: String, default: '' },
      paymentMethod: { type: String, default: 'ONLINE' },
      refundStatus: {
        type: String,
        enum: ['NOT_INITIATED', 'PENDING', 'PROCESSING', 'SUCCESSFUL', 'COMPLETED', 'FAILED'],
        default: 'NOT_INITIATED',
        index: true,
      },
      processedAt: { type: Date, default: null },
      refundProcessedAt: { type: Date, default: null },
      refundTransactionReference: { type: String, default: '' },
      failureReason: { type: String, default: '' },
      bankDetails: {
        accountHolderName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' },
        bankName: { type: String, default: '' },
      },
    },

    // ── Vendor Action Record ──────────────────────────────────────────────
    vendorAction: {
      action: { type: String, default: '' }, // 'APPROVED', 'REJECTED'
      actionDate: { type: Date, default: null },
      explanation: { type: String, default: '' }, // Mandatory when rejected
      actionByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },

    // ── Admin Override & Dispute Resolution ───────────────────────────────
    adminOverride: {
      isOverridden: { type: Boolean, default: false },
      action: { type: String, default: '' },
      actionDate: { type: Date, default: null },
      reason: { type: String, default: '' },
      overriddenByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },

    actionHistory: [actionHistorySchema],

    requestedAt: { type: Date, default: Date.now, index: true },
    approvedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
export default ReturnRequest;
