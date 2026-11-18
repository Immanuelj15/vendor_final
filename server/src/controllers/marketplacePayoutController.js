import { CommissionTransaction } from '../models/CommissionTransaction.js';
import { VendorPayout } from '../models/VendorPayout.js';
import { PlatformFinancialConfig } from '../models/PlatformFinancialConfig.js';
import { Vendor } from '../models/Vendor.js';
import { marketplaceCommissionService } from '../services/marketplaceCommissionService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const marketplacePayoutController = {
  /**
   * 1. Super Admin Metrics
   */
  getSuperAdminMetrics: asyncWrapper(async (req, res) => {
    const metrics = await marketplaceCommissionService.getSuperAdminMetrics();
    return res.status(200).json(new ApiResponse(200, metrics, 'Super Admin financial metrics retrieved'));
  }),

  /**
   * 2. Paginated Commission Summary Table
   */
  getCommissionTransactions: asyncWrapper(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      vendorId,
      orderId,
      status,
      startDate,
      endDate,
      search,
    } = req.query;

    const query = {};
    if (vendorId) query.vendorId = vendorId;
    if (orderId) query.orderId = orderId;
    if (status && status !== 'ALL') query.status = status;

    if (startDate || endDate) {
      query.paymentReceivedAt = {};
      if (startDate) query.paymentReceivedAt.$gte = new Date(startDate);
      if (endDate) query.paymentReceivedAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { productSku: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const total = await CommissionTransaction.countDocuments(query);
    const transactions = await CommissionTransaction.find(query)
      .populate('orderId', 'orderNumber paymentStatus grandTotal')
      .populate('vendorId', 'businessName storeName ownerName email phone')
      .populate('productId', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items: transactions,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
        },
        'Commission transactions retrieved'
      )
    );
  }),

  /**
   * 3. Paginated Vendor Payout Management Table
   */
  getVendorPayouts: asyncWrapper(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      vendorId,
      payoutStatus,
      startDate,
      endDate,
      search,
    } = req.query;

    const query = {};
    if (vendorId) query.vendorId = vendorId;
    if (payoutStatus && payoutStatus !== 'ALL') query.payoutStatus = payoutStatus;

    if (startDate || endDate) {
      query.paymentReceivedAt = {};
      if (startDate) query.paymentReceivedAt.$gte = new Date(startDate);
      if (endDate) query.paymentReceivedAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { payoutNumber: { $regex: search, $options: 'i' } },
        { payoutReference: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const total = await VendorPayout.countDocuments(query);
    const payouts = await VendorPayout.find(query)
      .populate('orderId', 'orderNumber paymentStatus grandTotal')
      .populate('suborderId', 'subOrderNumber publicSuborderId')
      .populate('vendorId', 'businessName storeName ownerName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const now = Date.now();
    const enrichedPayouts = payouts.map((p) => {
      let remainingHoldDays = 0;
      if (p.payoutStatus === 'HOLD' && p.payoutEligibleAt) {
        const diffMs = new Date(p.payoutEligibleAt).getTime() - now;
        remainingHoldDays = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      }
      return {
        ...p,
        remainingHoldDays,
      };
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items: enrichedPayouts,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
        },
        'Vendor payouts retrieved'
      )
    );
  }),

  /**
   * 4. Super Admin Release Payout
   */
  releaseVendorPayout: asyncWrapper(async (req, res) => {
    const { id } = req.params;
    const { payoutReference, adminNotes, idempotencyKey } = req.body;

    const result = await marketplaceCommissionService.releaseVendorPayout({
      payoutId: id,
      adminUserId: req.user?._id,
      payoutReference,
      adminNotes,
      idempotencyKey,
    });

    return res.status(200).json(new ApiResponse(200, result, 'Vendor payout successfully released'));
  }),

  /**
   * 5. Super Admin Update Commission Rate
   */
  updateCommissionRate: asyncWrapper(async (req, res) => {
    const { commissionRate } = req.body;
    const rate = Number(commissionRate);

    if (isNaN(rate) || rate < 0 || rate > 100) {
      throw new ApiError(400, 'Commission percentage must be a number between 0 and 100', ERROR_CODES.BAD_REQUEST);
    }

    let config = await PlatformFinancialConfig.findOne();
    if (!config) {
      config = new PlatformFinancialConfig();
    }
    config.defaultCommissionRate = rate;
    config.updatedBy = req.user?._id;
    await config.save();

    return res.status(200).json(new ApiResponse(200, { commissionRate: rate }, 'Platform commission rate updated successfully'));
  }),

  /**
   * 6. Trigger 7-Day Eligibility Job Manually
   */
  triggerEligibilityJob: asyncWrapper(async (req, res) => {
    const result = await marketplaceCommissionService.processSevenDayEligibility(new Date());
    return res.status(200).json(new ApiResponse(200, result, '7-Day payout eligibility job completed'));
  }),

  /**
   * 7. Vendor Financial Dashboard & Payout History
   * Strictly isolates data to the calling vendor
   */
  getVendorFinanceDashboard: asyncWrapper(async (req, res) => {
    const vendor = await Vendor.findOne({ userId: req.user._id });
    if (!vendor) {
      throw new ApiError(404, 'Vendor profile not found', ERROR_CODES.NOT_FOUND);
    }

    const { page = 1, limit = 20, status } = req.query;
    const metrics = await marketplaceCommissionService.getVendorMetrics(vendor._id);

    const query = { vendorId: vendor._id };
    if (status && status !== 'ALL') query.payoutStatus = status;

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const total = await VendorPayout.countDocuments(query);
    const payouts = await VendorPayout.find(query)
      .populate('orderId', 'orderNumber paymentStatus')
      .populate('suborderId', 'subOrderNumber items')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const now = Date.now();
    const enrichedPayouts = payouts.map((p) => {
      let remainingHoldDays = 0;
      if (p.payoutStatus === 'HOLD' && p.payoutEligibleAt) {
        const diffMs = new Date(p.payoutEligibleAt).getTime() - now;
        remainingHoldDays = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      }
      return {
        ...p,
        remainingHoldDays,
      };
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          metrics,
          payouts: enrichedPayouts,
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
        },
        'Vendor financial statement retrieved'
      )
    );
  }),
};
