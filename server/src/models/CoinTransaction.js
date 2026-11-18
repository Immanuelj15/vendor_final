import mongoose from 'mongoose';

const coinTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    type: {
      type: String,
      enum: [
        'WELCOME',
        'EARNED',
        'REDEEMED',
        'REFUNDED',
        'REVERSED',
        'CREDIT',
        'DEBIT',
        'REFUND',
        'BONUS',
        'REFERRAL_REWARD',
        'PURCHASE_REWARD',
        'SPIN_REWARD',
        'ADMIN_ADJUSTMENT',
        'EXPIRATION',
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    rupeeEquivalent: { type: Number, default: 0 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    source: { type: String, required: true }, // e.g. "REGISTRATION", "PRODUCT_PURCHASE", "CHECKOUT_REDEMPTION", "ORDER_CANCELLATION", "SPIN_WHEEL"
    referenceId: { type: String, default: '', index: true }, // e.g. orderId, spinHistoryId, referralId
    idempotencyKey: { type: String, default: '', index: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['COMPLETED', 'FAILED', 'REVERSED', 'PENDING'], default: 'COMPLETED' },
  },
  { timestamps: true }
);

export const CoinTransaction = mongoose.model('CoinTransaction', coinTransactionSchema);
export default CoinTransaction;
