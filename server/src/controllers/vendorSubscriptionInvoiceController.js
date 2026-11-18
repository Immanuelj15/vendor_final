import { vendorSubscriptionInvoiceService } from '../services/vendorSubscriptionInvoiceService.js';
import { Vendor } from '../models/Vendor.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const vendorSubscriptionInvoiceController = {
  /**
   * Vendor: Get my subscription invoices list with pagination & search
   */
  async getMySubscriptionInvoices(req, res, next) {
    try {
      const vendor = await Vendor.findOne({ userId: req.user._id });
      if (!vendor) {
        throw new ApiError(404, 'Vendor account not found for this user', ERROR_CODES.NOT_FOUND);
      }

      const { page, limit, search, dateFrom, dateTo } = req.query;
      const result = await vendorSubscriptionInvoiceService.getVendorInvoices(vendor._id, {
        page,
        limit,
        search,
        dateFrom,
        dateTo,
      });

      return res.status(200).json(
        new ApiResponse(200, result, 'Vendor subscription invoices retrieved successfully')
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Vendor or Admin: Get single subscription invoice details
   */
  async getSubscriptionInvoiceById(req, res, next) {
    try {
      const { id } = req.params;
      const invoice = await vendorSubscriptionInvoiceService.VendorSubscriptionInvoice.findById(id);
      if (!invoice) {
        throw new ApiError(404, 'Subscription invoice not found', ERROR_CODES.NOT_FOUND);
      }

      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role);
      if (!isAdmin) {
        const vendor = await Vendor.findOne({ userId: req.user._id });
        const owns = (vendor && String(invoice.vendorId) === String(vendor._id)) || String(invoice.userId) === String(req.user._id);
        if (!owns) {
          throw new ApiError(403, 'Forbidden', ERROR_CODES.FORBIDDEN);
        }
      }

      const invObj = invoice.toObject ? invoice.toObject() : invoice;
      if (!isAdmin) {
        delete invObj.referralCommissionSnapshot;
      }

      return res.status(200).json(
        new ApiResponse(200, { invoice: invObj }, 'Subscription invoice details retrieved')
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Vendor or Admin: Stream / Download PDF invoice
   */
  async downloadSubscriptionInvoicePdf(req, res, next) {
    try {
      const { id } = req.params;
      await vendorSubscriptionInvoiceService.streamInvoicePdf(id, req.user, res);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Super Admin: View all vendor subscription invoices platform-wide
   */
  async getAdminSubscriptionInvoices(req, res, next) {
    try {
      const { page, limit, search, vendorId, plan, status, dateFrom, dateTo } = req.query;
      const result = await vendorSubscriptionInvoiceService.getAdminInvoices({
        page,
        limit,
        search,
        vendorId,
        plan,
        status,
        dateFrom,
        dateTo,
      });

      return res.status(200).json(
        new ApiResponse(200, result, 'Platform vendor subscription invoices retrieved successfully')
      );
    } catch (err) {
      next(err);
    }
  },

  /**
   * Super Admin: Key metrics and KPI stats for vendor subscriptions
   */
  async getAdminSubscriptionInvoiceStats(req, res, next) {
    try {
      const stats = await vendorSubscriptionInvoiceService.getAdminStats();
      return res.status(200).json(
        new ApiResponse(200, { stats }, 'Subscription invoice analytics retrieved successfully')
      );
    } catch (err) {
      next(err);
    }
  },
};

export default vendorSubscriptionInvoiceController;

