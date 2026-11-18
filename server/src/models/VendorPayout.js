import mongoose from 'mongoose';

const vendorPayoutSchema = new mongoose.Schema(
  {
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
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
      unique: true, // Exactly one payout entity per vendor suborder
    },
    paymentTransactionId: {
      type: String,
      default: '',
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
    },
    commissionPercentage: {
      type: Number,
      required: true,
      default: 5,
    },
    commissionAmount: {
      type: Number,
      required: true,
    },
    netPayableAmount: {
      type: Number,
      required: true,
    },
    itemCount: {
      type: Number,
      default: 1,
    },
    paymentReceivedAt: {
      type: Date,
      required: true,
      index: true,
    },
    payoutEligibleAt: {
      type: Date,
      required: true,
      index: true, // paymentReceivedAt + 7 days
    },
    payoutStatus: {
      type: String,
      enum: ['HOLD', 'ELIGIBLE', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'],
      default: 'HOLD',
      index: true,
    },
    payoutMethod: {
      type: String,
      enum: ['RAZORPAY_X', 'MANUAL_BANK_TRANSFER', 'BANK_NEFT_RTGS'],
      default: 'BANK_NEFT_RTGS',
    },
    payoutReference: {
      type: String,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    failureReason: {
      type: String,
      default: '',
    },
    vendorBankSnapshot: {
      accountHolderName: String,
      bankName: String,
      accountNumberMasked: String,
      ifscCode: String,
      upiId: String,
      verificationStatus: String,
    },
    reversalReason: {
      type: String,
      default: '',
    },
    reversedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for high-performance dashboard querying & filtering
vendorPayoutSchema.index({ vendorId: 1, payoutStatus: 1, payoutEligibleAt: 1 });
vendorPayoutSchema.index({ payoutStatus: 1, payoutEligibleAt: 1 });
vendorPayoutSchema.index({ createdAt: -1 });

export const VendorPayout = mongoose.model('VendorPayout', vendorPayoutSchema);
export default VendorPayout;
