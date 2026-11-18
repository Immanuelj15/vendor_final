import { invoiceService } from '../services/invoiceService.js';
import { Vendor } from '../models/Vendor.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const getOrderInvoices = asyncWrapper(async (req, res) => {
  const { orderId } = req.params;
  const invoices = await invoiceService.getInvoicesForOrder(orderId, req.user);
  return res.status(200).json(new ApiResponse(200, { invoices }, 'Invoices retrieved successfully'));
});

export const getInvoiceDetail = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const invoice = await invoiceService.getInvoiceById(id, req.user);
  return res.status(200).json(new ApiResponse(200, { invoice }, 'Invoice details retrieved'));
});

export const downloadInvoicePdf = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  await invoiceService.streamInvoicePdf(id, req.user, res);
});

export const getVendorInvoices = asyncWrapper(async (req, res) => {
  const vendor = await Vendor.findOne({ userId: req.user._id });
  if (!vendor) {
    throw new ApiError(404, 'Vendor profile not found', ERROR_CODES.NOT_FOUND);
  }

  const { invoiceNumber, orderNumber, status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const result = await invoiceService.getVendorInvoices(
    vendor._id,
    { invoiceNumber, orderNumber, status, dateFrom, dateTo },
    parseInt(page),
    parseInt(limit)
  );

  return res.status(200).json(new ApiResponse(200, result, 'Vendor invoices retrieved'));
});

export const getAdminInvoices = asyncWrapper(async (req, res) => {
  const { vendorId, customerId, invoiceNumber, orderNumber, status, invoiceType, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const result = await invoiceService.getAdminInvoices(
    { vendorId, customerId, invoiceNumber, orderNumber, status, invoiceType, dateFrom, dateTo },
    parseInt(page),
    parseInt(limit)
  );

  return res.status(200).json(new ApiResponse(200, result, 'Admin invoices retrieved'));
});

export const getAdminInvoiceStats = asyncWrapper(async (req, res) => {
  const stats = await invoiceService.getAdminInvoiceStats();
  return res.status(200).json(new ApiResponse(200, { stats }, 'Invoice statistics retrieved'));
});

export const cancelInvoice = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const result = await invoiceService.cancelInvoice(id, reason, req.user);
  return res.status(200).json(new ApiResponse(200, result, 'Invoice cancelled and credit note issued'));
});

