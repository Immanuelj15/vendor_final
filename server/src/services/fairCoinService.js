import { CoinTransaction } from '../models/CoinTransaction.js';
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';
import { notificationService } from './notificationService.js';
import { FAIR_COIN_CONVERSION } from '../constants/coinConstants.js';

export const fairCoinService = {
  /**
   * Authoritative fixed conversion helpers: 10 Fair Coins = ₹1
   */
  getConversionRate() {
    return FAIR_COIN_CONVERSION.COINS_PER_RUPEE; // 10
  },

  toRupees(coins) {
    return Math.floor(Math.max(0, Number(coins) || 0) / FAIR_COIN_CONVERSION.COINS_PER_RUPEE);
  },

  toCoins(rupees) {
    return Math.round(Math.max(0, Number(rupees) || 0) * FAIR_COIN_CONVERSION.COINS_PER_RUPEE);
  },

  /**
   * Retrieves the current maximum Fair Coins a customer can redeem per purchase.
   * If unset or higher, defaults to a high capacity (e.g. 50000) so customers aren't artificially restricted below order total.
   */
  async getMaxCoinsPerPurchase() {
    try {
      const setting = await Settings.findOne({ key: 'MAX_FAIR_COINS_PER_PURCHASE' });
      if (setting && setting.value !== undefined && setting.value !== null) {
        const val = Number(setting.value);
        if (!isNaN(val) && Number.isInteger(val) && val > 0) {
          return val;
        }
      }
    } catch (err) {
      console.error('Error fetching MAX_FAIR_COINS_PER_PURCHASE setting:', err);
    }
    return 10000;
  },

  /**
   * Initial Fair Coins Allocation:
   * Every newly registered customer receives exactly 500 Fair Coins.
   * Strictly idempotent: awarded only once per customer.
   */
  async creditWelcomeReward(userId) {
    if (!userId) return null;

    const user = await User.findById(userId);
    if (!user) return null;

    // Idempotency check 1: check user flag
    if (user.welcomeCoinsAwarded) {
      return null;
    }

    // Idempotency check 2: check transaction ledger
    const existingTx = await CoinTransaction.findOne({
      userId,
      type: 'WELCOME',
    });
    if (existingTx) {
      if (!user.welcomeCoinsAwarded) {
        user.welcomeCoinsAwarded = true;
        await user.save();
      }
      return existingTx;
    }

    const welcomeAmount = 500;
    const balanceBefore = user.fairCoinBalance || 0;
    const balanceAfter = balanceBefore + welcomeAmount;
    const rupeeEquivalent = welcomeAmount / 10; // ₹50

    // Atomically increment balance and set flag
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, welcomeCoinsAwarded: { $ne: true } },
      {
        $inc: { fairCoinBalance: welcomeAmount },
        $set: { welcomeCoinsAwarded: true },
      },
      { new: true }
    );

    if (!updatedUser) {
      return null; // Concurrently already awarded
    }

    const transaction = await CoinTransaction.create({
      userId,
      type: 'WELCOME',
      amount: welcomeAmount,
      rupeeEquivalent,
      balanceBefore,
      balanceAfter,
      source: 'REGISTRATION',
      description: 'Welcome reward: 500 Fair Coins credited on registration',
      status: 'COMPLETED',
      idempotencyKey: `WELCOME_${userId}`,
    });

    try {
      await notificationService.createNotification(
        {
          userId,
          title: '🎉 Welcome to BAAPOO MART!',
          message: '500 Fair Coins (₹50 value) have been credited to your rewards wallet!',
          type: 'COIN_EARNED',
          link: '/customer/wallet',
        },
        { dedupeKey: `${userId}:WELCOME_COINS` }
      );
    } catch (err) {
      console.error('Failed to send welcome coin notification:', err.message);
    }

    return transaction;
  },

  /**
   * Retrieves Fair Coins summary for a user.
   * Available = fairCoinBalance - fairCoinReserved.
   * Enforces 10 Fair Coins = ₹1.
   */
  async getOrCreateWallet(userId) {
    const user = await User.findById(userId).select('fairCoinBalance fairCoinReserved role welcomeCoinsAwarded');
    if (!user) {
      throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);
    }

    const coinsPerRupee = FAIR_COIN_CONVERSION.COINS_PER_RUPEE; // 10
    const rupeesPerCoin = FAIR_COIN_CONVERSION.RUPEES_PER_COIN; // 0.10

    // Clean up any stale reservations from pending orders if needed
    const balance = Math.max(0, user.fairCoinBalance || 0);
    const reserved = Math.max(0, user.fairCoinReserved || 0);
    const available = Math.max(0, balance - reserved);
    const rupeeValue = Math.round((balance / coinsPerRupee) * 100) / 100;
    const availableRupeeValue = Math.round((available / coinsPerRupee) * 100) / 100;

    // Aggregate lifetime earned, redeemed, and reversed from CoinTransactions
    const [earnedAgg, redeemedAgg, reversedAgg, maxCoinsPerPurchase] = await Promise.all([
      CoinTransaction.aggregate([
        {
          $match: {
            userId: user._id,
            type: { $in: ['WELCOME', 'EARNED', 'CREDIT', 'BONUS', 'PURCHASE_REWARD', 'SPIN_REWARD', 'REFERRAL_REWARD', 'REFUNDED'] },
            status: { $ne: 'FAILED' },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CoinTransaction.aggregate([
        {
          $match: {
            userId: user._id,
            type: { $in: ['REDEEMED', 'DEBIT'] },
            status: 'COMPLETED',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CoinTransaction.aggregate([
        {
          $match: {
            userId: user._id,
            $or: [{ type: 'REVERSED' }, { status: 'REVERSED' }],
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.getMaxCoinsPerPurchase(),
    ]);

    const totalEarned = earnedAgg[0]?.total || balance;
    const totalRedeemed = redeemedAgg[0]?.total || 0;
    const totalReversed = reversedAgg[0]?.total || 0;

    return {
      userId: user._id,
      balance,
      reserved,
      available,
      coinsPerRupee,
      rupeesPerCoin,
      rupeeValue,
      availableRupeeValue,
      conversionRate: coinsPerRupee,
      conversionText: FAIR_COIN_CONVERSION.CONVERSION_TEXT,
      maxCoinsPerPurchase,
      totalEarned,
      totalRedeemed,
      totalReversed,
      totalSpent: totalRedeemed,
    };
  },

  /**
   * Safely reserves Fair Coins during online checkout to prevent concurrent double-spending.
   */
  async reserveCoins({ userId, amount }) {
    if (!amount || amount <= 0) return null;
    const coinsNum = Math.round(Number(amount));

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        $expr: {
          $gte: [
            { $subtract: ['$fairCoinBalance', { $ifNull: ['$fairCoinReserved', 0] }] },
            coinsNum,
          ],
        },
      },
      {
        $inc: { fairCoinReserved: coinsNum },
      },
      { new: true }
    );

    if (!updatedUser) {
      const u = await User.findById(userId).select('fairCoinBalance fairCoinReserved');
      const avail = Math.max(0, (u?.fairCoinBalance || 0) - (u?.fairCoinReserved || 0));
      throw new ApiError(
        400,
        `Cannot redeem ${coinsNum} Fair Coins. Your available unreserved balance is ${avail} coins.`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    return updatedUser;
  },

  /**
   * Releases previously reserved Fair Coins if payment fails, is cancelled, or expires.
   */
  async releaseReservedCoins({ userId, amount }) {
    if (!amount || amount <= 0) return;
    const coinsNum = Math.round(Number(amount));

    await User.findByIdAndUpdate(userId, {
      $inc: { fairCoinReserved: -coinsNum },
    });

    // Safeguard to prevent negative fairCoinReserved
    await User.updateOne(
      { _id: userId, fairCoinReserved: { $lt: 0 } },
      { $set: { fairCoinReserved: 0 } }
    );
  },

  /**
   * Finalizes coin redemption after successful online payment.
   * Decrements fairCoinBalance and releases the reservation atomically.
   */
  async commitRedemption({ userId, amount, orderId, orderNumber, description = '' }) {
    if (!amount || amount <= 0) return null;
    const coinsNum = Math.round(Number(amount));
    const orderRef = orderNumber || orderId?.toString() || '';
    const idempotencyKey = `REDEEMED_${orderId || orderRef}`;

    // Idempotency check: prevent duplicate deduction
    const existingTx = await CoinTransaction.findOne({
      idempotencyKey,
      type: 'REDEEMED',
    });
    if (existingTx) {
      return existingTx;
    }

    // Atomically decrement balance and reserved count
    const userBefore = await User.findById(userId).select('fairCoinBalance');
    if (!userBefore) throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);

    const balanceBefore = userBefore.fairCoinBalance || 0;

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, fairCoinBalance: { $gte: coinsNum } },
      {
        $inc: {
          fairCoinBalance: -coinsNum,
          fairCoinReserved: -coinsNum,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new ApiError(400, 'Insufficient Fair Coins balance to finalize redemption', ERROR_CODES.BAD_REQUEST);
    }

    // Safeguard: ensure reserved is not negative
    await User.updateOne({ _id: userId, fairCoinReserved: { $lt: 0 } }, { $set: { fairCoinReserved: 0 } });

    const balanceAfter = updatedUser.fairCoinBalance;
    const rupeeDiscount = Math.floor(coinsNum / 10);

    const transaction = await CoinTransaction.create({
      userId,
      orderId: orderId || null,
      type: 'REDEEMED',
      amount: coinsNum,
      rupeeEquivalent: rupeeDiscount,
      balanceBefore,
      balanceAfter,
      source: 'CHECKOUT_REDEMPTION',
      referenceId: orderRef,
      idempotencyKey,
      description: description || `Redeemed ${coinsNum} Fair Coins for ₹${rupeeDiscount} discount on order #${orderRef}`,
      status: 'COMPLETED',
    });

    try {
      await notificationService.createNotification(
        {
          userId,
          title: 'Fair Coins Redeemed',
          message: `Redeemed ${coinsNum} Fair Coins (₹${rupeeDiscount} discount) for order #${orderRef}.`,
          type: 'FAIR_COINS',
          link: '/customer/wallet',
        },
        { dedupeKey: `${transaction._id}:REDEEMED` }
      );
    } catch (err) {
      console.error('Notification error on coin redemption:', err.message);
    }

    return transaction;
  },

  /**
   * For COD orders: directly debits coins on confirmed order placement (no pre-reservation).
   */
  async debitCoinsCod({ userId, amount, orderId, orderNumber, description = '' }) {
    if (!amount || amount <= 0) return null;
    const coinsNum = Math.round(Number(amount));
    const orderRef = orderNumber || orderId?.toString() || '';
    const idempotencyKey = `REDEEMED_${orderId || orderRef}`;

    const existingTx = await CoinTransaction.findOne({
      idempotencyKey,
      type: 'REDEEMED',
    });
    if (existingTx) return existingTx;

    const userBefore = await User.findById(userId).select('fairCoinBalance');
    if (!userBefore) throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);

    const balanceBefore = userBefore.fairCoinBalance || 0;

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, fairCoinBalance: { $gte: coinsNum } },
      {
        $inc: { fairCoinBalance: -coinsNum },
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new ApiError(400, 'Insufficient Fair Coins balance', ERROR_CODES.BAD_REQUEST);
    }

    const balanceAfter = updatedUser.fairCoinBalance;
    const rupeeDiscount = Math.floor(coinsNum / 10);

    const transaction = await CoinTransaction.create({
      userId,
      orderId: orderId || null,
      type: 'REDEEMED',
      amount: coinsNum,
      rupeeEquivalent: rupeeDiscount,
      balanceBefore,
      balanceAfter,
      source: 'CHECKOUT_REDEMPTION',
      referenceId: orderRef,
      idempotencyKey,
      description: description || `Redeemed ${coinsNum} Fair Coins for ₹${rupeeDiscount} discount on order #${orderRef}`,
      status: 'COMPLETED',
    });

    return transaction;
  },

  /**
   * Earning System:
   * Customers receive 100 Fair Coins for every eligible product purchased.
   * Calculated based on product quantities (e.g. 1 unit = 100, 3 units = 300, 5 units = 500).
   * Strictly awarded only on confirmed/paid orders.
   * Idempotent: repeated calls do not award duplicate coins.
   */
  async processPurchaseReward(arg1, arg2, arg3, arg4) {
    let userId, orderId, orderNumber, items;
    if (typeof arg1 === 'object' && arg1 !== null && !arg2) {
      ({ userId, orderId, orderNumber, items } = arg1);
    } else {
      userId = arg1;
      orderId = arg2;
      orderNumber = arg3;
      items = arg4;
      if (Array.isArray(arg3) && !arg4) {
        items = arg3;
        orderNumber = arg2;
        orderId = null;
      }
    }

    if (!userId || !items || !items.length) return null;
    const orderRef = orderNumber || orderId?.toString() || '';
    const idempotencyKey = `EARNED_${orderId || orderRef}`;

    // Idempotency check: prevent duplicate reward for the same order
    const existingTx = await CoinTransaction.findOne({
      userId,
      $or: [
        { idempotencyKey },
        { referenceId: orderRef, type: { $in: ['EARNED', 'PURCHASE_REWARD'] } },
      ],
    });
    if (existingTx) {
      return existingTx;
    }

    // Calculate total quantity of eligible products
    const eligibleQuantity = items.reduce((sum, item) => sum + (Math.max(1, Number(item.quantity) || 1)), 0);
    const earnedCoins = eligibleQuantity * 100;

    if (earnedCoins <= 0) return null;

    const userBefore = await User.findById(userId).select('fairCoinBalance');
    if (!userBefore) return null;

    const balanceBefore = userBefore.fairCoinBalance || 0;
    const balanceAfter = balanceBefore + earnedCoins;
    const rupeeEquivalent = earnedCoins / 10;

    await User.findByIdAndUpdate(userId, {
      $inc: { fairCoinBalance: earnedCoins },
    });

    const transaction = await CoinTransaction.create({
      userId,
      orderId: orderId || null,
      type: 'EARNED',
      amount: earnedCoins,
      rupeeEquivalent,
      balanceBefore,
      balanceAfter,
      source: 'PRODUCT_PURCHASE',
      referenceId: orderRef,
      idempotencyKey,
      description: `Product purchase reward: ${earnedCoins} Fair Coins for order #${orderRef} (${eligibleQuantity} eligible item${eligibleQuantity > 1 ? 's' : ''})`,
      status: 'COMPLETED',
    });

    try {
      await notificationService.createNotification(
        {
          userId,
          title: '🎁 Fair Coins Earned!',
          message: `You earned ${earnedCoins} Fair Coins for purchasing ${eligibleQuantity} product${eligibleQuantity > 1 ? 's' : ''} in Order #${orderRef}!`,
          type: 'COIN_EARNED',
          link: '/customer/wallet',
        },
        { dedupeKey: `${transaction._id}:PURCHASE_REWARD` }
      );
    } catch (err) {
      console.error('Failed to notify coin purchase reward:', err.message);
    }

    return transaction;
  },

  /**
   * Reverses earned coins when an order is cancelled or refunded.
   */
  async reversePurchaseReward(arg1, arg2, arg3) {
    let userId, orderId, orderNumber;
    if (typeof arg1 === 'object' && arg1 !== null && !arg2) {
      ({ userId, orderId, orderNumber } = arg1);
    } else {
      userId = arg1;
      orderId = arg2;
      orderNumber = arg3;
    }
    const orderRef = orderNumber || orderId?.toString() || '';
    const idempotencyKey = `REVERSED_${orderId || orderRef}`;

    // Check if reversal already done
    const existingReversal = await CoinTransaction.findOne({
      idempotencyKey,
      type: 'REVERSED',
    });
    if (existingReversal) return existingReversal;

    // Find the original earning transaction
    const originalTx = await CoinTransaction.findOne({
      userId,
      referenceId: orderRef,
      type: { $in: ['EARNED', 'PURCHASE_REWARD'] },
      status: 'COMPLETED',
    });

    if (!originalTx) return null;

    const amountToReverse = originalTx.amount;
    const userBefore = await User.findById(userId).select('fairCoinBalance');
    if (!userBefore) return null;

    const balanceBefore = userBefore.fairCoinBalance || 0;
    const balanceAfter = Math.max(0, balanceBefore - amountToReverse);

    // Deduct coins from user balance safely
    await User.findByIdAndUpdate(userId, {
      $inc: { fairCoinBalance: -amountToReverse },
    });
    // Ensure balance does not drop below 0
    await User.updateOne({ _id: userId, fairCoinBalance: { $lt: 0 } }, { $set: { fairCoinBalance: 0 } });

    // Mark original transaction as REVERSED
    originalTx.status = 'REVERSED';
    await originalTx.save();

    const transaction = await CoinTransaction.create({
      userId,
      orderId: orderId || null,
      type: 'REVERSED',
      amount: amountToReverse,
      rupeeEquivalent: amountToReverse / 10,
      balanceBefore,
      balanceAfter,
      source: 'ORDER_CANCELLATION',
      referenceId: orderRef,
      idempotencyKey,
      description: `Order cancellation: reversed ${amountToReverse} Fair Coins for order #${orderRef}`,
      status: 'REVERSED',
    });

    return transaction;
  },

  /**
   * Restores redeemed coins to customer when an order is cancelled or refunded.
   */
  async refundRedeemedCoins(arg1, arg2, arg3, arg4) {
    let userId, orderId, orderNumber, amount;
    if (typeof arg1 === 'object' && arg1 !== null && !arg2) {
      ({ userId, orderId, orderNumber, amount } = arg1);
    } else {
      userId = arg1;
      orderId = arg2;
      orderNumber = arg3;
      amount = arg4;
    }
    if (!amount || amount <= 0) return null;
    const coinsNum = Math.round(Number(amount));
    const orderRef = orderNumber || orderId?.toString() || '';
    const idempotencyKey = `REFUNDED_${orderId || orderRef}`;

    // Idempotency check: prevent duplicate refund of coins
    const existingRefund = await CoinTransaction.findOne({
      idempotencyKey,
      type: 'REFUNDED',
    });
    if (existingRefund) return existingRefund;

    const userBefore = await User.findById(userId).select('fairCoinBalance');
    if (!userBefore) return null;

    const balanceBefore = userBefore.fairCoinBalance || 0;
    const balanceAfter = balanceBefore + coinsNum;

    await User.findByIdAndUpdate(userId, {
      $inc: { fairCoinBalance: coinsNum },
    });

    const transaction = await CoinTransaction.create({
      userId,
      orderId: orderId || null,
      type: 'REFUNDED',
      amount: coinsNum,
      rupeeEquivalent: coinsNum / 10,
      balanceBefore,
      balanceAfter,
      source: 'ORDER_CANCELLATION',
      referenceId: orderRef,
      idempotencyKey,
      description: `Order cancellation: restored ${coinsNum} redeemed Fair Coins for order #${orderRef}`,
      status: 'COMPLETED',
    });

    return transaction;
  },

  /**
   * Generic credit method (backwards-compatible with spin wheel, admin credits, etc.).
   */
  async creditCoins({ userId, amount, type = 'CREDIT', source, referenceId = '', description = '' }) {
    if (typeof amount !== 'number' || amount <= 0) return null;
    const roundedAmount = Math.round(amount);

    const userBefore = await User.findById(userId).select('fairCoinBalance');
    if (!userBefore) throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);

    const balanceBefore = userBefore.fairCoinBalance || 0;
    const balanceAfter = balanceBefore + roundedAmount;

    await User.findByIdAndUpdate(userId, {
      $inc: { fairCoinBalance: roundedAmount },
    });

    const transaction = await CoinTransaction.create({
      userId,
      type,
      amount: roundedAmount,
      rupeeEquivalent: roundedAmount / 10,
      balanceBefore,
      balanceAfter,
      source: source || 'MANUAL_CREDIT',
      referenceId,
      description: description || `Credited ${roundedAmount} Fair Coins`,
      status: 'COMPLETED',
    });

    return transaction;
  },

  /**
   * Generic debit method (backwards-compatible).
   */
  async debitCoins({ userId, amount, type = 'DEBIT', source, referenceId = '', description = '' }) {
    if (typeof amount !== 'number' || amount <= 0) return null;
    const roundedAmount = Math.round(amount);

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        fairCoinBalance: { $gte: roundedAmount },
      },
      {
        $inc: { fairCoinBalance: -roundedAmount },
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new ApiError(400, 'Insufficient Fair Coins balance', ERROR_CODES.BAD_REQUEST);
    }

    const balanceAfter = updatedUser.fairCoinBalance;
    const balanceBefore = balanceAfter + roundedAmount;

    const transaction = await CoinTransaction.create({
      userId,
      type,
      amount: roundedAmount,
      rupeeEquivalent: roundedAmount / 10,
      balanceBefore,
      balanceAfter,
      source: source || 'MANUAL_DEBIT',
      referenceId,
      description: description || `Debited ${roundedAmount} Fair Coins`,
      status: 'COMPLETED',
    });

    return transaction;
  },

  /**
   * Retrieves paginated CoinTransactions for a user.
   */
  async getTransactions(userId, { page = 1, limit = 20, type = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (type) query.type = type;

    const [transactions, total] = await Promise.all([
      CoinTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CoinTransaction.countDocuments(query),
    ]);

    return {
      transactions,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    };
  },

  /**
   * Super Admin Overview: Total Credited, Total Redeemed, Total Reversed, Total Outstanding.
   */
  async getSuperAdminAnalytics() {
    const [creditedAgg, redeemedAgg, reversedAgg, outstandingAgg, customerCount, customersWithBalance] = await Promise.all([
      CoinTransaction.aggregate([
        {
          $match: {
            type: { $in: ['WELCOME', 'EARNED', 'CREDIT', 'BONUS', 'PURCHASE_REWARD', 'SPIN_REWARD', 'REFERRAL_REWARD', 'REFUNDED'] },
            status: { $ne: 'FAILED' },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CoinTransaction.aggregate([
        {
          $match: {
            type: { $in: ['REDEEMED', 'DEBIT'] },
            status: 'COMPLETED',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CoinTransaction.aggregate([
        {
          $match: {
            $or: [{ type: 'REVERSED' }, { status: 'REVERSED' }],
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      User.aggregate([
        { $match: { role: { $in: ['CUSTOMER', 'USER'] } } },
        { $group: { _id: null, total: { $sum: '$fairCoinBalance' } } },
      ]),
      User.countDocuments({ role: { $in: ['CUSTOMER', 'USER'] } }),
      User.countDocuments({ role: { $in: ['CUSTOMER', 'USER'] }, fairCoinBalance: { $gt: 0 } }),
    ]);

    const totalCredited = creditedAgg[0]?.total || 0;
    const totalRedeemed = redeemedAgg[0]?.total || 0;
    const totalReversed = reversedAgg[0]?.total || 0;
    const totalOutstanding = outstandingAgg[0]?.total || 0;

    return {
      totalCredited,
      totalCreditedRupees: Math.round((totalCredited / 10) * 100) / 100,
      totalRedeemed,
      totalRedeemedRupees: Math.round((totalRedeemed / 10) * 100) / 100,
      totalReversed,
      totalReversedRupees: Math.round((totalReversed / 10) * 100) / 100,
      totalOutstanding,
      totalOutstandingRupees: Math.round((totalOutstanding / 10) * 100) / 100,
      conversionRate: 10,
      conversionText: '10 Fair Coins = ₹1',
      customerCount,
      customersWithBalance,
    };
  },

  /**
   * Super Admin: Customer-wise Fair Coins balances.
   */
  async getSuperAdminCustomers({ page = 1, limit = 20, search = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = { role: { $in: ['CUSTOMER', 'USER'] } };
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { referralCode: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email phone referralCode fairCoinBalance fairCoinReserved welcomeCoinsAwarded createdAt status')
        .sort({ fairCoinBalance: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    const customerIds = users.map((u) => u._id);
    const [earnedMap, redeemedMap] = await Promise.all([
      CoinTransaction.aggregate([
        {
          $match: {
            userId: { $in: customerIds },
            type: { $in: ['WELCOME', 'EARNED', 'CREDIT', 'BONUS', 'PURCHASE_REWARD', 'SPIN_REWARD', 'REFERRAL_REWARD', 'REFUNDED'] },
            status: { $ne: 'FAILED' },
          },
        },
        { $group: { _id: '$userId', total: { $sum: '$amount' } } },
      ]),
      CoinTransaction.aggregate([
        {
          $match: {
            userId: { $in: customerIds },
            type: { $in: ['REDEEMED', 'DEBIT'] },
            status: 'COMPLETED',
          },
        },
        { $group: { _id: '$userId', total: { $sum: '$amount' } } },
      ]),
    ]);

    const earnedLookup = {};
    earnedMap.forEach((e) => {
      earnedLookup[e._id.toString()] = e.total;
    });

    const redeemedLookup = {};
    redeemedMap.forEach((r) => {
      redeemedLookup[r._id.toString()] = r.total;
    });

    const formattedCustomers = users.map((u) => {
      const bal = u.fairCoinBalance || 0;
      const res = u.fairCoinReserved || 0;
      const uId = u._id.toString();
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        referralCode: u.referralCode,
        balance: bal,
        reserved: res,
        available: Math.max(0, bal - res),
        rupeeValue: Math.round((bal / 10) * 100) / 100,
        totalEarned: earnedLookup[uId] || bal,
        totalRedeemed: redeemedLookup[uId] || 0,
        welcomeCoinsAwarded: u.welcomeCoinsAwarded,
        status: u.status,
        joinedAt: u.createdAt,
      };
    });

    return {
      customers: formattedCustomers,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    };
  },

  /**
   * Super Admin: Complete Fair Coins transaction history across all customers.
   */
  async getSuperAdminTransactions({ page = 1, limit = 25, type = '', search = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (type && type !== 'ALL') {
      query.type = type;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ referenceId: regex }, { description: regex }, { source: regex }];
    }

    const [transactions, total] = await Promise.all([
      CoinTransaction.find(query)
        .populate('userId', 'name email role')
        .populate('orderId', 'orderNumber grandTotal orderStatus paymentStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CoinTransaction.countDocuments(query),
    ]);

    return {
      transactions,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    };
  },

  /**
   * Super Admin: Order-wise coin earning and redemption details.
   */
  async getSuperAdminOrderCoinDetails({ page = 1, limit = 20, search = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      $or: [{ fairCoinsUsed: { $gt: 0 } }, { coinDiscount: { $gt: 0 } }],
    };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ orderNumber: regex }, { publicOrderId: regex }];
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(query),
    ]);

    // Attach earned coin details for each order
    const orderNumbers = orders.map((o) => o.orderNumber);
    const earnedTxs = await CoinTransaction.find({
      referenceId: { $in: orderNumbers },
      type: { $in: ['EARNED', 'PURCHASE_REWARD', 'REVERSED'] },
    });

    const earnedLookup = {};
    earnedTxs.forEach((t) => {
      earnedLookup[t.referenceId] = t;
    });

    const enrichedOrders = orders.map((o) => {
      const earnedTx = earnedLookup[o.orderNumber];
      return {
        _id: o._id,
        orderNumber: o.orderNumber,
        customerName: o.userId?.name || 'Customer',
        customerEmail: o.userId?.email || '',
        grandTotal: o.grandTotal,
        fairCoinsRedeemed: o.fairCoinsUsed || 0,
        coinDiscount: o.coinDiscount || 0,
        coinsEarned: earnedTx && earnedTx.type !== 'REVERSED' ? earnedTx.amount : 0,
        isReversed: earnedTx?.type === 'REVERSED' || earnedTx?.status === 'REVERSED',
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      };
    });

    return {
      orders: enrichedOrders,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
    };
  },
};

export default fairCoinService;
