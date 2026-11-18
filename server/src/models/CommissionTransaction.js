import mongoose from 'mongoose';

const commissionTransactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    suborderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorOrder',
      required: true,
      index: true,
    },
    orderItemId: {
      type: String,
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: {
      type: String,
      default: '',
    },
    productSku: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    sellingPrice: {
      type: Number,
      required: true, // lineTotal = unitPrice * quantity
    },
    commissionPercentage: {
      type: Number,
      required: true,
      default: 5,
    },
    commissionAmount: {
      type: Number,
      required: true, // sellingPrice * commissionPercentage / 100
    },
    vendorPayableAmount: {
      type: Number,
      required: true, // sellingPrice - commissionAmount
    },
    paymentReceivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['HOLD', 'ELIGIBLE', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'HOLD',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    payoutReference: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Prevent duplicate commission record for the exact same order item
commissionTransactionSchema.index({ orderId: 1, orderItemId: 1 }, { unique: true });
commissionTransactionSchema.index({ vendorId: 1, status: 1, createdAt: -1 });

export const CommissionTransaction = mongoose.model('CommissionTransaction', commissionTransactionSchema);
export default CommissionTransaction;
