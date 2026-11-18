import mongoose from 'mongoose';

const platformCommissionLedgerSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: String,
      required: true,
      unique: true,
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
      default: null,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    commissionAmount: {
      type: Number,
      required: true,
    },
    commissionPercentage: {
      type: Number,
      required: true,
      default: 5,
    },
    transactionType: {
      type: String,
      enum: ['COMMISSION_CREDIT', 'COMMISSION_REVERSAL', 'PAYOUT_SETTLED', 'ADJUSTMENT'],
      required: true,
      index: true,
    },
    transactionReference: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

platformCommissionLedgerSchema.index({ createdAt: -1 });

export const PlatformCommissionLedger = mongoose.model(
  'PlatformCommissionLedger',
  platformCommissionLedgerSchema
);
export default PlatformCommissionLedger;
