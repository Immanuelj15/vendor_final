/**
 * Complete Shiprocket Shipping Service — Production Implementation
 *
 * Handles the full logistics lifecycle:
 *  1. Serviceability & rate comparison check
 *  2. Order/shipment creation in Shiprocket (idempotent, deduplicated)
 *  3. AWB assignment (specific courier selection or optimal recommendation)
 *  4. Pickup scheduling
 *  5. Label & Manifest generation
 *  6. Live tracking & timeline milestones
 *  7. Webhook processing (with authentication, idempotency, non-regressive state machine)
 *  8. Cancellation & return order management
 *  9. Master order status roll-up
 */

import { Shipment } from '../models/Shipment.js';
import { VendorOrder } from '../models/VendorOrder.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { ShipmentTrackingEvent } from '../models/ShipmentTrackingEvent.js';
import { ShippingException } from '../models/ShippingException.js';
import { ShiprocketWebhookEvent } from '../models/ShiprocketWebhookEvent.js';
import { shiprocketProvider } from './courier/shiprocketProvider.js';
import { shiprocketPickupService } from './shiprocketPickupService.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';
import { env } from '../config/env.js';
import crypto from 'crypto';

// ─── Status Priority State Machine ───────────────────────────────────────────
export const STATUS_PRIORITY = [
  'DRAFT',
  'READY',
  'ORDER_CREATED',
  'CREATED',
  'AWB_ASSIGNED',
  'PICKUP_REQUESTED',
  'PICKUP_SCHEDULED',
  'PICKUP_FAILED',
  'PICKED_UP',
  'SHIPPED',
  'IN_TRANSIT',
  'REACHED_DESTINATION_HUB',
  'OUT_FOR_DELIVERY',
  'DELIVERY_ATTEMPTED',
  'NDR',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURN_INITIATED',
  'RTO_INITIATED',
  'RETURN_IN_TRANSIT',
  'RTO_IN_TRANSIT',
  'RETURNED',
  'RTO_DELIVERED',
  'CANCELLED',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize weight to KG (Shiprocket expects KG).
 */
function normalizeWeightToKg(weight, unit = 'KG') {
  const w = parseFloat(weight) || 0;
  switch ((unit || 'KG').toUpperCase()) {
    case 'GRAM': return w / 1000;
    case 'LBS':  return w * 0.453592;
    case 'OZ':   return w * 0.0283495;
    default:     return w;
  }
}

/**
 * Calculate total shipment weight for a vendor suborder's items.
 */
async function calculateShipmentWeight(items) {
  let totalKg = 0;
  const missingWeight = [];

  for (const item of items) {
    const product = await Product.findById(item.productId).select('weight weightUnit name');
    if (!product || !product.weight || product.weight <= 0) {
      missingWeight.push(item.productNameSnapshot || item.name || item.productId);
      totalKg += 0.5 * (item.quantity || 1); // Sensible fallback: 500g per unit
    } else {
      totalKg += normalizeWeightToKg(product.weight, product.weightUnit) * (item.quantity || 1);
    }
  }

  return { totalKg: Math.max(parseFloat(totalKg.toFixed(2)), 0.1), missingWeight };
}

/**
 * Get package dimensions from product data.
 */
async function calculateShipmentDimensions(items) {
  let maxLength = 10, maxWidth = 10, maxHeight = 10;

  for (const item of items) {
    const product = await Product.findById(item.productId).select('length width height dimensionUnit');
    if (product && product.length > 0) {
      const factor = (product.dimensionUnit || 'CM').toUpperCase() === 'INCH' ? 2.54 : 1;
      maxLength = Math.max(maxLength, (product.length || 10) * factor);
      maxWidth = Math.max(maxWidth, (product.width || 10) * factor);
      maxHeight = Math.max(maxHeight, (product.height || 10) * factor);
    }
  }

  return {
    length: parseFloat(maxLength.toFixed(2)),
    breadth: parseFloat(maxWidth.toFixed(2)),
    height: parseFloat(maxHeight.toFixed(2)),
  };
}

/**
 * Build Shiprocket order items array from VendorOrder items.
 */
function buildShiprocketItems(items) {
  return items.map((item) => ({
    name: item.productNameSnapshot || item.name || 'Product',
    sku: item.skuSnapshot || item.variantSku || String(item.productId),
    units: item.quantity || 1,
    sellingPrice: item.unitPrice || item.price || 1,
    discount: item.discountSnapshot || 0,
    tax: item.taxSnapshot || 0,
    hsn: '',
  }));
}

/**
 * Extract delivery address from the parent order's deliveryAddressSnapshot.
 */
function extractDeliveryAddress(deliveryAddressSnapshot) {
  const addr = deliveryAddressSnapshot || {};
  return {
    streetAddress: addr.streetAddress || addr.street || addr.addressLine1 || '',
    city: addr.city || '',
    state: addr.state || '',
    postalCode: addr.postalCode || addr.zip || addr.pincode || addr.zipCode || '',
    country: addr.country || 'India',
    name: addr.name || addr.customerName || addr.fullName || '',
    phone: addr.phone || '',
    email: addr.email || '',
  };
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export const shippingService = {

  // ────────────────────────────────────────────────────────────────────────────
  // 1. SERVICEABILITY CHECK
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Check courier serviceability for a vendor suborder.
   */
  async checkServiceability(suborderId, vendorId) {
    const suborder = await VendorOrder.findOne({ _id: suborderId, vendorId });
    if (!suborder) throw new ApiError(404, 'Suborder not found', ERROR_CODES.NOT_FOUND);

    const masterOrder = await Order.findById(suborder.parentOrderId);
    if (!masterOrder) throw new ApiError(404, 'Master order not found', ERROR_CODES.NOT_FOUND);

    const originAddress = await shiprocketPickupService.getDefaultPickupAddress(vendorId);
    const destAddr = extractDeliveryAddress(masterOrder.deliveryAddressSnapshot);

    const { totalKg, missingWeight } = await calculateShipmentWeight(suborder.items);
    const isCOD = masterOrder.paymentMethod === 'COD';

    const serviceability = await shiprocketProvider.getServiceability(
      originAddress.pincode,
      destAddr.postalCode,
      totalKg,
      isCOD ? 1 : 0
    );

    return {
      ...serviceability,
      packageWeight: totalKg,
      missingWeightProducts: missingWeight,
      originPincode: originAddress.pincode,
      destinationPincode: destAddr.postalCode,
    };
  },

  /**
   * Check available couriers and rates for an existing shipment before AWB assignment.
   */
  async getAvailableCouriersForShipment(shipmentId, vendorId = null) {
    const query = { _id: shipmentId };
    if (vendorId) query.vendorId = vendorId;

    const shipment = await Shipment.findOne(query);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    const originPincode =
      shipment.originAddressSnapshot?.pincode ||
      shipment.originAddressSnapshot?.postalCode;

    const destPincode =
      shipment.destinationAddressSnapshot?.postalCode ||
      shipment.destinationAddressSnapshot?.zip ||
      shipment.destinationAddressSnapshot?.pincode;

    if (!originPincode || !destPincode) {
      throw new ApiError(400, 'Origin or destination PIN code missing on shipment snapshot', ERROR_CODES.BAD_REQUEST);
    }

    return shiprocketProvider.getServiceability(
      originPincode,
      destPincode,
      shipment.packageWeight || 0.5,
      shipment.isCOD ? 1 : 0
    );
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 2. SHIPMENT CREATION (Idempotent)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Create a Shiprocket shipment for a vendor suborder.
   */
  async createShipment(suborderId, vendorId, options = {}) {
    const suborder = await VendorOrder.findOne({ _id: suborderId, vendorId });
    if (!suborder) throw new ApiError(404, 'Suborder not found', ERROR_CODES.NOT_FOUND);

    if (!['READY_TO_SHIP', 'CONFIRMED', 'PROCESSING', 'PACKED'].includes(suborder.status)) {
      throw new ApiError(
        400,
        `Suborder status is "${suborder.status}". Shipment can only be created when status is READY_TO_SHIP, CONFIRMED, PROCESSING, or PACKED.`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Idempotency: prevent duplicate shipments
    const existingShipment = await Shipment.findOne({ suborderId });
    if (existingShipment && existingShipment.status !== 'DRAFT') {
      return existingShipment;
    }

    // Verify master order and payment
    const masterOrder = await Order.findById(suborder.parentOrderId);
    if (!masterOrder) throw new ApiError(404, 'Master order not found', ERROR_CODES.NOT_FOUND);

    const isCOD = masterOrder.paymentMethod === 'COD';
    if (!isCOD && masterOrder.paymentStatus !== 'PAID') {
      throw new ApiError(
        400,
        'Cannot create shipment for an unpaid non-COD order. Please wait for payment confirmation.',
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Validate delivery address
    const deliveryAddr = extractDeliveryAddress(masterOrder.deliveryAddressSnapshot);
    if (!deliveryAddr.postalCode || !/^\d{6}$/.test(String(deliveryAddr.postalCode).trim())) {
      throw new ApiError(400, 'Customer delivery address is missing a valid 6-digit PIN code', ERROR_CODES.BAD_REQUEST);
    }
    if (!deliveryAddr.streetAddress) {
      throw new ApiError(400, 'Customer delivery address is missing street address', ERROR_CODES.BAD_REQUEST);
    }

    // Get vendor pickup address and register in Shiprocket
    const originAddress = await shiprocketPickupService.getDefaultPickupAddress(vendorId);
    const pickupLocationName = await shiprocketPickupService.ensurePickupLocation(vendorId, originAddress);

    // Calculate dimensions and weight (supports vendor overrides during packing)
    const { totalKg: calculatedWeight } = await calculateShipmentWeight(suborder.items);
    const calculatedDim = await calculateShipmentDimensions(suborder.items);
    
    const finalWeight = options?.weight ? Math.max(0.01, parseFloat(options.weight)) : calculatedWeight;
    const finalLength = options?.length ? Math.max(0.5, parseFloat(options.length)) : calculatedDim.length;
    const finalBreadth = (options?.breadth || options?.width) ? Math.max(0.5, parseFloat(options?.breadth || options?.width)) : calculatedDim.breadth;
    const finalHeight = options?.height ? Math.max(0.5, parseFloat(options?.height)) : calculatedDim.height;

    // Calculate COD amount for this suborder
    let codAmount = 0;
    if (isCOD) {
      codAmount = suborder.grandTotal + (suborder.shippingTotal || 0);
    }

    // Unique order reference for Shiprocket
    const srOrderRef = `BM-${suborder.subOrderNumber || suborder.publicSuborderId || suborderId}`;

    // Draft local record to prevent race conditions
    let shipment = existingShipment;
    if (!shipment) {
      shipment = await Shipment.create({
        suborderId,
        vendorId,
        parentOrderId: masterOrder._id,
        courierProvider: 'SHIPROCKET',
        courierOrderId: srOrderRef,
        originAddressSnapshot: originAddress.toObject ? originAddress.toObject() : originAddress,
        destinationAddressSnapshot: masterOrder.deliveryAddressSnapshot,
        pickupLocationName,
        packageWeight: finalWeight,
        length: finalLength,
        width: finalBreadth,
        height: finalHeight,
        shippingCharge: suborder.shippingTotal || 0,
        isCOD,
        codAmount,
        status: 'DRAFT',
      });
    }

    shipment.shiprocketCreationAttempts = (shipment.shiprocketCreationAttempts || 0) + 1;
    shipment.lastCreationAttemptAt = new Date();

    try {
      const srResult = await shiprocketProvider.createOrder({
        orderNumber: srOrderRef,
        orderDate: masterOrder.createdAt?.toISOString()?.split('T')[0] || new Date().toISOString().split('T')[0],
        customerName: deliveryAddr.name || 'Customer',
        customerEmail: deliveryAddr.email || '',
        customerPhone: deliveryAddr.phone || '9999999999',
        deliveryAddress: deliveryAddr,
        pickupLocation: pickupLocationName,
        items: buildShiprocketItems(suborder.items),
        weight: finalWeight,
        length: finalLength,
        breadth: finalBreadth,
        height: finalHeight,
        paymentMethod: isCOD ? 'COD' : 'Prepaid',
        subTotal: suborder.itemsSubtotal || suborder.grandTotal,
        codAmount,
        shippingCharge: suborder.shippingTotal || 0,
      });

      if (!srResult.success) {
        throw new Error(srResult.rawResponse?.message || 'Shiprocket order creation was not successful');
      }

      shipment.shiprocketOrderId = srResult.shiprocketOrderId;
      shipment.shiprocketShipmentId = srResult.shiprocketShipmentId;
      shipment.status = 'CREATED';
      await shipment.save();

      suborder.status = 'SHIPMENT_CREATED';
      await suborder.save();

      // Auto-assign AWB if preferred courier was provided
      if (options.courierCompanyId && srResult.shiprocketShipmentId) {
        try {
          await this.assignAWB(shipment._id.toString(), vendorId, options.courierCompanyId);
        } catch (awbErr) {
          console.warn('[Shipping] AWB auto-assignment deferred:', awbErr.message);
        }
      }

      console.log(`[Shipping] Shipment created for suborder ${suborderId}. SR Order: ${srResult.shiprocketOrderId}`);
      return shipment;

    } catch (error) {
      await ShippingException.create({
        shipmentId: shipment._id,
        provider: 'SHIPROCKET',
        errorCode: error.statusCode ? String(error.statusCode) : 'CREATION_FAILED',
        errorMessage: error.message || 'Shiprocket order creation failed',
        requestReference: srOrderRef,
      }).catch(() => {});

      shipment.status = 'DRAFT';
      await shipment.save();

      throw new ApiError(
        502,
        `Failed to create Shiprocket shipment: ${error.message}`,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 3. AWB ASSIGNMENT
  // ────────────────────────────────────────────────────────────────────────────

  async assignAWB(shipmentId, vendorId, courierCompanyId = null) {
    const query = { _id: shipmentId };
    if (vendorId) query.vendorId = vendorId;

    const shipment = await Shipment.findOne(query);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    if (!shipment.shiprocketShipmentId) {
      throw new ApiError(400, 'Shipment does not have a Shiprocket Shipment ID yet', ERROR_CODES.BAD_REQUEST);
    }

    if (shipment.awbNumber) {
      return shipment; // Already assigned
    }

    // If no courierCompanyId is specified, check serviceability to pick best available courier
    let resolvedCourierId = courierCompanyId;
    if (!resolvedCourierId) {
      try {
        const serv = await this.getAvailableCouriersForShipment(shipment._id, vendorId);
        if (serv?.availableCouriers?.length > 0) {
          resolvedCourierId = serv.availableCouriers[0].id;
        }
      } catch (servErr) {
        console.warn('[Shipping] Could not fetch optimal courier recommendation, proceeding with standard courier:', servErr.message);
      }
    }

    try {
      const result = await shiprocketProvider.assignAWB(
        shipment.shiprocketShipmentId,
        resolvedCourierId
      );

      if (!result.success || !result.awbNumber) {
        throw new Error(result.rawResponse?.message || 'AWB assignment failed');
      }

      shipment.awbNumber = result.awbNumber;
      shipment.courierName = result.courierName || '';
      shipment.courierCompanyId = result.courierCompanyId || resolvedCourierId;
      shipment.trackingUrl = result.trackingUrl || `https://shiprocket.co/tracking/${result.awbNumber}`;
      shipment.status = 'AWB_ASSIGNED';
      await shipment.save();

      await ShipmentTrackingEvent.create({
        shipmentId: shipment._id,
        provider: 'SHIPROCKET',
        providerEventId: `awb_${result.awbNumber}`,
        providerStatus: 'AWB Assigned',
        internalStatus: 'AWB_ASSIGNED',
        location: '',
        description: `AWB ${result.awbNumber} assigned via ${result.courierName || 'Shiprocket Courier'}`,
        eventTime: new Date(),
      }).catch(() => {});

      return shipment;
    } catch (error) {
      await ShippingException.create({
        shipmentId: shipment._id,
        provider: 'SHIPROCKET',
        errorCode: 'AWB_FAILED',
        errorMessage: error.message,
        requestReference: `shipment:${shipmentId}`,
      }).catch(() => {});

      throw new ApiError(502, `AWB assignment failed: ${error.message}`, ERROR_CODES.INTERNAL_ERROR);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 4. PICKUP SCHEDULING
  // ────────────────────────────────────────────────────────────────────────────

  async requestPickup(shipmentId, vendorId, pickupDate = null) {
    const query = { _id: shipmentId };
    if (vendorId) query.vendorId = vendorId;

    const shipment = await Shipment.findOne(query);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    if (['PICKUP_SCHEDULED', 'PICKUP_REQUESTED'].includes(shipment.status)) {
      return shipment;
    }

    if (!['CREATED', 'AWB_ASSIGNED'].includes(shipment.status)) {
      throw new ApiError(
        400,
        `Shipment must be in CREATED or AWB_ASSIGNED status to schedule pickup. Current: ${shipment.status}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (!shipment.shiprocketShipmentId) {
      throw new ApiError(400, 'Shiprocket Shipment ID is missing. Cannot schedule pickup.', ERROR_CODES.BAD_REQUEST);
    }

    try {
      const res = await shiprocketProvider.requestPickup(
        shipment.shiprocketShipmentId,
        pickupDate
      );

      shipment.status = 'PICKUP_REQUESTED';
      if (res.pickupScheduledDate) {
        shipment.pickupScheduledAt = new Date(res.pickupScheduledDate);
        shipment.status = 'PICKUP_SCHEDULED';
      }
      await shipment.save();

      const suborder = await VendorOrder.findById(shipment.suborderId);
      if (suborder) {
        suborder.status = shipment.status;
        await suborder.save();
      }

      return shipment;
    } catch (error) {
      await ShippingException.create({
        shipmentId: shipment._id,
        provider: 'SHIPROCKET',
        errorCode: 'PICKUP_FAILED',
        errorMessage: error.message,
        requestReference: `shipment:${shipmentId}`,
      }).catch(() => {});

      throw new ApiError(502, `Pickup scheduling failed: ${error.message}`, ERROR_CODES.INTERNAL_ERROR);
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 5. LABEL GENERATION
  // ────────────────────────────────────────────────────────────────────────────

  async generateLabel(shipmentId, requestingVendorId = null) {
    const query = { _id: shipmentId };
    if (requestingVendorId) query.vendorId = requestingVendorId;

    const shipment = await Shipment.findOne(query);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    if (!shipment.shiprocketShipmentId) {
      throw new ApiError(400, 'No Shiprocket Shipment ID — cannot generate label', ERROR_CODES.BAD_REQUEST);
    }

    const result = await shiprocketProvider.generateLabel(shipment.shiprocketShipmentId);

    if (result.labelUrl) {
      shipment.labelUrl = result.labelUrl;
      await shipment.save();
    }

    return { labelUrl: shipment.labelUrl, shipment };
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 6. MANIFEST GENERATION
  // ────────────────────────────────────────────────────────────────────────────

  async generateManifest(shipmentIds) {
    const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
    const shipments = await Shipment.find({ _id: { $in: ids } });

    const srShipmentIds = shipments
      .map((s) => s.shiprocketShipmentId)
      .filter(Boolean);

    if (srShipmentIds.length === 0) {
      throw new ApiError(400, 'No valid Shiprocket Shipment IDs found for manifest generation', ERROR_CODES.BAD_REQUEST);
    }

    const result = await shiprocketProvider.generateManifest(srShipmentIds);

    if (result.manifestUrl) {
      await Shipment.updateMany(
        { _id: { $in: ids } },
        { $set: { manifestUrl: result.manifestUrl } }
      );
    }

    return result;
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 7. LIVE TRACKING
  // ────────────────────────────────────────────────────────────────────────────

  async trackShipment(shipmentId, requestingUserId = null, requestingRole = null) {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    if (requestingRole === 'VENDOR') {
      const { Vendor } = await import('../models/Vendor.js');
      const vendor = await Vendor.findOne({ userId: requestingUserId });
      if (!vendor || shipment.vendorId.toString() !== vendor._id.toString()) {
        throw new ApiError(403, 'Access denied: This shipment belongs to another vendor', ERROR_CODES.FORBIDDEN);
      }
    }

    if (requestingRole === 'CUSTOMER') {
      const suborder = await VendorOrder.findById(shipment.suborderId);
      if (!suborder || suborder.userId.toString() !== requestingUserId.toString()) {
        throw new ApiError(403, 'Access denied: This shipment does not belong to your order', ERROR_CODES.FORBIDDEN);
      }
    }

    const storedEvents = await ShipmentTrackingEvent.find({ shipmentId }).sort({ eventTime: -1 });

    let liveTracking = null;
    if (shipment.awbNumber) {
      try {
        liveTracking = await shiprocketProvider.trackByAWB(shipment.awbNumber);

        if (liveTracking?.currentStatus) {
          const mapped = shiprocketProvider.mapStatus(liveTracking.currentStatus, liveTracking.currentStatusId);
          const currentPriority = STATUS_PRIORITY.indexOf(shipment.status);
          const newPriority = STATUS_PRIORITY.indexOf(mapped);
          if (newPriority > currentPriority) {
            shipment.status = mapped;
            if (mapped === 'DELIVERED' && !shipment.deliveredAt) shipment.deliveredAt = new Date();
            if (mapped === 'PICKED_UP' && !shipment.pickedUpAt) shipment.pickedUpAt = new Date();
            await shipment.save();
          }
        }
      } catch (e) {
        console.warn('[Shipping] Live tracking query notice:', e.message);
      }
    }

    return {
      shipment,
      trackingEvents: storedEvents,
      liveTracking,
    };
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 8. WEBHOOK PROCESSING (Idempotent & Authenticated)
  // ────────────────────────────────────────────────────────────────────────────

  async handleWebhook(payload, providedApiKey) {
    const expectedSecret = env.SHIPROCKET_WEBHOOK_SECRET;
    if (expectedSecret && expectedSecret !== 'sr_webhook_demo') {
      if (providedApiKey !== expectedSecret) {
        console.warn('[Shiprocket Webhook] Invalid x-api-key received');
        throw new ApiError(401, 'Webhook authentication failed: invalid security token', ERROR_CODES.UNAUTHORIZED);
      }
    }

    const {
      awb,
      courier_name,
      current_status,
      current_status_id,
      shipment_status,
      shipment_status_id,
      current_timestamp,
      order_id,
      sr_order_id,
      is_return,
      scans,
    } = payload;

    if (!awb) {
      console.warn('[Shiprocket Webhook] Missing AWB in webhook payload');
      return { success: false, reason: 'missing_awb' };
    }

    const eventKey = crypto
      .createHash('sha256')
      .update(`${awb}:${current_status_id || ''}:${current_timestamp || ''}`)
      .digest('hex');

    let webhookEvent;
    try {
      webhookEvent = await ShiprocketWebhookEvent.create({
        eventKey,
        awbNumber: awb,
        shiprocketOrderId: sr_order_id?.toString() || '',
        channelOrderId: order_id?.toString() || '',
        courierName: courier_name || '',
        currentStatus: current_status || '',
        currentStatusId: parseInt(current_status_id) || null,
        shipmentStatus: shipment_status || '',
        shipmentStatusId: parseInt(shipment_status_id) || null,
        eventTimestamp: current_timestamp || '',
        isReturn: !!is_return,
        scansPayload: scans || [],
        rawPayload: payload,
      });
    } catch (e) {
      if (e.code === 11000) {
        console.log(`[Shiprocket Webhook] Duplicate event for AWB ${awb}, deduplicated.`);
        return { success: true, reason: 'duplicate_skipped' };
      }
      throw e;
    }

    const shipment = await Shipment.findOne({ awbNumber: awb });
    if (!shipment) {
      await ShiprocketWebhookEvent.findByIdAndUpdate(webhookEvent._id, {
        processingStatus: 'SKIPPED',
        processingError: 'No matching shipment found for AWB',
        processedAt: new Date(),
      });
      return { success: false, reason: 'shipment_not_found' };
    }

    const internalStatus = shiprocketProvider.mapStatus(current_status, current_status_id);

    try {
      if (Array.isArray(scans) && scans.length > 0) {
        for (const scan of scans) {
          try {
            const scanEventId = crypto
              .createHash('sha256')
              .update(`${awb}:${scan.date}:${scan.status}`)
              .digest('hex');

            await ShipmentTrackingEvent.create({
              shipmentId: shipment._id,
              provider: 'SHIPROCKET',
              providerEventId: scanEventId,
              providerStatus: scan['sr-status-label'] || scan.status || current_status,
              internalStatus: shiprocketProvider.mapStatus(scan['sr-status-label'] || scan.status, scan['sr-status']),
              location: scan.location || '',
              description: scan.activity || '',
              eventTime: scan.date ? new Date(scan.date) : new Date(),
            });
          } catch (dupErr) {
            if (dupErr.code !== 11000) console.warn('[Webhook Scan] Insert error:', dupErr.message);
          }
        }
      } else {
        try {
          await ShipmentTrackingEvent.create({
            shipmentId: shipment._id,
            provider: 'SHIPROCKET',
            providerEventId: eventKey,
            providerStatus: current_status || shipment_status,
            internalStatus,
            location: '',
            description: current_status || '',
            eventTime: current_timestamp ? new Date(current_timestamp) : new Date(),
          });
        } catch (dupErr) {
          if (dupErr.code !== 11000) console.warn('[Webhook Fallback] Event insert error:', dupErr.message);
        }
      }

      // Non-regressive state progression
      const currentPriority = STATUS_PRIORITY.indexOf(shipment.status);
      const newPriority = STATUS_PRIORITY.indexOf(internalStatus);

      if (newPriority >= currentPriority) {
        shipment.status = internalStatus;
        if (internalStatus === 'PICKED_UP' && !shipment.pickedUpAt) {
          shipment.pickedUpAt = new Date();
        }
        if (internalStatus === 'DELIVERED' && !shipment.deliveredAt) {
          shipment.deliveredAt = new Date();
        }
        await shipment.save();

        const suborder = await VendorOrder.findById(shipment.suborderId);
        if (suborder) {
          suborder.status = internalStatus;
          if (internalStatus === 'DELIVERED') {
            suborder.deliveredAt = new Date();
            suborder.settlementStatus = 'ELIGIBLE';
          }
          await suborder.save();
          await this.syncMasterOrderStatus(suborder.parentOrderId);
        }
      }

      await ShiprocketWebhookEvent.findByIdAndUpdate(webhookEvent._id, {
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
        shipmentId: shipment._id,
      });

      return { success: true };
    } catch (error) {
      await ShiprocketWebhookEvent.findByIdAndUpdate(webhookEvent._id, {
        processingStatus: 'FAILED',
        processingError: error.message,
        processedAt: new Date(),
      });
      console.error('[Shiprocket Webhook] Processing error:', error);
      throw error;
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 9. MASTER ORDER STATUS ROLL-UP
  // ────────────────────────────────────────────────────────────────────────────

  async syncMasterOrderStatus(masterOrderId) {
    const suborders = await VendorOrder.find({ parentOrderId: masterOrderId });
    if (suborders.length === 0) return;

    const statuses = suborders.map((s) => s.status);
    const isAllDelivered = statuses.every((s) => s === 'DELIVERED');
    const isAnyDelivered = statuses.some((s) => s === 'DELIVERED');
    const isAllCancelled = statuses.every((s) => s === 'CANCELLED');
    const isAnyInTransit = statuses.some((s) => ['IN_TRANSIT', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(s));

    let newStatus = null;
    if (isAllDelivered) {
      newStatus = 'DELIVERED';
    } else if (isAnyDelivered) {
      newStatus = 'PARTIALLY_DELIVERED';
    } else if (isAllCancelled) {
      newStatus = 'CANCELLED';
    } else if (isAnyInTransit) {
      newStatus = 'IN_TRANSIT';
    }

    if (newStatus) {
      const masterOrder = await Order.findById(masterOrderId);
      if (masterOrder && masterOrder.orderStatus !== newStatus) {
        masterOrder.orderStatus = newStatus;
        await masterOrder.save();
      }
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 10. CANCELLATION
  // ────────────────────────────────────────────────────────────────────────────

  async cancelShipment(shipmentId, reason = 'Cancelled by vendor') {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    const nonCancellableStatuses = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (nonCancellableStatuses.includes(shipment.status)) {
      throw new ApiError(
        400,
        `Cannot cancel shipment in "${shipment.status}" status once handed to courier`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (shipment.shiprocketOrderId) {
      try {
        await shiprocketProvider.cancelOrder([shipment.shiprocketOrderId]);
      } catch (e) {
        console.warn('[Shipping] Shiprocket cancellation API notice:', e.message);
      }
    }

    shipment.status = 'CANCELLED';
    shipment.cancellationReason = reason;
    shipment.cancelledAt = new Date();
    await shipment.save();

    const suborder = await VendorOrder.findById(shipment.suborderId);
    if (suborder) {
      suborder.status = 'CANCELLED';
      await suborder.save();
      await this.syncMasterOrderStatus(suborder.parentOrderId);
    }

    return shipment;
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 11. RETURN SHIPMENT
  // ────────────────────────────────────────────────────────────────────────────

  async createReturnShipment(shipmentId, returnPayload) {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    if (shipment.status !== 'DELIVERED') {
      throw new ApiError(400, 'Return shipment can only be created for delivered shipments', ERROR_CODES.BAD_REQUEST);
    }

    if (shipment.returnShipmentId) {
      throw new ApiError(400, 'A return shipment already exists for this shipment', ERROR_CODES.BAD_REQUEST);
    }

    const result = await shiprocketProvider.createReturnOrder({
      order_id: shipment.shiprocketOrderId,
      order_date: new Date().toISOString().split('T')[0],
      channel_id: '',
      pickup_customer_name: returnPayload.pickupName || 'Customer',
      pickup_phone: returnPayload.pickupPhone || '',
      pickup_address: returnPayload.pickupAddress || shipment.destinationAddressSnapshot?.streetAddress || '',
      pickup_city: returnPayload.pickupCity || shipment.destinationAddressSnapshot?.city || '',
      pickup_state: returnPayload.pickupState || shipment.destinationAddressSnapshot?.state || '',
      pickup_country: 'India',
      pickup_pincode: returnPayload.pickupPincode || shipment.destinationAddressSnapshot?.postalCode || '',
      pickup_email: returnPayload.pickupEmail || '',
      shipping_customer_name: shipment.originAddressSnapshot?.contactName || 'Vendor',
      shipping_phone: shipment.originAddressSnapshot?.phone || '',
      shipping_address: shipment.originAddressSnapshot?.addressLine1 || '',
      shipping_city: shipment.originAddressSnapshot?.district?.name || shipment.originAddressSnapshot?.cityName || '',
      shipping_state: shipment.originAddressSnapshot?.state?.name || shipment.originAddressSnapshot?.stateName || '',
      shipping_country: 'India',
      shipping_pincode: shipment.originAddressSnapshot?.pincode || '',
      order_items: returnPayload.items || [],
      payment_method: 'Prepaid',
      sub_total: returnPayload.subTotal || 0,
      length: shipment.length,
      breadth: shipment.width,
      height: shipment.height,
      weight: shipment.packageWeight,
    });

    if (result.success) {
      shipment.returnShipmentId = result.returnOrderId?.toString() || result.returnShipmentId?.toString();
      shipment.status = 'RETURN_INITIATED';
      await shipment.save();
    }

    return { shipment, result };
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 12. ADMIN & VENDOR SHIPMENT RETRIEVAL
  // ────────────────────────────────────────────────────────────────────────────

  async getShipments(filters = {}, page = 1, limit = 20) {
    const query = {};

    if (filters.vendorId) query.vendorId = filters.vendorId;
    if (filters.suborderId) query.suborderId = filters.suborderId;
    if (filters.status) {
      if (filters.status.includes(',')) {
        query.status = { $in: filters.status.split(',').map((s) => s.trim()) };
      } else {
        query.status = filters.status;
      }
    }
    if (filters.awbNumber) query.awbNumber = { $regex: filters.awbNumber, $options: 'i' };
    if (filters.courierName) query.courierName = { $regex: filters.courierName, $options: 'i' };
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    const [shipments, total] = await Promise.all([
      Shipment.find(query)
        .populate('vendorId', 'storeName email')
        .populate('suborderId', 'subOrderNumber publicSuborderId grandTotal')
        .populate('parentOrderId', 'orderNumber publicOrderId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Shipment.countDocuments(query),
    ]);

    return { shipments, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getVendorShipments(vendorId, filters = {}, page = 1, limit = 20) {
    return this.getShipments({ ...filters, vendorId }, page, limit);
  },

  async getOrderShipments(masterOrderId, userId) {
    const masterOrder = await Order.findOne({ _id: masterOrderId, userId });
    if (!masterOrder) throw new ApiError(404, 'Order not found', ERROR_CODES.NOT_FOUND);

    const suborders = await VendorOrder.find({ parentOrderId: masterOrderId });
    const suborderIds = suborders.map((s) => s._id);

    const shipments = await Shipment.find({ suborderId: { $in: suborderIds } })
      .populate('vendorId', 'storeName')
      .populate('suborderId', 'subOrderNumber vendorNameSnapshot items grandTotal');

    const shipmentsWithEvents = await Promise.all(
      shipments.map(async (s) => {
        const events = await ShipmentTrackingEvent.find({ shipmentId: s._id })
          .sort({ eventTime: -1 })
          .limit(20);
        return { ...s.toObject(), trackingEvents: events };
      })
    );

    return { masterOrder, shipments: shipmentsWithEvents };
  },

  async getShippingStats() {
    const { Order } = await import('../models/Order.js');
    const { ReturnRequest } = await import('../models/ReturnRequest.js');

    const [
      totalOrders,
      totalShipments,
      pendingShipments,
      readyForPickup,
      pickedUp,
      inTransit,
      delivered,
      delayedShipments,
      cancelledShipments,
      returnRequests,
      approvedReturns,
      rejectedReturns,
      pendingRefunds,
      completedRefunds,
      failedRefunds,
      rtoShipments,
    ] = await Promise.all([
      Order.countDocuments().catch(() => 0),
      Shipment.countDocuments().catch(() => 0),
      Shipment.countDocuments({ status: { $in: ['DRAFT', 'READY', 'CREATED'] } }).catch(() => 0),
      Shipment.countDocuments({ status: { $in: ['AWB_ASSIGNED', 'PICKUP_REQUESTED', 'PICKUP_SCHEDULED'] } }).catch(() => 0),
      Shipment.countDocuments({ status: 'PICKED_UP' }).catch(() => 0),
      Shipment.countDocuments({ status: { $in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'SHIPPED'] } }).catch(() => 0),
      Shipment.countDocuments({ status: 'DELIVERED' }).catch(() => 0),
      Shipment.countDocuments({
        status: { $in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'SHIPPED'] },
        estimatedDeliveryDate: { $lt: new Date() },
      }).catch(() => 0),
      Shipment.countDocuments({ status: 'CANCELLED' }).catch(() => 0),
      ReturnRequest.countDocuments().catch(() => 0),
      ReturnRequest.countDocuments({ status: { $in: ['APPROVED', 'COMPLETED'] }, requestType: { $in: ['RETURN', 'REPLACEMENT'] } }).catch(() => 0),
      ReturnRequest.countDocuments({ status: 'REJECTED' }).catch(() => 0),
      ReturnRequest.countDocuments({ 'refundDetails.refundStatus': { $in: ['PENDING', 'PROCESSING'] } }).catch(() => 0),
      ReturnRequest.countDocuments({ 'refundDetails.refundStatus': 'COMPLETED' }).catch(() => 0),
      ReturnRequest.countDocuments({ 'refundDetails.refundStatus': 'FAILED' }).catch(() => 0),
      Shipment.countDocuments({ status: { $in: ['DELIVERY_FAILED', 'RETURN_INITIATED', 'RETURN_IN_TRANSIT', 'RETURNED'] } }).catch(() => 0),
    ]);

    return {
      totalOrders,
      totalShipments,
      pendingShipments,
      readyForPickup,
      pickedUp,
      inTransit,
      delivered,
      delayedShipments,
      cancelledShipments,
      returnRequests,
      approvedReturns,
      rejectedReturns,
      pendingRefunds,
      completedRefunds,
      failedRefunds,
      rtoShipments,
      total: totalShipments,
      PENDING: pendingShipments,
      READY_FOR_PICKUP: readyForPickup,
      IN_TRANSIT: inTransit,
      DELIVERED: delivered,
      CANCELLED: cancelledShipments,
    };
  },

  async retryShipmentCreation(shipmentId) {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

    if (!['DRAFT'].includes(shipment.status)) {
      throw new ApiError(400, 'Only DRAFT shipments can be retried', ERROR_CODES.BAD_REQUEST);
    }

    return this.createShipment(shipment.suborderId, shipment.vendorId, {});
  },
};

export default shippingService;
