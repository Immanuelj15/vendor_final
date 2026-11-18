import { returnService } from '../services/returnService.js';
import { Vendor } from '../models/Vendor.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

// Check product eligibility for Return, Replacement, Cancellation
export const checkEligibility = asyncWrapper(async (req, res) => {
  const { orderId } = req.params;
  const result = await returnService.checkOrderReturnEligibility(orderId, req.user);
  return res.status(200).json(new ApiResponse(200, result, 'Order eligibility resolved'));
});

// Submit Customer Return, Replacement, or Cancellation Request
export const submitRequest = asyncWrapper(async (req, res) => {
  const {
    orderId,
    fulfillmentId,
    suborderId,
    requestType,
    reason,
    subReason,
    detailedDescription,
    items,
    evidenceImages,
    evidenceVideos,
    serialNumber,
    bankDetails,
  } = req.body;

  const result = await returnService.submitCustomerRequest({
    orderId,
    fulfillmentId,
    suborderId,
    requestType,
    reason,
    subReason,
    detailedDescription,
    items,
    evidenceImages,
    evidenceVideos,
    serialNumber,
    bankDetails,
    actor: req.user,
  });

  const message = requestType === 'CANCELLATION'
    ? 'Order cancelled successfully'
    : `${requestType === 'REPLACEMENT' ? 'Replacement' : 'Return'} request submitted successfully`;

  return res.status(201).json(new ApiResponse(201, result, message));
});

// Customer: Get my return/cancellation requests
export const getMyRequests = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20, status = '', requestType = '' } = req.query;
  const result = await returnService.getCustomerReturnRequests(req.user._id, {
    page,
    limit,
    status,
    requestType,
  });
  return res.status(200).json(new ApiResponse(200, result, 'Customer return requests retrieved'));
});

// Vendor: Get return requests for my products
export const getVendorRequests = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20, status = '', requestType = '', search = '' } = req.query;

  // Resolve vendor record for current user
  const vendor = await Vendor.findOne({ userId: req.user._id });
  if (!vendor) {
    throw new ApiError(404, 'Vendor profile not found for this account', ERROR_CODES.NOT_FOUND);
  }

  const result = await returnService.getVendorReturnRequests(vendor._id, {
    page,
    limit,
    status,
    requestType,
    search,
  });
  return res.status(200).json(new ApiResponse(200, result, 'Vendor return requests retrieved'));
});

// Vendor: Approve request
export const vendorApprove = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { remarks, schedulePickup = true } = req.body;
  const result = await returnService.vendorApproveReturn(id, { remarks, schedulePickup }, req.user);
  return res.status(200).json(new ApiResponse(200, result, 'Return request approved by vendor'));
});

// Vendor: Reject request (mandatory explanation)
export const vendorReject = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new ApiError(400, 'Rejection explanation is mandatory', ERROR_CODES.BAD_REQUEST);
  }
  const result = await returnService.vendorRejectReturn(id, { rejectionReason }, req.user);
  return res.status(200).json(new ApiResponse(200, result, 'Return request rejected'));
});

// Vendor/Admin: Update quality inspection
export const updateInspection = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { inspectionStatus, inspectionNotes, restockItem = true } = req.body;
  const result = await returnService.updateInspection(id, { inspectionStatus, inspectionNotes, restockItem }, req.user);
  return res.status(200).json(new ApiResponse(200, result, `Inspection updated: ${inspectionStatus}`));
});

// Super Admin: View platform-wide return & refund requests
export const getAdminRequests = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20, status = '', requestType = '', vendorId = '', search = '' } = req.query;
  const result = await returnService.getAdminReturnRequests({
    page,
    limit,
    status,
    requestType,
    vendorId,
    search,
  });
  return res.status(200).json(new ApiResponse(200, result, 'Admin return requests retrieved'));
});

// Super Admin: Override vendor decision / dispute resolution
export const adminOverride = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { overrideAction, adminNotes, newStatus } = req.body;
  const result = await returnService.adminOverrideReturn(id, { overrideAction, adminNotes, newStatus }, req.user);
  return res.status(200).json(new ApiResponse(200, result, `Admin override executed: ${overrideAction}`));
});

// Super Admin: Execute gateway refund
export const adminProcessRefund = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { refundAmount, remarks, bankDetails } = req.body;
  const result = await returnService.processReturnRefund(id, { refundAmount, remarks, bankDetails }, req.user);
  return res.status(200).json(new ApiResponse(200, result, 'Refund executed successfully'));
});

// Get request by ID
export const getRequestById = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const request = await returnService.getReturnRequestById(id, req.user);
  return res.status(200).json(new ApiResponse(200, request, 'Return request details retrieved'));
});

// ── PRESERVED LEGACY CONTROLLER METHODS ────────────────────────────────────
export const cancelOrder = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const order = await returnService.cancelOrder(id, req.user);
  return res.status(200).json(new ApiResponse(200, order, 'Order cancelled successfully'));
});

export const requestReturn = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { fulfillmentId, reason, items } = req.body;
  const returnRequest = await returnService.requestReturn(id, { fulfillmentId, reason, items }, req.user);
  return res.status(201).json(new ApiResponse(201, returnRequest, 'Return request submitted successfully'));
});

export const getReturnRequests = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, status = '' } = req.query;
  const result = await returnService.getAdminReturnRequests({ page, limit, status });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        requests: result.requests,
        total: result.pagination.total,
        page: result.pagination.page,
        pages: result.pagination.pages,
      },
      'Return requests retrieved successfully'
    )
  );
});

export const updateReturnStatus = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body;
  const result = await returnService.updateReturnStatus(id, status, adminNote, req.user);
  return res.status(200).json(new ApiResponse(200, result, `Return status updated to ${status}`));
});
