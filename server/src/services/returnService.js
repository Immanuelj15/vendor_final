import mongoose from 'mongoose';
import { ReturnRequest } from '../models/ReturnRequest.js';
import { ReturnPolicy } from '../models/ReturnPolicy.js';
import { Fulfillment } from '../models/Fulfillment.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Commission } from '../models/Commission.js';
import { Vendor } from '../models/Vendor.js';
import { VendorOrder } from '../models/VendorOrder.js';
import { VendorLedger } from '../models/VendorLedger.js';
import { PlatformLedger } from '../models/PlatformLedger.js';
import { VendorSettlement } from '../models/VendorSettlement.js';
import { StockTransaction } from '../models/StockTransaction.js';
import { Payment } from '../models/Payment.js';
import { Shipment } from '../models/Shipment.js';
import { User } from '../models/User.js';
import { notificationService } from './notificationService.js';
import { fulfillmentStatusService } from './fulfillmentStatusService.js';
import { fairCoinService } from './fairCoinService.js';
import { platformCommissionService } from './platformCommissionService.js';
import { refundService } from './refundService.js';
import { shippingService } from './shippingService.js';
import { marketplaceCommissionService } from './marketplaceCommissionService.js';
import { moneyUtils } from '../utils/moneyUtils.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';

export const returnService = {
  /**
   * Check order items eligibility for Cancellation, Return, or Replacement.
   * Resolves dynamic return policies for each product and computes remaining window days.
   */
  async checkOrderReturnEligibility(orderId, actor) {
    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) {
      throw new ApiError(404, 'Order not found', ERROR_CODES.NOT_FOUND);
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(actor?.role);
    if (!isAdmin && order.userId.toString() !== actor._id.toString()) {
      throw new ApiError(403, 'Access denied: You do not own this order', ERROR_CODES.FORBIDDEN);
    }

    const canCancel = !['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'].includes(order.orderStatus);

    // Find fulfillments and deliveries
    const fulfillments = await Fulfillment.find({ orderId: order._id });
    const isDelivered = order.orderStatus === 'DELIVERED' || fulfillments.some(f => f.status === 'DELIVERED');

    // Existing active return/replacement requests for this order
    const existingRequests = await ReturnRequest.find({
      orderId: order._id,
      status: { $ne: 'CANCELLED' },
    });

    const itemsEligibility = [];

    for (const item of order.items) {
      const prod = item.productId || {};
      const policy = await ReturnPolicy.resolvePolicyForProduct(prod._id || item.productId, prod.categoryId);

      // Check if this item is in an existing request
      const activeReq = existingRequests.find(r =>
        r.items.some(ri => ri.productId.toString() === (prod._id || item.productId).toString())
      );

      let canReturn = false;
      let canReplace = false;
      let returnDaysLeft = 0;
      let replacementDaysLeft = 0;
      let ineligibilityReason = '';

      if (!isDelivered) {
        ineligibilityReason = 'Order has not been delivered yet';
      } else if (activeReq) {
        ineligibilityReason = `Already part of active ${activeReq.requestType} request (${activeReq.status})`;
      } else {
        // Calculate days since delivery
        const deliveryDate = order.deliveredAt || order.updatedAt || new Date();
        const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24));

        if (policy.returnAllowed) {
          returnDaysLeft = Math.max(0, policy.returnWindowDays - daysSinceDelivery);
          canReturn = returnDaysLeft > 0;
        }

        if (policy.replacementAllowed) {
          replacementDaysLeft = Math.max(0, policy.replacementWindowDays - daysSinceDelivery);
          canReplace = replacementDaysLeft > 0;
        }

        if (!canReturn && !canReplace) {
          ineligibilityReason = `Policy window expired or item not returnable (${daysSinceDelivery} days since delivery)`;
        }
      }

      itemsEligibility.push({
        productId: prod._id || item.productId,
        orderItemId: item._id,
        name: prod.name || item.name || 'Product',
        sku: prod.sku || item.sku || '',
        image: prod.images?.[0] || item.image || '',
        quantity: item.quantity,
        unitPrice: item.price || item.unitPrice || 0,
        canReturn,
        canReplace,
        returnDaysLeft,
        replacementDaysLeft,
        ineligibilityReason,
        policy: {
          name: policy.name,
          returnWindowDays: policy.returnWindowDays,
          replacementWindowDays: policy.replacementWindowDays,
          requiresEvidenceImages: policy.requiresEvidenceImages,
          requiresSerialVerification: policy.requiresSerialVerification,
          applicableConditions: policy.applicableConditions,
        },
      });
    }

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      canCancel,
      isDelivered,
      items: itemsEligibility,
    };
  },

  /**
   * Submit Customer Return, Replacement, or Cancellation Request.
   */
  async submitCustomerRequest({
    orderId,
    fulfillmentId,
    suborderId,
    requestType,
    reason,
    subReason,
    detailedDescription,
    items,
    evidenceImages = [],
    evidenceVideos = [],
    serialNumber = '',
    bankDetails = null,
    actor,
  }) {
    if (!['RETURN', 'REPLACEMENT', 'CANCELLATION'].includes(requestType)) {
      throw new ApiError(400, 'Invalid request type. Must be RETURN, REPLACEMENT, or CANCELLATION', ERROR_CODES.BAD_REQUEST);
    }

    if (!reason || !reason.trim()) {
      throw new ApiError(400, 'A reason is required', ERROR_CODES.BAD_REQUEST);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found', ERROR_CODES.NOT_FOUND);
    }

    if (order.userId.toString() !== actor._id.toString()) {
      throw new ApiError(403, 'Access denied: You do not own this order', ERROR_CODES.FORBIDDEN);
    }

    // ── CASE 1: CANCELLATION (Before Shipment) ──────────────────────────────
    if (requestType === 'CANCELLATION') {
      if (['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'].includes(order.orderStatus)) {
        throw new ApiError(400, 'Order cannot be cancelled after shipment or delivery', ERROR_CODES.BAD_REQUEST);
      }
      if (order.orderStatus === 'CANCELLED') {
        throw new ApiError(400, 'Order is already cancelled', ERROR_CODES.BAD_REQUEST);
      }

      // Execute the atomic order cancellation (handles stock, coins, vendor debits, commission reversals)
      await this.cancelOrder(order._id, actor);

      // Find primary vendor for record-keeping
      const firstSuborder = await VendorOrder.findOne({ parentOrderId: order._id });
      const vendorId = firstSuborder?.vendorId || order.items[0]?.vendorId || new mongoose.Types.ObjectId();

      // Process payment refund if paid
      let refundResult = null;
      if (order.paymentStatus === 'PAID') {
        refundResult = await refundService.processRefund({
          orderId: order._id,
          refundAmount: order.total,
          reason: `Order Cancellation: ${reason}`,
          actor,
          bankDetails,
        });
      }

      // Create ReturnRequest record of type CANCELLATION for tracking
      const cancelRequest = await ReturnRequest.create({
        requestType: 'CANCELLATION',
        orderId: order._id,
        orderNumber: order.orderNumber,
        suborderId: firstSuborder?._id || null,
        vendorId,
        customerId: actor._id,
        fulfillmentId: fulfillmentId || null,
        items: order.items.map(i => ({
          productId: i.productId,
          orderItemId: i._id,
          name: i.name,
          sku: i.sku || '',
          quantity: i.quantity,
          unitPrice: i.price || i.unitPrice || 0,
          lineTotal: (i.price || i.unitPrice || 0) * i.quantity,
        })),
        reason,
        subReason: subReason || '',
        detailedDescription: detailedDescription || '',
        status: 'COMPLETED',
        refundDetails: {
          refundableAmount: order.total,
          refundAmount: refundResult?.refundAmount || 0,
          refundMethod: refundResult?.refundMethod || (order.paymentMethod === 'RAZORPAY' ? 'ORIGINAL_PAYMENT_METHOD' : 'WALLET'),
          gatewayRefundId: refundResult?.gatewayRefundId || '',
          paymentMethod: order.paymentMethod,
          refundStatus: refundResult ? 'COMPLETED' : (order.paymentStatus === 'PAID' ? 'PROCESSING' : 'NOT_INITIATED'),
          refundProcessedAt: refundResult ? new Date() : null,
          bankDetails: bankDetails || {},
        },
        actionHistory: [
          {
            action: 'ORDER_CANCELLED',
            fromStatus: order.orderStatus,
            toStatus: 'COMPLETED',
            byRole: 'CUSTOMER',
            byUserId: actor._id,
            note: `Order cancelled by customer. Reason: ${reason}. ${detailedDescription || ''}`,
            timestamp: new Date(),
          },
        ],
        requestedAt: new Date(),
        resolvedAt: new Date(),
      });

      return cancelRequest;
    }

    // ── CASE 2: RETURN or REPLACEMENT (After Delivery) ───────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ApiError(400, 'Please select at least one item to return or replace', ERROR_CODES.BAD_REQUEST);
    }

    // Resolve fulfillment / suborder
    let fulfillment = null;
    if (fulfillmentId) {
      fulfillment = await Fulfillment.findById(fulfillmentId);
    } else {
      fulfillment = await Fulfillment.findOne({ orderId: order._id, status: 'DELIVERED' });
    }

    let suborder = null;
    if (suborderId) {
      suborder = await VendorOrder.findById(suborderId);
    } else if (fulfillment?.vendorOrderId) {
      suborder = await VendorOrder.findById(fulfillment.vendorOrderId);
    }

    // Check delivery status
    const isDelivered = order.orderStatus === 'DELIVERED' || fulfillment?.status === 'DELIVERED';
    if (!isDelivered) {
      throw new ApiError(400, 'Returns and replacements are only allowed after delivery', ERROR_CODES.BAD_REQUEST);
    }

    // Determine vendor
    const primaryVendorId = suborder?.vendorId || fulfillment?.vendorId || order.items[0]?.vendorId;
    if (!primaryVendorId) {
      throw new ApiError(400, 'Could not determine vendor for this return request', ERROR_CODES.BAD_REQUEST);
    }

    // Validate each item against return policy
    const validatedItems = [];
    let refundableTotal = 0;
    let snapshotPolicy = null;

    const deliveryDate = fulfillment?.deliveredAt || order.deliveredAt || order.updatedAt || new Date();
    const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24));

    for (const reqItem of items) {
      const orderItem = order.items.find(
        (oi) => (oi.productId?.toString() === reqItem.productId?.toString()) ||
                (oi._id?.toString() === reqItem.orderItemId?.toString())
      );

      if (!orderItem) {
        throw new ApiError(400, `Item ${reqItem.productId} was not found in this order`, ERROR_CODES.BAD_REQUEST);
      }

      if (reqItem.quantity > orderItem.quantity) {
        throw new ApiError(400, `Requested quantity exceeds purchased quantity for ${orderItem.name}`, ERROR_CODES.BAD_REQUEST);
      }

      // Resolve policy
      const productDoc = await Product.findById(orderItem.productId);
      const policy = await ReturnPolicy.resolvePolicyForProduct(orderItem.productId, productDoc?.categoryId);
      snapshotPolicy = policy;

      if (requestType === 'RETURN') {
        if (!policy.returnAllowed) {
          throw new ApiError(400, `Product "${orderItem.name}" is marked as non-returnable`, ERROR_CODES.BAD_REQUEST);
        }
        if (daysSinceDelivery > policy.returnWindowDays) {
          throw new ApiError(400, `Return window of ${policy.returnWindowDays} days has expired for "${orderItem.name}"`, ERROR_CODES.BAD_REQUEST);
        }
      } else if (requestType === 'REPLACEMENT') {
        if (!policy.replacementAllowed) {
          throw new ApiError(400, `Product "${orderItem.name}" is not eligible for replacement`, ERROR_CODES.BAD_REQUEST);
        }
        if (daysSinceDelivery > policy.replacementWindowDays) {
          throw new ApiError(400, `Replacement window of ${policy.replacementWindowDays} days has expired for "${orderItem.name}"`, ERROR_CODES.BAD_REQUEST);
        }
      }

      // Check serial / evidence requirements if configured
      if (policy.requiresSerialVerification && !serialNumber && !reqItem.serialNumber) {
        throw new ApiError(400, `Serial number / IMEI verification is required for "${orderItem.name}"`, ERROR_CODES.BAD_REQUEST);
      }

      const itemPrice = orderItem.price || orderItem.unitPrice || 0;
      const lineTotal = itemPrice * reqItem.quantity;
      refundableTotal += lineTotal;

      validatedItems.push({
        productId: orderItem.productId,
        orderItemId: orderItem._id,
        name: orderItem.name,
        sku: orderItem.sku || productDoc?.sku || '',
        image: orderItem.image || productDoc?.images?.[0] || '',
        quantity: reqItem.quantity,
        unitPrice: itemPrice,
        lineTotal,
        serialNumber: reqItem.serialNumber || serialNumber || '',
      });
    }

    // Check for existing active requests for these items
    const existingActive = await ReturnRequest.findOne({
      orderId: order._id,
      status: { $nin: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
      'items.productId': { $in: validatedItems.map(i => i.productId) },
    });
    if (existingActive) {
      throw new ApiError(400, 'A return or replacement request is already in progress for one or more selected items', ERROR_CODES.BAD_REQUEST);
    }

    // Create the ReturnRequest
    const newReturnRequest = await ReturnRequest.create({
      requestType,
      orderId: order._id,
      orderNumber: order.orderNumber,
      suborderId: suborder?._id || null,
      vendorId: primaryVendorId,
      customerId: actor._id,
      fulfillmentId: fulfillment?._id || null,
      items: validatedItems,
      reason,
      subReason: subReason || '',
      detailedDescription: detailedDescription || '',
      evidenceImages,
      evidenceVideos,
      returnPolicySnapshot: {
        policyName: snapshotPolicy?.name || 'Standard 7-Day Policy',
        returnWindowDays: snapshotPolicy?.returnWindowDays || 7,
        replacementWindowDays: snapshotPolicy?.replacementWindowDays || 7,
        conditions: snapshotPolicy?.applicableConditions || [],
      },
      status: 'REQUEST_SUBMITTED',
      pickupDetails: {
        status: 'PENDING',
        pickupAddress: order.shippingAddress || null,
      },
      refundDetails: {
        refundableAmount: refundableTotal,
        paymentMethod: order.paymentMethod,
        refundStatus: 'NOT_INITIATED',
        bankDetails: bankDetails || {},
      },
      actionHistory: [
        {
          action: `${requestType}_REQUESTED`,
          fromStatus: 'DELIVERED',
          toStatus: 'REQUEST_SUBMITTED',
          byRole: 'CUSTOMER',
          byUserId: actor._id,
          note: `Customer submitted ${requestType.toLowerCase()} request. Reason: ${reason}. Notes: ${detailedDescription || ''}`,
          timestamp: new Date(),
        },
      ],
      requestedAt: new Date(),
    });

    // Notify Customer
    try {
      await notificationService.createNotification({
        userId: actor._id,
        title: `${requestType === 'REPLACEMENT' ? 'Replacement' : 'Return'} Request Submitted`,
        message: `Your ${requestType.toLowerCase()} request for order #${order.orderNumber} has been received and is under review.`,
        type: 'RETURN_REQUESTED',
        link: '/customer/returns',
      }, { dedupeKey: `${newReturnRequest._id.toString()}:${requestType}_REQUESTED` });

      // Notify Vendor
      const vendor = await Vendor.findById(primaryVendorId);
      if (vendor && vendor.userId) {
        await notificationService.createNotification({
          userId: vendor.userId,
          title: `New ${requestType} Request`,
          message: `A customer requested a ${requestType.toLowerCase()} for order #${order.orderNumber}. Please review and approve/reject.`,
          type: 'RETURN_REQUESTED',
          link: '/vendor/returns',
        }, { dedupeKey: `${newReturnRequest._id.toString()}:VENDOR_${requestType}_REQUESTED` });
      }

      // Notify Admins
      const admins = await User.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } });
      for (const admin of admins) {
        await notificationService.createNotification({
          userId: admin._id,
          title: `New ${requestType} Request Requiring Attention`,
          message: `${requestType} request #${newReturnRequest._id} submitted for Order #${order.orderNumber}.`,
          type: 'RETURN_REQUESTED',
          link: '/super-admin/returns',
        }, { dedupeKey: `${newReturnRequest._id.toString()}:ADMIN_${requestType}_REQUESTED:${admin._id}` });
      }
    } catch (notifErr) {
      console.warn('Failed to send return notifications:', notifErr.message);
    }

    return newReturnRequest;
  },

  /**
   * Vendor: Approve return or replacement request.
   */
  async vendorApproveReturn(returnRequestId, { remarks = '', schedulePickup = true }, actor) {
    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      throw new ApiError(404, 'Return request not found', ERROR_CODES.NOT_FOUND);
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(actor.role);
    if (!isAdmin) {
      // Must be vendor owner
      const vendor = await Vendor.findOne({ userId: actor._id });
      if (!vendor || returnRequest.vendorId.toString() !== vendor._id.toString()) {
        throw new ApiError(403, 'Access denied: You are not authorized for this vendor request', ERROR_CODES.FORBIDDEN);
      }
    }

    if (!['REQUEST_SUBMITTED', 'REQUESTED', 'UNDER_REVIEW'].includes(returnRequest.status)) {
      throw new ApiError(400, `Cannot approve request currently in ${returnRequest.status} state`, ERROR_CODES.BAD_REQUEST);
    }

    const fromStatus = returnRequest.status;
    const toStatus = 'APPROVED';

    returnRequest.status = toStatus;
    returnRequest.approvedAt = new Date();
    returnRequest.vendorAction = {
      action: 'APPROVED',
      actionDate: new Date(),
      explanation: remarks || 'Approved by vendor',
      actionByUserId: actor._id,
    };

    // If reverse pickup is enabled, initialize pickup details
    if (schedulePickup) {
      returnRequest.pickupDetails.status = 'SCHEDULED';
      returnRequest.pickupDetails.scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      returnRequest.pickupDetails.courierPartner = 'Delhivery Reverse Logistics';
      returnRequest.pickupDetails.awbNumber = `DLV-REV-${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    returnRequest.actionHistory.push({
      action: 'VENDOR_APPROVED',
      fromStatus,
      toStatus,
      byRole: actor.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'VENDOR',
      byUserId: actor._id,
      note: remarks || 'Return request approved by vendor. Reverse pickup initiated.',
      timestamp: new Date(),
    });

    await returnRequest.save();

    // Notify Customer
    try {
      await notificationService.createNotification({
        userId: returnRequest.customerId,
        title: `${returnRequest.requestType} Request Approved`,
        message: `Your ${returnRequest.requestType.toLowerCase()} request for Order #${returnRequest.orderNumber} has been approved by the seller. Reverse pickup is scheduled.`,
        type: 'RETURN_APPROVED',
        link: '/customer/returns',
      }, { dedupeKey: `${returnRequest._id.toString()}:VENDOR_APPROVED` });
    } catch (err) {
      console.warn('Failed to notify customer on approval:', err.message);
    }

    return returnRequest;
  },

  /**
   * Vendor: Reject return or replacement request with mandatory explanation.
   */
  async vendorRejectReturn(returnRequestId, { rejectionReason }, actor) {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new ApiError(400, 'A clear rejection reason is mandatory when rejecting a return request', ERROR_CODES.BAD_REQUEST);
    }

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      throw new ApiError(404, 'Return request not found', ERROR_CODES.NOT_FOUND);
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(actor.role);
    if (!isAdmin) {
      const vendor = await Vendor.findOne({ userId: actor._id });
      if (!vendor || returnRequest.vendorId.toString() !== vendor._id.toString()) {
        throw new ApiError(403, 'Access denied: You are not authorized for this vendor request', ERROR_CODES.FORBIDDEN);
      }
    }

    if (!['REQUEST_SUBMITTED', 'REQUESTED', 'UNDER_REVIEW'].includes(returnRequest.status)) {
      throw new ApiError(400, `Cannot reject request currently in ${returnRequest.status} state`, ERROR_CODES.BAD_REQUEST);
    }

    const fromStatus = returnRequest.status;
    const toStatus = 'REJECTED';

    returnRequest.status = toStatus;
    returnRequest.vendorAction = {
      action: 'REJECTED',
      actionDate: new Date(),
      explanation: rejectionReason.trim(),
      actionByUserId: actor._id,
    };

    returnRequest.actionHistory.push({
      action: 'VENDOR_REJECTED',
      fromStatus,
      toStatus,
      byRole: actor.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'VENDOR',
      byUserId: actor._id,
      note: `Rejected by vendor: ${rejectionReason.trim()}`,
      timestamp: new Date(),
    });

    await returnRequest.save();

    // Notify Customer
    try {
      await notificationService.createNotification({
        userId: returnRequest.customerId,
        title: `${returnRequest.requestType} Request Rejected`,
        message: `Your ${returnRequest.requestType.toLowerCase()} request for Order #${returnRequest.orderNumber} was rejected by the seller. Reason: ${rejectionReason.trim()}. You may request an Admin Review.`,
        type: 'RETURN_REJECTED',
        link: '/customer/returns',
      }, { dedupeKey: `${returnRequest._id.toString()}:VENDOR_REJECTED` });
    } catch (err) {
      console.warn('Failed to notify customer on rejection:', err.message);
    }

    return returnRequest;
  },

  /**
   * Vendor / Admin: Update Inspection & Restock status.
   */
  async updateInspection(returnRequestId, { inspectionStatus, inspectionNotes = '', restockItem = true }, actor) {
    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      throw new ApiError(404, 'Return request not found', ERROR_CODES.NOT_FOUND);
    }

    const fromStatus = returnRequest.status;
    let toStatus = returnRequest.status;

    if (inspectionStatus === 'PASSED') {
      toStatus = returnRequest.requestType === 'REPLACEMENT' ? 'REPLACEMENT_APPROVED' : 'REFUND_PROCESSING';
      returnRequest.receivedAt = new Date();

      // If restock requested, return items to inventory
      if (restockItem) {
        for (const item of returnRequest.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
          });
          await StockTransaction.create([{
            productId: item.productId,
            orderId: returnRequest.orderId,
            quantityChange: item.quantity,
            transactionType: 'RETURN',
          }]);
        }
      }
    } else if (inspectionStatus === 'FAILED') {
      toStatus = 'QUALITY_INSPECTION';
    }

    returnRequest.status = toStatus;
    returnRequest.actionHistory.push({
      action: `INSPECTION_${inspectionStatus}`,
      fromStatus,
      toStatus,
      byRole: actor.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'VENDOR',
      byUserId: actor._id,
      note: `Quality inspection ${inspectionStatus.toLowerCase()}. Notes: ${inspectionNotes || 'None'}`,
      timestamp: new Date(),
    });

    await returnRequest.save();

    return returnRequest;
  },

  /**
   * Super Admin: Override vendor decision or resolve customer dispute.
   */
  async adminOverrideReturn(returnRequestId, { overrideAction, adminNotes, newStatus }, actor) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      throw new ApiError(403, 'Only Administrators can override return decisions', ERROR_CODES.FORBIDDEN);
    }

    if (!adminNotes || !adminNotes.trim()) {
      throw new ApiError(400, 'An explanation note is required for admin overrides', ERROR_CODES.BAD_REQUEST);
    }

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      throw new ApiError(404, 'Return request not found', ERROR_CODES.NOT_FOUND);
    }

    const fromStatus = returnRequest.status;
    const targetStatus = newStatus || (overrideAction === 'APPROVE' ? 'APPROVED' : 'REJECTED');

    returnRequest.status = targetStatus;
    returnRequest.adminOverride = {
      isOverridden: true,
      action: overrideAction,
      actionDate: new Date(),
      reason: adminNotes.trim(),
      overriddenByUserId: actor._id,
    };

    returnRequest.actionHistory.push({
      action: 'ADMIN_OVERRIDE',
      fromStatus,
      toStatus: targetStatus,
      byRole: 'SUPER_ADMIN',
      byUserId: actor._id,
      note: `Admin override: ${overrideAction}. Reason: ${adminNotes.trim()}`,
      timestamp: new Date(),
    });

    await returnRequest.save();

    // Notify Customer & Vendor
    try {
      await notificationService.createNotification({
        userId: returnRequest.customerId,
        title: `Admin Decision on ${returnRequest.requestType}`,
        message: `Super Admin has resolved your ${returnRequest.requestType.toLowerCase()} dispute: Status is now ${targetStatus}. Note: ${adminNotes}`,
        type: 'RETURN_APPROVED',
        link: '/customer/returns',
      }, { dedupeKey: `${returnRequest._id.toString()}:ADMIN_OVERRIDE_CUST` });

      const vendor = await Vendor.findById(returnRequest.vendorId);
      if (vendor && vendor.userId) {
        await notificationService.createNotification({
          userId: vendor.userId,
          title: `Admin Override on ${returnRequest.requestType} #${returnRequest._id}`,
          message: `Super Admin has overridden the decision for order #${returnRequest.orderNumber}. Action: ${overrideAction}. Reason: ${adminNotes}`,
          type: 'RETURN_APPROVED',
          link: '/vendor/returns',
        }, { dedupeKey: `${returnRequest._id.toString()}:ADMIN_OVERRIDE_VEND` });
      }
    } catch (err) {
      console.warn('Failed to notify parties on admin override:', err.message);
    }

    return returnRequest;
  },

  /**
   * Super Admin / System: Process gateway or bank refund for ReturnRequest.
   */
  async processReturnRefund(returnRequestId, { refundAmount, remarks = '', bankDetails = null }, actor) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      throw new ApiError(403, 'Only Administrators can trigger gateway refunds', ERROR_CODES.FORBIDDEN);
    }

    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) {
      throw new ApiError(404, 'Return request not found', ERROR_CODES.NOT_FOUND);
    }

    const amount = refundAmount !== undefined ? parseFloat(refundAmount) : returnRequest.refundDetails?.refundableAmount;

    const result = await refundService.processRefund({
      returnRequestId: returnRequest._id,
      orderId: returnRequest.orderId,
      refundAmount: amount,
      reason: remarks || `Return Refund #${returnRequest._id}`,
      actor,
      bankDetails,
    });

    return result;
  },

  /**
   * Customer: Fetch all return/replacement/cancellation requests.
   */
  async getCustomerReturnRequests(customerId, { page = 1, limit = 20, status, requestType } = {}) {
    const filter = { customerId };
    if (status) filter.status = status;
    if (requestType) filter.requestType = requestType;

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [requests, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate('orderId', 'orderNumber orderStatus paymentStatus total createdAt')
        .populate('vendorId', 'businessName storeName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ReturnRequest.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  },

  /**
   * Vendor: Fetch return requests for their products.
   */
  async getVendorReturnRequests(vendorId, { page = 1, limit = 20, status, requestType, search } = {}) {
    const filter = { vendorId };
    if (status) filter.status = status;
    if (requestType) filter.requestType = requestType;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [requests, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate('orderId', 'orderNumber orderStatus paymentStatus total createdAt shippingAddress')
        .populate('customerId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ReturnRequest.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  },

  /**
   * Admin: Platform-wide Return & Refund requests.
   */
  async getAdminReturnRequests({ page = 1, limit = 20, status, requestType, vendorId, search } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (requestType) filter.requestType = requestType;
    if (vendorId) filter.vendorId = vendorId;
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [requests, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate('orderId', 'orderNumber orderStatus paymentStatus total createdAt shippingAddress')
        .populate('vendorId', 'businessName storeName')
        .populate('customerId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ReturnRequest.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  },

  /**
   * Get single request with authorization check.
   */
  async getReturnRequestById(id, actor) {
    const request = await ReturnRequest.findById(id)
      .populate('orderId')
      .populate('vendorId', 'businessName storeName email phone')
      .populate('customerId', 'name email phone')
      .populate('actionHistory.byUserId', 'name role');

    if (!request) {
      throw new ApiError(404, 'Return request not found', ERROR_CODES.NOT_FOUND);
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(actor.role);
    const isCustomerOwner = request.customerId?._id?.toString() === actor._id?.toString() ||
                            request.customerId?.toString() === actor._id?.toString();

    let isVendorOwner = false;
    if (actor.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ userId: actor._id });
      if (vendor && request.vendorId?._id?.toString() === vendor._id?.toString()) {
        isVendorOwner = true;
      }
    }

    if (!isAdmin && !isCustomerOwner && !isVendorOwner) {
      throw new ApiError(403, 'Access denied: You do not have permission to view this request', ERROR_CODES.FORBIDDEN);
    }

    return request;
  },

  // ── PRESERVED LEGACY METHODS ──────────────────────────────────────────────
  async requestReturn(orderId, { fulfillmentId, reason, items }, actor) {
    return this.submitCustomerRequest({
      orderId,
      fulfillmentId,
      requestType: 'RETURN',
      reason,
      items,
      actor,
    });
  },

  async updateReturnStatus(returnRequestId, newStatus, adminNote, actor) {
    const returnRequest = await ReturnRequest.findById(returnRequestId);
    if (!returnRequest) throw new ApiError(404, 'Return request not found', ERROR_CODES.NOT_FOUND);

    const oldStatus = returnRequest.status;
    returnRequest.status = newStatus;
    returnRequest.adminNote = adminNote || returnRequest.adminNote;
    if (newStatus === 'APPROVED') returnRequest.approvedAt = new Date();
    if (newStatus === 'RECEIVED') returnRequest.receivedAt = new Date();
    if (newStatus === 'COMPLETED') returnRequest.resolvedAt = new Date();

    returnRequest.actionHistory.push({
      action: `STATUS_CHANGE_TO_${newStatus}`,
      fromStatus: oldStatus,
      toStatus: newStatus,
      byRole: actor.role || 'SYSTEM',
      byUserId: actor._id,
      note: adminNote || '',
      timestamp: new Date(),
    });

    await returnRequest.save();
    return returnRequest;
  },

  async cancelOrder(orderId, actor) {
    const isReplicaSet = Boolean(
      mongoose.connection?.client?.topology?.description?.setName ||
      ['ReplicaSetWithPrimary', 'Sharded'].includes(mongoose.connection?.client?.topology?.description?.type)
    );

    let session = null;
    let inTransaction = false;
    if (isReplicaSet) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        inTransaction = true;
      } catch (_) {
        session = null;
        inTransaction = false;
      }
    }

    const opts = inTransaction ? { session } : {};

    try {
      let orderQuery = Order.findById(orderId);
      if (inTransaction) orderQuery = orderQuery.session(session);
      const order = await orderQuery;
      if (!order) {
        throw new ApiError(404, 'Order not found', ERROR_CODES.NOT_FOUND);
      }

      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(actor.role);
      if (!isAdmin && order.userId.toString() !== actor._id.toString()) {
        throw new ApiError(403, 'Access denied: You do not own this order', ERROR_CODES.FORBIDDEN);
      }

      if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'REFUNDED') {
        if (inTransaction) {
          await session.abortTransaction();
          session.endSession();
        }
        return order;
      }

      if (['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'].includes(order.orderStatus)) {
        throw new ApiError(400, 'Order is not in a cancellable state', ERROR_CODES.BAD_REQUEST);
      }

      const wasPaid = order.paymentStatus === 'PAID';

      // 1. Cancel all fulfillments
      let fulfillmentsQuery = Fulfillment.find({ orderId: order._id });
      if (inTransaction) fulfillmentsQuery = fulfillmentsQuery.session(session);
      const fulfillments = await fulfillmentsQuery;
      for (const f of fulfillments) {
        if (f.status !== 'CANCELLED') {
          await fulfillmentStatusService.transitionFulfillmentStatus(
            f._id,
            'CANCELLED',
            actor,
            'Order cancelled by customer',
            inTransaction ? session : null
          );
        }
      }

      // 2. Revert product stock decrements atomically
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity },
        }, opts);

        await StockTransaction.create([{
          productId: item.productId,
          orderId: order._id,
          quantityChange: item.quantity,
          transactionType: 'RETURN',
        }], opts);
      }

      // 3. Reverse Vendor Earnings & Platform Commission
      let subordersQuery = VendorOrder.find({ parentOrderId: order._id });
      if (inTransaction) subordersQuery = subordersQuery.session(session);
      const suborders = await subordersQuery;
      for (const suborder of suborders) {
        if (suborder.status !== 'CANCELLED') {
          suborder.status = 'CANCELLED';
          await suborder.save(opts);

          if (wasPaid && suborder.vendorEarning > 0) {
            // Debit Vendor balance
            const updatedVendor = await Vendor.findByIdAndUpdate(
              suborder.vendorId,
              {
                $inc: {
                  balance: -suborder.vendorEarning,
                  totalSales: -suborder.subtotal,
                },
              },
              { new: true, ...opts }
            );

            // Cancel on-hold / pending-delivery settlement
            await VendorSettlement.updateMany(
              { suborderId: suborder._id, status: { $in: ['ON_HOLD', 'PENDING_DELIVERY', 'PENDING', 'PROCESSING'] } },
              { $set: { status: 'CANCELLED', rejectionReason: 'Order cancelled and refunded' } },
              opts
            );

            // Create VendorLedger double-entry reversal record
            await VendorLedger.create([{
              vendorId: suborder.vendorId,
              orderId: order._id,
              suborderId: suborder._id,
              transactionType: 'REFUND_REVERSAL',
              credit: 0,
              debit: suborder.vendorEarning,
              balanceSnapshot: updatedVendor?.balance || 0,
              description: `Earnings reversed for cancelled/refunded suborder ${suborder.subOrderNumber || suborder.publicSuborderId}`,
              referenceId: order.orderNumber,
            }], opts);

            // Create PlatformLedger double-entry reversal record
            if (suborder.platformCommission > 0) {
              let latestPlatformQuery = PlatformLedger.findOne().sort({ createdAt: -1 });
              if (inTransaction) latestPlatformQuery = latestPlatformQuery.session(session);
              const latestPlatform = await latestPlatformQuery;
              const currentBal = latestPlatform?.balanceSnapshot || 0;
              const nextBal = moneyUtils.subtractMoney(currentBal, suborder.platformCommission);

              await PlatformLedger.create([{
                transactionId: `PL-REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                type: 'REFUND_REVERSAL',
                sourceEntityType: 'ORDER',
                sourceEntityId: order._id.toString(),
                credit: 0,
                debit: suborder.platformCommission,
                balanceSnapshot: nextBal,
                description: `5% Platform commission reversed for cancelled order ${order.orderNumber}`,
                metadata: {
                  orderId: order._id,
                  vendorId: suborder.vendorId,
                  suborderId: suborder._id,
                  reversedCommission: suborder.platformCommission,
                },
              }], opts);
            }
          }
        }
      }

      // 3b. Reverse Marketplace Commission & 7-Day Vendor Payouts
      try {
        await marketplaceCommissionService.handleOrderCancellationOrRefund({
          orderId: order._id,
          reason: 'Order Cancelled',
        });
      } catch (mErr) {
        console.warn('Marketplace payout reversal error on cancel:', mErr.message);
      }

      // 4. Reverse purchase reward coins and restore redeemed coins
      await fairCoinService.reversePurchaseReward({
        userId: order.userId,
        orderId: order._id,
        orderNumber: order.orderNumber,
      });

      if (order.paymentStatus === 'PAID' || order.paymentMethod === 'COD') {
        if (order.fairCoinsUsed > 0) {
          await fairCoinService.refundRedeemedCoins({
            userId: order.userId,
            orderId: order._id,
            orderNumber: order.orderNumber,
            amount: order.fairCoinsUsed,
          });
        }
      } else if (order.fairCoinsUsed > 0) {
        await fairCoinService.releaseReservedCoins({
          userId: order.userId,
          amount: order.fairCoinsUsed,
        });
      }

      // 5. Update Payment record to REFUNDED
      if (wasPaid) {
        await Payment.updateMany(
          { orderId: order._id },
          { $set: { status: 'REFUNDED', refundedAt: new Date() } },
          opts
        );
      }

      order.orderStatus = 'CANCELLED';
      if (wasPaid) {
        order.paymentStatus = 'REFUNDED';
      }
      await order.save(opts);

      // 6. Reverse commissions associated with the order
      let commissionsQuery = Commission.find({ orderId: order._id });
      if (inTransaction) commissionsQuery = commissionsQuery.session(session);
      const commissions = await commissionsQuery;
      for (const comm of commissions) {
        if (comm.status !== 'CANCELLED') {
          comm.status = 'CANCELLED';
          await comm.save(opts);

          try {
            await notificationService.createNotification({
              userId: comm.recipientUserId,
              title: 'Commission Reversed',
              message: `Your commission for Order #${order.orderNumber} has been reversed due to cancellation.`,
              type: 'COMMISSION_EARNED',
              link: '/account/commissions'
            }, { session: inTransaction ? session : null, dedupeKey: `${comm._id.toString()}:COMMISSION_REVERSED` });
          } catch (err) {
            console.error('Failed to notify commission reversal:', err);
          }
        }
      }

      await platformCommissionService.onOrderCancelled(order._id, inTransaction ? session : null);

      if (inTransaction && session) {
        await session.commitTransaction();
        session.endSession();
      }

      return order;
    } catch (error) {
      if (inTransaction && session) {
        try { await session.abortTransaction(); } catch (_) {}
        session.endSession();
      }
      throw error;
    }
  },
};
export default returnService;
