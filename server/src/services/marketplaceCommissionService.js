import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { VendorOrder } from '../models/VendorOrder.js';
import { Vendor } from '../models/Vendor.js';
import { VendorBankAccount } from '../models/VendorBankAccount.js';
import { VendorSettlement } from '../models/VendorSettlement.js';
import { CommissionTransaction } from '../models/CommissionTransaction.js';
import { VendorPayout } from '../models/VendorPayout.js';
import { PlatformCommissionLedger } from '../models/PlatformCommissionLedger.js';
import { PlatformFinancialConfig } from '../models/PlatformFinancialConfig.js';
import { VendorLedger } from '../models/VendorLedger.js';
import { Notification } from '../models/Notification.js';
import { moneyUtils } from '../utils/moneyUtils.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const marketplaceCommissionService = {
  /**
   * 1. Get Configured Platform Commission Rate (defaults to 5%)
   */
  async getCommissionRate() {
    try {
      const config = await PlatformFinancialConfig.findOne();
      if (config && typeof config.defaultCommissionRate === 'number' && config.defaultCommissionRate >= 0) {
        return config.defaultCommissionRate;
      }
    } catch {
      // Fallback
    }
    return 5;
  },

  /**
   * 2. Pure Calculation using Decimal-Safe Integer-Paise Arithmetic
   * @param {number} sellingPrice Product line selling price
   * @param {number} rate Commission percentage (default 5)
   */
  calculateProductCommission(sellingPrice, rate = 5) {
    const price = Math.max(0, Number(sellingPrice) || 0);
    const commRate = Number(rate) >= 0 ? Number(rate) : 5;

    const roundedPrice = moneyUtils.roundMoney(price);
    const commissionAmount = moneyUtils.calculatePercentage(roundedPrice, commRate);
    const vendorPayableAmount = moneyUtils.subtractMoney(roundedPrice, commissionAmount, true);

    return {
      sellingPrice: roundedPrice,
      commissionPercentage: commRate,
      commissionAmount,
      vendorPayableAmount,
    };
  },

  /**
   * 3. Process Paid Order — Split Commissions & Create 7-Day Hold Vendor Payouts
   */
  async processPaidOrder(orderId, paymentTransactionId = '', confirmedPaymentDate = null, sessionArg = null) {
    const session = sessionArg && typeof sessionArg.inTransaction === 'function' ? sessionArg : null;
    const opts = session ? { session } : {};

    let orderQuery = Order.findById(orderId);
    if (session) orderQuery = orderQuery.session(session);
    const order = await orderQuery;
    if (!order) throw new ApiError(404, 'Order not found', ERROR_CODES.NOT_FOUND);

    const paymentReceivedAt = confirmedPaymentDate ? new Date(confirmedPaymentDate) : (order.paidAt || new Date());
    // Exactly 7 days holding period: payment received timestamp + 7 days
    const payoutEligibleAt = new Date(paymentReceivedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    const commissionRate = await this.getCommissionRate();

    let subordersQuery = VendorOrder.find({ parentOrderId: orderId });
    if (session) subordersQuery = subordersQuery.session(session);
    const suborders = await subordersQuery;

    const createdPayouts = [];
    const createdCommissions = [];

    for (const suborder of suborders) {
      // Idempotency: Prevent duplicate payouts for the same suborder
      let existingPayoutQuery = VendorPayout.findOne({ suborderId: suborder._id });
      if (session) existingPayoutQuery = existingPayoutQuery.session(session);
      const existingPayout = await existingPayoutQuery;

      if (existingPayout) {
        createdPayouts.push(existingPayout);
        continue;
      }

      let suborderGross = 0;
      let suborderCommission = 0;
      let suborderNetPayable = 0;
      let itemCount = 0;

      // Calculate commission per product line item
      const suborderItems = suborder.items || [];
      for (let i = 0; i < suborderItems.length; i++) {
        const item = suborderItems[i];
        const linePrice = moneyUtils.roundMoney(
          item.lineTotal || (Number(item.unitPrice || item.price || 0) * Number(item.quantity || 1))
        );
        const itemQty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = item.unitPrice || item.price || moneyUtils.roundMoney(linePrice / itemQty);

        const { commissionAmount, vendorPayableAmount } = this.calculateProductCommission(linePrice, commissionRate);

        const orderItemId = item._id ? item._id.toString() : `${suborder._id}_item_${i}`;

        // Upsert CommissionTransaction
        let commTxQuery = CommissionTransaction.findOne({ orderId: order._id, orderItemId });
        if (session) commTxQuery = commTxQuery.session(session);
        let commTx = await commTxQuery;

        if (!commTx) {
          const newCommDocs = await CommissionTransaction.create(
            [
              {
                orderId: order._id,
                suborderId: suborder._id,
                orderItemId,
                vendorId: suborder.vendorId,
                productId: item.productId,
                productName: item.productNameSnapshot || item.name || 'Product',
                productSku: item.skuSnapshot || item.variantSku || '',
                quantity: itemQty,
                unitPrice,
                sellingPrice: linePrice,
                commissionPercentage: commissionRate,
                commissionAmount,
                vendorPayableAmount,
                paymentReceivedAt,
                status: 'HOLD',
              },
            ],
            opts
          );
          commTx = newCommDocs[0];
        }

        createdCommissions.push(commTx);

        suborderGross = moneyUtils.addMoney(suborderGross, linePrice);
        suborderCommission = moneyUtils.addMoney(suborderCommission, commissionAmount);
        suborderNetPayable = moneyUtils.addMoney(suborderNetPayable, vendorPayableAmount);
        itemCount += itemQty;
      }

      // Vendor Bank details snapshot for payout review
      let bankQuery = VendorBankAccount.findOne({ vendorId: suborder.vendorId });
      if (session) bankQuery = bankQuery.session(session);
      const bank = await bankQuery;

      const bankSnapshot = bank
        ? {
            accountHolderName: bank.accountHolderName || '',
            bankName: bank.bankName || '',
            accountNumberMasked: bank.accountNumberMasked || '',
            ifscCode: bank.ifscCode || '',
            upiId: bank.upiId || '',
            verificationStatus: bank.verificationStatus || 'PENDING',
          }
        : null;

      const dateStr = paymentReceivedAt.toISOString().slice(0, 10).replace(/-/g, '');
      const randSuffix = Math.floor(10000 + Math.random() * 90000);
      const payoutNumber = `PO-${dateStr}-${randSuffix}`;

      // Create VendorPayout in HOLD status (7-day holding period)
      const payoutDocs = await VendorPayout.create(
        [
          {
            payoutNumber,
            vendorId: suborder.vendorId,
            orderId: order._id,
            suborderId: suborder._id,
            paymentTransactionId: paymentTransactionId || order.paymentId || '',
            grossAmount: suborderGross,
            commissionPercentage: commissionRate,
            commissionAmount: suborderCommission,
            netPayableAmount: suborderNetPayable,
            itemCount,
            paymentReceivedAt,
            payoutEligibleAt,
            payoutStatus: 'HOLD',
            vendorBankSnapshot: bankSnapshot,
          },
        ],
        opts
      );

      const newPayout = payoutDocs[0];
      createdPayouts.push(newPayout);

      // Synchronize legacy VendorSettlement model
      await VendorSettlement.findOneAndUpdate(
        { suborderId: suborder._id },
        {
          vendorId: suborder.vendorId,
          suborderId: suborder._id,
          grossAmount: suborderGross,
          commissionRate,
          commissionAmount: suborderCommission,
          platformCommission: suborderCommission,
          vendorPayoutAmount: suborderNetPayable,
          netPayable: suborderNetPayable,
          status: 'ON_HOLD',
          settlementStatus: 'ON_HOLD',
          eligibleAt: payoutEligibleAt,
        },
        { upsert: true, ...opts }
      );

      // Record in PlatformCommissionLedger
      await PlatformCommissionLedger.create(
        [
          {
            ledgerId: `PCL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
            orderId: order._id,
            suborderId: suborder._id,
            vendorId: suborder.vendorId,
            commissionAmount: suborderCommission,
            commissionPercentage: commissionRate,
            transactionType: 'COMMISSION_CREDIT',
            transactionReference: payoutNumber,
            description: `5% platform commission held on Order #${order.orderNumber || order._id}`,
            metadata: { grossAmount: suborderGross, netPayable: suborderNetPayable },
          },
        ],
        opts
      );
    }

    return {
      orderId: order._id,
      payoutsCount: createdPayouts.length,
      commissionsCount: createdCommissions.length,
      payoutEligibleAt,
      payouts: createdPayouts,
    };
  },

  /**
   * 4. Scheduled 7-Day Eligibility Processor
   * Transitions all HOLD payouts whose 7-day period has passed to ELIGIBLE.
   */
  async processSevenDayEligibility(cutoffDate = new Date()) {
    const eligibleQuery = {
      payoutStatus: 'HOLD',
      payoutEligibleAt: { $lte: cutoffDate },
    };

    const pendingPayouts = await VendorPayout.find(eligibleQuery);
    if (!pendingPayouts || pendingPayouts.length === 0) {
      return { processedCount: 0, eligiblePayouts: [] };
    }

    const processedIds = [];

    for (const payout of pendingPayouts) {
      payout.payoutStatus = 'ELIGIBLE';
      await payout.save();

      // Update commission lines
      await CommissionTransaction.updateMany(
        { suborderId: payout.suborderId, status: 'HOLD' },
        { status: 'ELIGIBLE' }
      );

      // Update companion settlement
      await VendorSettlement.findOneAndUpdate(
        { suborderId: payout.suborderId },
        { status: 'ELIGIBLE', settlementStatus: 'ELIGIBLE' }
      );

      processedIds.push(payout._id);

      // Notify Super Admin
      try {
        await Notification.create({
          userId: null,
          title: 'Vendor Payout Eligible for Review',
          message: `Payout ${payout.payoutNumber} for ₹${payout.netPayableAmount} is now eligible after the 7-day hold period.`,
          type: 'FINANCE',
          metadata: { payoutId: payout._id, vendorId: payout.vendorId },
        });
      } catch {
        // Notification failure should not break payout state
      }
    }

    return {
      processedCount: processedIds.length,
      eligiblePayoutIds: processedIds,
    };
  },

  /**
   * 5. Super Admin Release Vendor Payout
   */
  async releaseVendorPayout({
    payoutId,
    adminUserId,
    payoutReference = '',
    adminNotes = '',
    idempotencyKey = null,
  }) {
    if (!payoutId) throw new ApiError(400, 'Payout ID is required', ERROR_CODES.BAD_REQUEST);

    const payout = await VendorPayout.findById(payoutId);
    if (!payout) throw new ApiError(404, 'Vendor payout record not found', ERROR_CODES.NOT_FOUND);

    // Prevent duplicate payouts via idempotency key
    if (idempotencyKey && payout.idempotencyKey === idempotencyKey && payout.payoutStatus === 'PAID') {
      return payout;
    }

    if (payout.payoutStatus === 'PAID') {
      throw new ApiError(400, 'This payout has already been paid out to the vendor', ERROR_CODES.BAD_REQUEST);
    }

    if (payout.payoutStatus === 'HOLD') {
      const remainingDays = Math.ceil((new Date(payout.payoutEligibleAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      throw new ApiError(
        400,
        `Cannot release payout. 7-day holding period has not elapsed yet. Remaining: ${Math.max(1, remainingDays)} day(s). Expected: ${payout.payoutEligibleAt.toISOString().slice(0, 10)}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (payout.payoutStatus !== 'ELIGIBLE') {
      throw new ApiError(
        400,
        `Payout cannot be released in "${payout.payoutStatus}" status. Must be in "ELIGIBLE" status.`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Verify vendor bank account
    const bank = await VendorBankAccount.findOne({ vendorId: payout.vendorId });
    if (!bank || !bank.accountNumberMasked || !bank.ifscCode) {
      throw new ApiError(
        400,
        'Cannot initiate payout: Vendor has not configured a valid bank account or IFSC code',
        ERROR_CODES.BAD_REQUEST
      );
    }

    const ref = payoutReference ? String(payoutReference).trim() : `UTR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    payout.payoutStatus = 'PAID';
    payout.paidAt = new Date();
    payout.payoutReference = ref;
    payout.adminNotes = adminNotes || 'Approved and released by Super Admin';
    if (idempotencyKey) payout.idempotencyKey = idempotencyKey;
    await payout.save();

    // Update CommissionTransaction records
    await CommissionTransaction.updateMany(
      { suborderId: payout.suborderId },
      { status: 'PAID', paidAt: payout.paidAt, payoutReference: ref }
    );

    // Update companion settlement
    await VendorSettlement.findOneAndUpdate(
      { suborderId: payout.suborderId },
      { status: 'PAID', settlementStatus: 'PAID', paidAt: payout.paidAt, payoutReference: ref }
    );

    // Record Vendor Ledger credit
    try {
      await VendorLedger.create({
        vendorId: payout.vendorId,
        type: 'SETTLEMENT',
        amount: payout.netPayableAmount,
        direction: 'CREDIT',
        referenceId: ref,
        description: `7-day payout released for Order #${payout.orderId}`,
        metadata: { payoutId: payout._id, payoutNumber: payout.payoutNumber },
      });
    } catch {
      // Vendor ledger optional
    }

    // Log in PlatformCommissionLedger
    await PlatformCommissionLedger.create({
      ledgerId: `PCL-SETTLE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      orderId: payout.orderId,
      suborderId: payout.suborderId,
      vendorId: payout.vendorId,
      commissionAmount: payout.commissionAmount,
      commissionPercentage: payout.commissionPercentage,
      transactionType: 'PAYOUT_SETTLED',
      transactionReference: ref,
      description: `Vendor payout released: Gross ₹${payout.grossAmount}, Commission ₹${payout.commissionAmount}, Net ₹${payout.netPayableAmount}`,
    });

    // Notify Vendor
    const vendor = await Vendor.findById(payout.vendorId);
    if (vendor && vendor.userId) {
      try {
        await Notification.create({
          userId: vendor.userId,
          title: 'Payout Released to Your Bank Account! 💰',
          message: `Your payout of ₹${payout.netPayableAmount} for Order #${payout.orderId} has been released. Reference: ${ref}`,
          type: 'FINANCE',
          metadata: { payoutId: payout._id, reference: ref },
        });
      } catch {}
    }

    return payout;
  },

  /**
   * 6. Refund or Order Cancellation Handling
   */
  async handleOrderCancellationOrRefund({
    orderId,
    suborderId = null,
    reason = 'Order Cancelled by Customer',
  }) {
    const query = { orderId };
    if (suborderId) query.suborderId = suborderId;

    const payouts = await VendorPayout.find(query);
    const results = [];

    for (const payout of payouts) {
      if (['HOLD', 'ELIGIBLE'].includes(payout.payoutStatus)) {
        payout.payoutStatus = 'CANCELLED';
        payout.reversalReason = reason;
        payout.reversedAt = new Date();
        await payout.save();

        await CommissionTransaction.updateMany(
          { suborderId: payout.suborderId },
          { status: 'CANCELLED' }
        );

        await VendorSettlement.findOneAndUpdate(
          { suborderId: payout.suborderId },
          { status: 'REVERSED', settlementStatus: 'REVERSED' }
        );

        // Record reversal in PlatformCommissionLedger
        await PlatformCommissionLedger.create({
          ledgerId: `PCL-REV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          orderId: payout.orderId,
          suborderId: payout.suborderId,
          vendorId: payout.vendorId,
          commissionAmount: payout.commissionAmount,
          commissionPercentage: payout.commissionPercentage,
          transactionType: 'COMMISSION_REVERSAL',
          transactionReference: `REV-${payout.payoutNumber}`,
          description: `Commission reversed due to: ${reason}`,
        });

        results.push({ payoutId: payout._id, status: 'CANCELLED' });
      } else if (payout.payoutStatus === 'PAID') {
        // Payout was already transferred; create recovery flag
        payout.payoutStatus = 'REFUNDED';
        payout.reversalReason = `Post-payout refund: ${reason}`;
        payout.reversedAt = new Date();
        await payout.save();

        results.push({ payoutId: payout._id, status: 'REFUNDED_AFTER_PAYOUT', requiresDebitRecovery: true });
      }
    }

    return results;
  },

  /**
   * 7. Super Admin Financial Metrics
   */
  async getSuperAdminMetrics() {
    const allPayouts = await VendorPayout.find({ payoutStatus: { $ne: 'CANCELLED' } });

    let totalCustomerPayments = 0;
    let totalPlatformCommissionEarned = 0;
    let totalVendorPayableAmount = 0;
    let totalPayoutsOnHold = 0;
    let totalEligiblePayouts = 0;
    let totalCompletedPayouts = 0;
    let pendingPayoutsCount = 0;

    for (const p of allPayouts) {
      totalCustomerPayments = moneyUtils.addMoney(totalCustomerPayments, p.grossAmount);
      totalPlatformCommissionEarned = moneyUtils.addMoney(totalPlatformCommissionEarned, p.commissionAmount);
      totalVendorPayableAmount = moneyUtils.addMoney(totalVendorPayableAmount, p.netPayableAmount);

      if (p.payoutStatus === 'HOLD') {
        totalPayoutsOnHold = moneyUtils.addMoney(totalPayoutsOnHold, p.netPayableAmount);
        pendingPayoutsCount++;
      } else if (p.payoutStatus === 'ELIGIBLE') {
        totalEligiblePayouts = moneyUtils.addMoney(totalEligiblePayouts, p.netPayableAmount);
        pendingPayoutsCount++;
      } else if (p.payoutStatus === 'PAID') {
        totalCompletedPayouts = moneyUtils.addMoney(totalCompletedPayouts, p.netPayableAmount);
      }
    }

    const currentCommissionRate = await this.getCommissionRate();

    return {
      totalCustomerPayments,
      totalPlatformCommissionEarned,
      totalVendorPayableAmount,
      totalPayoutsOnHold,
      totalEligiblePayouts,
      totalCompletedPayouts,
      pendingPayoutsCount,
      currentCommissionRate,
    };
  },

  /**
   * 8. Vendor Financial Metrics
   */
  async getVendorMetrics(vendorId) {
    const vendorPayouts = await VendorPayout.find({
      vendorId,
      payoutStatus: { $nin: ['CANCELLED', 'REFUNDED'] },
    });

    let totalSales = 0;
    let totalCommissionDeducted = 0;
    let totalEarnings = 0;
    let amountOnHold = 0;
    let amountEligible = 0;
    let amountPaid = 0;

    for (const p of vendorPayouts) {
      totalSales = moneyUtils.addMoney(totalSales, p.grossAmount);
      totalCommissionDeducted = moneyUtils.addMoney(totalCommissionDeducted, p.commissionAmount);
      totalEarnings = moneyUtils.addMoney(totalEarnings, p.netPayableAmount);

      if (p.payoutStatus === 'HOLD') {
        amountOnHold = moneyUtils.addMoney(amountOnHold, p.netPayableAmount);
      } else if (p.payoutStatus === 'ELIGIBLE') {
        amountEligible = moneyUtils.addMoney(amountEligible, p.netPayableAmount);
      } else if (p.payoutStatus === 'PAID') {
        amountPaid = moneyUtils.addMoney(amountPaid, p.netPayableAmount);
      }
    }

    return {
      totalSales,
      totalCommissionDeducted,
      totalEarnings,
      amountOnHold,
      amountEligible,
      amountPaid,
    };
  },
};

export default marketplaceCommissionService;

