/**
 * Delhivery Logistics Shipping Service — Production Implementation
 *
 * Handles the complete logistics lifecycle using Delhivery Express:
 *  1. Pincode serviceability & express rate calculation
 *  2. Order & shipment creation in Delhivery (idempotent, deduplicated)
 *  3. Waybill assignment & courier dispatch
 *  4. Warehouse pickup scheduling
 *  5. Packing slip & shipping label generation
 *  6. Manifest generation
 *  7. Live tracking & real-time milestone sync
 *  8. Webhook processing (with authentication & deduplication)
 *  9. Cancellation & reverse logistics returns
 *  10. Master order status roll-up
 */

import { Shipment } from '../models/Shipment.js';
import { VendorOrder } from '../models/VendorOrder.js';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { ShipmentTrackingEvent } from '../models/ShipmentTrackingEvent.js';
import { ShippingException } from '../models/ShippingException.js';
import { DelhiveryWebhookEvent } from '../models/DelhiveryWebhookEvent.js';
import { delhiveryProvider } from './courier/delhiveryProvider.js';
import { delhiveryPickupService } from './delhiveryPickupService.js';
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
 * Normalize weight to KG
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
 * Build order items array from VendorOrder items.
 */
function buildShipmentItems(items) {
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
   * Check Delhivery courier serviceability for a vendor suborder.
   */
  async checkServiceability(suborderId, vendorId) {
    const suborder = await VendorOrder.findOne({ _id: suborderId, vendorId });
    if (!suborder) throw new ApiError(404, 'Suborder not found', ERROR_CODES.NOT_FOUND);

    const masterOrder = await Order.findById(suborder.parentOrderId);
    if (!masterOrder) throw new ApiError(404, 'Master order not found', ERROR_CODES.NOT_FOUND);

    const originAddress = await delhiveryPickupService.getDefaultPickupAddress(vendorId);
    const destAddr = extractDeliveryAddress(masterOrder.deliveryAddressSnapshot);

    const { totalKg, missingWeight } = await calculateShipmentWeight(suborder.items);
    const isCOD = masterOrder.paymentMethod === 'COD';

    const serviceability = await delhiveryProvider.getServiceability(
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
      courierProvider: 'DELHIVERY',
    };
  },

  /**
   * Check available Delhivery couriers and rates for an existing shipment before AWB assignment.
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

    return delhiveryProvider.getServiceability(
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
   * Create a Delhivery shipment for a vendor suborder.
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

    // Get vendor pickup address and register in Delhivery
    const originAddress = await delhiveryPickupService.getDefaultPickupAddress(vendorId);
    const pickupLocationName = await delhiveryPickupService.ensurePickupLocation(vendorId, originAddress);

    // Calculate dimensions and weight
    const { totalKg: calculatedWeight } = await calculateShipmentWeight(suborder.items);
    const calculatedDim = await calculateShipmentDimensions(suborder.items);

    const finalWeight = options?.weight ? Math.max(0.01, parseFloat(options.weight)) : calculatedWeight;
    const finalLength = options?.length ? Math.max(0.5, parseFloat(options.length)) : calculatedDim.length;
    const finalBreadth = (options?.breadth || options?.width) ? Math.max(0.5, parseFloat(options?.breadth || options?.width)) : calculatedDim.breadth;
    const finalHeight = options?.height ? Math.max(0.5, parseFloat(options.height)) : calculatedDim.height;

    // Calculate COD amount for this suborder
    let codAmount = 0;
    if (isCOD) {
      codAmount = suborder.grandTotal + (suborder.shippingTotal || 0);
    }

    // Unique order reference for Delhivery
    const dlOrderRef = `BM-${suborder.subOrderNumber || suborder.publicSuborderId || suborderId}`;

    // Draft local record to prevent race conditions
    let shipment = existingShipment;
    if (!shipment) {
      shipment = await Shipment.create({
        suborderId,
        vendorId,
        parentOrderId: masterOrder._id,
        courierProvider: 'DELHIVERY',
        courierOrderId: dlOrderRef,
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

    shipment.creationAttempts = (shipment.creationAttempts || 0) + 1;
    shipment.lastCreationAttemptAt = new Date();

    try {
      const dlResult = await delhiveryProvider.createOrder({
        orderNumber: dlOrderRef,
        orderDate: masterOrder.createdAt?.toISOString()?.split('T')[0] || new Date().toISOString().split('T')[0],
        customerName: deliveryAddr.name || 'Customer',
        customerEmail: deliveryAddr.email || '',
        customerPhone: deliveryAddr.phone || '9999999999',
        deliveryAddress: deliveryAddr,
        pickupLocation: pickupLocationName,
        items: buildShipmentItems(suborder.items),
        weight: finalWeight,
        length: finalLength,
        breadth: finalBreadth,
        height: finalHeight,
        paymentMethod: isCOD ? 'COD' : 'Prepaid',
        subTotal: suborder.itemsSubtotal || suborder.grandTotal,
        codAmount,
        shippingCharge: suborder.shippingTotal || 0,
      });

      if (!dlResult.success) {
        throw new Error(dlResult.rawResponse?.message || 'Delhivery shipment creation was not successful');
      }

      shipment.delhiveryWaybill = dlResult.awbNumber;
      shipment.awbNumber = dlResult.awbNumber;
      shipment.courierName = dlResult.courierName || 'Delhivery Express';
      shipment.trackingUrl = dlResult.trackingUrl;
      shipment.labelUrl = dlResult.labelUrl;
      shipment.status = 'CREATED';
      // Compatibility fields
      shipment.shiprocketOrderId = dlResult.awbNumber;
      shipment.shiprocketShipmentId = dlResult.awbNumber;
      await shipment.save();

      suborder.status = 'SHIPMENT_CREATED';
      await suborder.save();

      // Record tracking creation event
      await ShipmentTrackingEvent.create({
        shipmentId: shipment._id,
        provider: 'DELHIVERY',
        providerEventId: `create_${dlResult.awbNumber}`,
        providerStatus: 'Manifest Created',
        internalStatus: 'CREATED',
        location: originAddress.cityName || originAddress.city || 'Vendor Warehouse',
        description: `Shipment created via Delhivery Express (AWB: ${dlResult.awbNumber})`,
        eventTime: new Date(),
      }).catch(() => {});

      console.log(`[Shipping] Delhivery shipment created for suborder ${suborderId}. AWB: ${dlResult.awbNumber}`);
      return shipment;

    } catch (error) {
      await ShippingException.create({
        shipmentId: shipment._id,
        provider: 'DELHIVERY',
        errorCode: error.statusCode ? String(error.statusCode) : 'CREATION_FAILED',
        errorMessage: error.message || 'Delhivery order creation failed',
        requestReference: dlOrderRef,
      }).catch(() => {});

      shipment.status = 'DRAFT';
      await shipment.save();

      throw new ApiError(
        502,
        `Failed to create Delhivery shipment: ${error.message}`,
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

    if (shipment.awbNumber) {
      return shipment; // Already assigned
    }

    try {
      const result = await delhiveryProvider.assignAWB(shipment._id.toString(), courierCompanyId);

      if (!result.success || !result.awbNumber) {
        throw new Error('Delhivery AWB assignment failed');
      }

      shipment.awbNumber = result.awbNumber;
      shipment.delhiveryWaybill = result.awbNumber;
      shipment.courierName = result.courierName || 'Delhivery Express';
      shipment.courierCompanyId = result.courierCompanyId || 101;
      shipment.trackingUrl = result.trackingUrl;
      shipment.labelUrl = result.labelUrl;
      shipment.status = 'AWB_ASSIGNED';
      await shipment.save();

      await ShipmentTrackingEvent.create({
        shipmentId: shipment._id,
        provider: 'DELHIVERY',
        providerEventId: `awb_${result.awbNumber}`,
        providerStatus: 'AWB Assigned',
        internalStatus: 'AWB_ASSIGNED',
        location: '',
        description: `AWB ${result.awbNumber} assigned via Delhivery Express`,
        eventTime: new Date(),
      }).catch(() => {});

      return shipment;
    } catch (error) {
      await ShippingException.create({
        shipmentId: shipment._id,
        provider: 'DELHIVERY',
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

    try {
      const res = await delhiveryProvider.requestPickup(
        shipment.pickupLocationName || 'BAAPOOMART',
        pickupDate,
        1
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

      await ShipmentTrackingEvent.create({
        shipmentId: shipment._id,
        provider: 'DELHIVERY',
        providerEventId: `pickup_${Date.now()}`,
        providerStatus: 'Pickup Requested',
        internalStatus: shipment.status,
        location: '',
        description: `Delhivery pickup scheduled. Token: ${res.pickupToken}`,
        eventTime: new Date(),
      }).catch(() => {});

      return shipment;
    } catch (error) {
      await ShippingException.create({
        shipmentId: shipment._id,
        provider: 'DELHIVERY',
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

    const waybill = shipment.delhiveryWaybill || shipment.awbNumber;
    if (!waybill) {
      throw new ApiError(400, 'Shipment does not have an AWB / Waybill number yet', ERROR_CODES.BAD_REQUEST);
    }

    const result = await delhiveryProvider.generateLabel(waybill);

    if (result.labelUrl) {
      shipment.labelUrl = result.labelUrl;
      await shipment.save();
    }

    return { labelUrl: shipment.labelUrl || result.labelUrl, shipment };
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 6. MANIFEST GENERATION
  // ────────────────────────────────────────────────────────────────────────────

  async generateManifest(shipmentIds) {
    const ids = Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds];
    const shipments = await Shipment.find({ _id: { $in: ids } });

    const waybills = shipments
      .map((s) => s.delhiveryWaybill || s.awbNumber)
      .filter(Boolean);

    if (waybills.length === 0) {
      throw new ApiError(400, 'No valid Delhivery Waybill numbers found for manifest generation', ERROR_CODES.BAD_REQUEST);
    }

    const result = await delhiveryProvider.generateManifest(waybills);

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
    const waybill = shipment.delhiveryWaybill || shipment.awbNumber;

    if (waybill) {
      try {
        liveTracking = await delhiveryProvider.trackByAWB(waybill);

        if (liveTracking?.currentStatus) {
          const mapped = delhiveryProvider.mapStatus(liveTracking.currentStatus);
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
        console.warn('[Shipping] Delhivery live tracking query notice:', e.message);
      }
    }

    return {
      shipment,
      trackingEvents: storedEvents,
      liveTracking,
    };
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 8. WEBHOOK PROCESSING (Delhivery Callback)
  // ────────────────────────────────────────────────────────────────────────────

  async handleWebhook(payload, providedApiKey) {
    const expectedSecret = env.DELHIVERY_WEBHOOK_SECRET || env.DELHIVERY_API_KEY;
    if (expectedSecret && providedApiKey && providedApiKey !== expectedSecret) {
      console.warn('[Delhivery Webhook] Invalid token received');
      throw new ApiError(401, 'Webhook authentication failed: invalid security token', ERROR_CODES.UNAUTHORIZED);
    }

    const waybill = payload.waybill || payload.awb || payload.Shipment?.Waybill || '';
    const status = payload.status || payload.Status?.Status || payload.current_status || '';
    const statusLocation = payload.location || payload.Status?.StatusLocation || '';
    const timestamp = payload.timestamp || payload.Status?.StatusDateTime || new Date().toISOString();

    if (!waybill) {
      console.warn('[Delhivery Webhook] Missing Waybill in webhook payload');
      return { success: false, reason: 'missing_waybill' };
    }

    const eventKey = crypto
      .createHash('sha256')
      .update(`${waybill}:${status}:${timestamp}`)
      .digest('hex');

    let webhookEvent;
    try {
      webhookEvent = await DelhiveryWebhookEvent.create({
        eventKey,
        waybill,
        orderId: payload.order_id || payload.order || '',
        status,
        statusType: payload.status_type || '',
        statusDateTime: String(timestamp),
        location: statusLocation,
        instructions: payload.instructions || '',
        rawPayload: payload,
      });
    } catch (e) {
      if (e.code === 11000) {
        console.log(`[Delhivery Webhook] Duplicate event for waybill ${waybill}, deduplicated.`);
        return { success: true, reason: 'duplicate_skipped' };
      }
      throw e;
    }

    const shipment = await Shipment.findOne({
      $or: [{ delhiveryWaybill: waybill }, { awbNumber: waybill }]
    });

    if (!shipment) {
      await DelhiveryWebhookEvent.findByIdAndUpdate(webhookEvent._id, {
        processingStatus: 'SKIPPED',
        processingError: 'No matching shipment found for waybill',
        processedAt: new Date(),
      });
      return { success: false, reason: 'shipment_not_found' };
    }

    const internalStatus = delhiveryProvider.mapStatus(status);

    try {
      await ShipmentTrackingEvent.create({
        shipmentId: shipment._id,
        provider: 'DELHIVERY',
        providerEventId: eventKey,
        providerStatus: status,
        internalStatus,
        location: statusLocation,
        description: payload.instructions || `Status update from Delhivery: ${status}`,
        eventTime: new Date(timestamp),
      }).catch(() => {});

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

      await DelhiveryWebhookEvent.findByIdAndUpdate(webhookEvent._id, {
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
        shipmentId: shipment._id,
      });

      return { success: true };
    } catch (error) {
      await DelhiveryWebhookEvent.findByIdAndUpdate(webhookEvent._id, {
        processingStatus: 'FAILED',
        processingError: error.message,
        processedAt: new Date(),
      });
      console.error('[Delhivery Webhook] Processing error:', error);
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

    const waybill = shipment.delhiveryWaybill || shipment.awbNumber;
    if (waybill) {
      try {
        await delhiveryProvider.cancelShipment(waybill);
      } catch (e) {
        console.warn('[Shipping] Delhivery cancellation notice:', e.message);
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

    const result = await delhiveryProvider.createReturnOrder({
      originalWaybill: shipment.delhiveryWaybill || shipment.awbNumber,
      orderNumber: shipment.courierOrderId,
      pickupCustomerName: returnPayload.pickupName || 'Customer',
      pickupPhone: returnPayload.pickupPhone || '',
      pickupAddress: returnPayload.pickupAddress || shipment.destinationAddressSnapshot?.streetAddress || '',
      pickupPincode: returnPayload.pickupPincode || shipment.destinationAddressSnapshot?.postalCode || '',
    });

    if (result.success) {
      shipment.returnShipmentId = result.returnWaybill || result.returnOrderId;
      shipment.returnAwbNumber = result.returnWaybill;
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
    if (filters.awbNumber) {
      query.$or = [
        { awbNumber: { $regex: filters.awbNumber, $options: 'i' } },
        { delhiveryWaybill: { $regex: filters.awbNumber, $options: 'i' } },
      ];
    }
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
