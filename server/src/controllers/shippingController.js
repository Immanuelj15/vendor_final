/**
 * Shipping Controller — Production Shiprocket Integration
 *
 * Covers:
 *  - Vendor pickup address CRUD & Shiprocket registration
 *  - PIN code serviceability check (public & vendor)
 *  - Available courier retrieval & recommendation
 *  - Shipment creation (vendor & admin)
 *  - AWB assignment
 *  - Pickup scheduling
 *  - Label generation
 *  - Manifest generation (single & bulk)
 *  - Live tracking (customer, vendor, admin)
 *  - Shipment cancellation
 *  - Return shipment creation
 *  - Webhook endpoint (authenticated with security token)
 *  - Shiprocket connection health check
 *  - Admin dashboard stats & exception logs
 */

import mongoose from 'mongoose';
import { VendorShippingAddress } from '../models/VendorShippingAddress.js';
import { Shipment } from '../models/Shipment.js';
import { ShipmentTrackingEvent } from '../models/ShipmentTrackingEvent.js';
import { ShippingException } from '../models/ShippingException.js';
import { Vendor } from '../models/Vendor.js';
import { shippingService } from '../services/shippingService.js';
import { shiprocketPickupService } from '../services/shiprocketPickupService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';
import { env } from '../config/env.js';

// ─── Helper: resolve vendor from user ─────────────────────────────────────────
async function getVendorForUser(userId) {
  const vendor = await Vendor.findOne({ userId });
  if (!vendor) throw new ApiError(404, 'Vendor profile not found', ERROR_CODES.NOT_FOUND);
  return vendor;
}

// ════════════════════════════════════════════════════════════════════════════════
// VENDOR PICKUP ADDRESS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

export const getVendorShippingAddresses = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const addresses = await VendorShippingAddress.find({ vendorId: vendor._id })
    .populate('state district area')
    .sort({ isDefault: -1, createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, { addresses }, 'Shipping addresses retrieved'));
});

export const addVendorShippingAddress = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const {
    contactName, businessName, phone, email,
    addressLine1, addressLine2, state, district, area,
    pincode, landmark, isDefault,
  } = req.body;

  if (!contactName || !businessName || !phone || !addressLine1 || !pincode) {
    throw new ApiError(400, 'Required fields: contactName, businessName, phone, addressLine1, pincode', ERROR_CODES.BAD_REQUEST);
  }

  if (!/^\d{6}$/.test(String(pincode).trim())) {
    throw new ApiError(400, 'PIN code must be a valid 6-digit number', ERROR_CODES.BAD_REQUEST);
  }

  const existingDefault = await VendorShippingAddress.findOne({ vendorId: vendor._id, isDefault: true, status: 'ACTIVE' });
  const shouldBeDefault = !!isDefault || !existingDefault;
  if (shouldBeDefault) {
    await VendorShippingAddress.updateMany({ vendorId: vendor._id }, { isDefault: false });
  }

  const toValidObjectId = (val) =>
    val && mongoose.Types.ObjectId.isValid(val) && String(new mongoose.Types.ObjectId(val)) === String(val) ? val : null;

  const address = await VendorShippingAddress.create({
    vendorId: vendor._id,
    contactName: contactName.trim(),
    businessName: businessName.trim(),
    phone: phone.trim(),
    email: email || vendor.email || '',
    addressLine1: addressLine1.trim(),
    addressLine2: addressLine2 ? addressLine2.trim() : '',
    city: req.body.city || req.body.cityName || (typeof district === 'string' && !toValidObjectId(district) ? district : ''),
    cityName: req.body.cityName || req.body.city || '',
    stateName: req.body.stateName || (typeof state === 'string' && !toValidObjectId(state) ? state : ''),
    state: toValidObjectId(state),
    district: toValidObjectId(district),
    area: toValidObjectId(area),
    pincode: String(pincode).trim(),
    landmark: landmark || '',
    isDefault: shouldBeDefault,
    shiprocketRegistrationStatus: 'UNREGISTERED',
  });

  // Attempt background registration with Shiprocket
  if (shouldBeDefault && shiprocketPickupService.isConfigured()) {
    const populatedAddr = await VendorShippingAddress.findById(address._id).populate('state district area');
    shiprocketPickupService.ensurePickupLocation(vendor._id, populatedAddr).catch((e) => {
      console.warn('[Shipping] Background Shiprocket pickup registration note:', e.message);
    });
  }

  const created = await VendorShippingAddress.findById(address._id).populate('state district area');
  return res.status(201).json(new ApiResponse(201, { address: created }, 'Shipping address added successfully'));
});

export const updateVendorShippingAddress = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const { id } = req.params;

  const address = await VendorShippingAddress.findOne({ _id: id, vendorId: vendor._id });
  if (!address) throw new ApiError(404, 'Shipping address not found', ERROR_CODES.NOT_FOUND);

  const {
    contactName, businessName, phone, email,
    addressLine1, addressLine2, state, district, area,
    pincode, landmark, isDefault,
  } = req.body;

  if (pincode && !/^\d{6}$/.test(String(pincode).trim())) {
    throw new ApiError(400, 'PIN code must be a valid 6-digit number', ERROR_CODES.BAD_REQUEST);
  }

  if (isDefault && !address.isDefault) {
    await VendorShippingAddress.updateMany({ vendorId: vendor._id }, { isDefault: false });
  }

  const addressChanged =
    (pincode && address.pincode !== String(pincode).trim()) ||
    (addressLine1 && address.addressLine1 !== addressLine1.trim());

  if (addressChanged) {
    address.shiprocketPickupName = null;
    address.shiprocketRegistrationStatus = 'UNREGISTERED';
  }

  const toValidObjectId = (val) =>
    val && mongoose.Types.ObjectId.isValid(val) && String(new mongoose.Types.ObjectId(val)) === String(val) ? val : null;

  Object.assign(address, {
    contactName: contactName ? contactName.trim() : address.contactName,
    businessName: businessName ? businessName.trim() : address.businessName,
    phone: phone ? phone.trim() : address.phone,
    email: email !== undefined ? email : address.email,
    addressLine1: addressLine1 ? addressLine1.trim() : address.addressLine1,
    addressLine2: addressLine2 !== undefined ? addressLine2.trim() : address.addressLine2,
    city: req.body.city || address.city,
    cityName: req.body.cityName || address.cityName,
    stateName: req.body.stateName || address.stateName,
    state: toValidObjectId(state) !== null ? toValidObjectId(state) : address.state,
    district: toValidObjectId(district) !== null ? toValidObjectId(district) : address.district,
    area: toValidObjectId(area) !== null ? toValidObjectId(area) : address.area,
    pincode: pincode ? String(pincode).trim() : address.pincode,
    landmark: landmark !== undefined ? landmark : address.landmark,
    isDefault: isDefault !== undefined ? !!isDefault : address.isDefault,
  });

  if (req.body.shiprocketPickupName !== undefined) {
    const val = String(req.body.shiprocketPickupName || '').trim();
    address.shiprocketPickupName = val || null;
    address.shiprocketRegistrationStatus = val ? 'REGISTERED' : 'UNREGISTERED';
    address.shiprocketRegisteredAt = val ? new Date() : null;
  }

  await address.save();
  const updated = await VendorShippingAddress.findById(address._id).populate('state district area');
  return res.status(200).json(new ApiResponse(200, { address: updated }, 'Shipping address updated'));
});

export const deleteVendorShippingAddress = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const { id } = req.params;

  const address = await VendorShippingAddress.findOne({ _id: id, vendorId: vendor._id });
  if (!address) throw new ApiError(404, 'Shipping address not found', ERROR_CODES.NOT_FOUND);

  if (address.isDefault) {
    throw new ApiError(400, 'Cannot delete the default pickup address. Set another address as default first.', ERROR_CODES.BAD_REQUEST);
  }

  address.status = 'INACTIVE';
  await address.save();

  return res.status(200).json(new ApiResponse(200, {}, 'Shipping address deactivated'));
});

export const registerVendorShippingAddress = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const { id } = req.params;

  const address = await VendorShippingAddress.findOne({ _id: id, vendorId: vendor._id }).populate('state district area');
  if (!address) throw new ApiError(404, 'Shipping address not found', ERROR_CODES.NOT_FOUND);

  const pickupName = await shiprocketPickupService.ensurePickupLocation(vendor._id, address);
  const updated = await VendorShippingAddress.findById(address._id).populate('state district area');
  return res.status(200).json(new ApiResponse(200, { address: updated, pickupLocationName: pickupName }, 'Pickup location registered with Shiprocket successfully'));
});

// ════════════════════════════════════════════════════════════════════════════════
// SERVICEABILITY & COURIER SELECTION
// ════════════════════════════════════════════════════════════════════════════════

export const checkServiceability = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const { suborderId } = req.params;

  const result = await shippingService.checkServiceability(suborderId, vendor._id);
  return res.status(200).json(new ApiResponse(200, result, 'Serviceability checked'));
});

export const getShipmentCourierOptions = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  let vendorId = null;
  if (req.user.role === 'VENDOR') {
    const vendor = await getVendorForUser(req.user._id);
    vendorId = vendor._id;
  }
  const result = await shippingService.getAvailableCouriersForShipment(id, vendorId);
  return res.status(200).json(new ApiResponse(200, result, 'Available couriers retrieved'));
});

export const publicServiceabilityCheck = asyncWrapper(async (req, res) => {
  const { pickupPincode, deliveryPincode, weight = 0.5, cod = 0 } = req.query;

  const destPin = String(deliveryPincode || '').trim();
  if (!destPin || !/^\d{6}$/.test(destPin)) {
    throw new ApiError(400, 'deliveryPincode must be a valid 6-digit PIN code', ERROR_CODES.BAD_REQUEST);
  }

  // If pickupPincode is not supplied, use default origin (e.g. platform main hub or query vendor)
  const originPin = String(pickupPincode || '110001').trim();
  if (!/^\d{6}$/.test(originPin)) {
    throw new ApiError(400, 'pickupPincode must be a valid 6-digit PIN code', ERROR_CODES.BAD_REQUEST);
  }

  try {
    const { shiprocketProvider } = await import('../services/courier/shiprocketProvider.js');
    const result = await shiprocketProvider.getServiceability(originPin, destPin, parseFloat(weight) || 0.5, cod ? 1 : 0);
    return res.status(200).json(new ApiResponse(200, result, 'Serviceability result'));
  } catch (err) {
    return res.status(200).json(new ApiResponse(200, {
      serviceable: false,
      availableCouriers: [],
      error: err.message,
      note: 'Courier serviceability check was unavailable. Please retry or contact support.',
    }, 'Serviceability check completed'));
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// SHIPMENT CREATION
// ════════════════════════════════════════════════════════════════════════════════

export const createShipment = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const { suborderId, courierCompanyId } = req.body;

  if (!suborderId) {
    throw new ApiError(400, 'suborderId is required', ERROR_CODES.BAD_REQUEST);
  }

  const shipment = await shippingService.createShipment(suborderId, vendor._id, { courierCompanyId });
  return res.status(201).json(new ApiResponse(201, { shipment }, 'Shipment created successfully in Shiprocket'));
});

export const adminCreateShipment = asyncWrapper(async (req, res) => {
  const { suborderId, vendorId, courierCompanyId } = req.body;

  if (!suborderId || !vendorId) {
    throw new ApiError(400, 'suborderId and vendorId are required', ERROR_CODES.BAD_REQUEST);
  }

  const shipment = await shippingService.createShipment(suborderId, vendorId, { courierCompanyId });
  return res.status(201).json(new ApiResponse(201, { shipment }, 'Shipment created successfully'));
});

// ════════════════════════════════════════════════════════════════════════════════
// AWB ASSIGNMENT
// ════════════════════════════════════════════════════════════════════════════════

export const assignAWB = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { courierCompanyId } = req.body;

  let vendorId = null;
  if (req.user.role === 'VENDOR') {
    const vendor = await getVendorForUser(req.user._id);
    vendorId = vendor._id;
  }

  const shipment = await shippingService.assignAWB(id, vendorId, courierCompanyId ? Number(courierCompanyId) : null);
  return res.status(200).json(new ApiResponse(200, { shipment }, 'AWB assigned successfully'));
});

// ════════════════════════════════════════════════════════════════════════════════
// PICKUP SCHEDULING
// ════════════════════════════════════════════════════════════════════════════════

export const requestPickup = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { pickupDate } = req.body;

  let vendorId = null;
  if (req.user.role === 'VENDOR') {
    const vendor = await getVendorForUser(req.user._id);
    vendorId = vendor._id;
  }

  const shipment = await shippingService.requestPickup(id, vendorId, pickupDate);
  return res.status(200).json(new ApiResponse(200, { shipment }, 'Pickup scheduled successfully'));
});

// ════════════════════════════════════════════════════════════════════════════════
// LABEL GENERATION
// ════════════════════════════════════════════════════════════════════════════════

export const generateLabel = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  let vendorId = null;
  if (req.user.role === 'VENDOR') {
    const vendor = await getVendorForUser(req.user._id);
    vendorId = vendor._id;
  }

  const result = await shippingService.generateLabel(id, vendorId);
  return res.status(200).json(new ApiResponse(200, result, 'Label generated successfully'));
});

// ════════════════════════════════════════════════════════════════════════════════
// MANIFEST GENERATION (Admin & Vendor)
// ════════════════════════════════════════════════════════════════════════════════

export const generateManifest = asyncWrapper(async (req, res) => {
  const shipmentIds = req.body?.shipmentIds || (req.params?.id ? [req.params.id] : []);

  if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
    throw new ApiError(400, 'shipmentIds array is required', ERROR_CODES.BAD_REQUEST);
  }

  const result = await shippingService.generateManifest(shipmentIds);
  return res.status(200).json(new ApiResponse(200, result, 'Manifest generated successfully'));
});

// ════════════════════════════════════════════════════════════════════════════════
// TRACKING
// ════════════════════════════════════════════════════════════════════════════════

export const getShipmentTracking = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await shippingService.trackShipment(id, req.user._id, req.user.role);
  return res.status(200).json(new ApiResponse(200, result, 'Tracking information retrieved'));
});

export const getOrderShipments = asyncWrapper(async (req, res) => {
  const { orderId } = req.params;
  const result = await shippingService.getOrderShipments(orderId, req.user._id);
  return res.status(200).json(new ApiResponse(200, result, 'Order shipments retrieved'));
});

// ════════════════════════════════════════════════════════════════════════════════
// VENDOR SHIPMENT LIST
// ════════════════════════════════════════════════════════════════════════════════

export const getVendorShipments = asyncWrapper(async (req, res) => {
  const vendor = await getVendorForUser(req.user._id);
  const { status, awbNumber, suborderId, page = 1, limit = 20 } = req.query;

  const result = await shippingService.getVendorShipments(
    vendor._id,
    { status, awbNumber, suborderId },
    parseInt(page),
    parseInt(limit)
  );

  return res.status(200).json(new ApiResponse(200, result, 'Vendor shipments retrieved'));
});

// ════════════════════════════════════════════════════════════════════════════════
// ADMIN SHIPMENT MANAGEMENT & DASHBOARD
// ════════════════════════════════════════════════════════════════════════════════

export const adminGetShipments = asyncWrapper(async (req, res) => {
  const { vendorId, status, awbNumber, courierName, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const result = await shippingService.getShipments(
    { vendorId, status, awbNumber, courierName, dateFrom, dateTo },
    parseInt(page),
    parseInt(limit)
  );

  return res.status(200).json(new ApiResponse(200, result, 'Shipments retrieved'));
});

export const adminGetShippingStats = asyncWrapper(async (req, res) => {
  const stats = await shippingService.getShippingStats();
  return res.status(200).json(new ApiResponse(200, { stats }, 'Shipping statistics retrieved'));
});

export const adminGetShipmentDetail = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const shipment = await Shipment.findById(id)
    .populate('vendorId', 'storeName email phone')
    .populate('suborderId')
    .populate('parentOrderId');

  if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);

  const trackingEvents = await ShipmentTrackingEvent.find({ shipmentId: id }).sort({ eventTime: -1 });
  const exceptions = await ShippingException.find({ shipmentId: id }).sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, { shipment, trackingEvents, exceptions }, 'Shipment detail'));
});

export const adminCancelShipment = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const shipment = await shippingService.cancelShipment(id, reason || 'Cancelled by admin');
  return res.status(200).json(new ApiResponse(200, { shipment }, 'Shipment cancelled'));
});

export const adminRetryShipment = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const shipment = await shippingService.retryShipmentCreation(id);
  return res.status(200).json(new ApiResponse(200, { shipment }, 'Shipment retry initiated'));
});

export const adminGetShippingExceptions = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const query = {};
  if (status) query.status = status;

  const [exceptions, total] = await Promise.all([
    ShippingException.find(query)
      .populate('shipmentId', 'awbNumber courierOrderId')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit)),
    ShippingException.countDocuments(query),
  ]);

  return res.status(200).json(new ApiResponse(200, { exceptions, total }, 'Shipping exceptions retrieved'));
});

export const checkShiprocketConnection = asyncWrapper(async (req, res) => {
  const { testConnection } = await import('../services/courier/shiprocketClient.js');
  const status = await testConnection();
  return res.status(200).json(new ApiResponse(200, { status }, 'Shiprocket connection status'));
});

// ════════════════════════════════════════════════════════════════════════════════
// CANCELLATION & RETURNS
// ════════════════════════════════════════════════════════════════════════════════

export const cancelShipment = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (req.user.role === 'VENDOR') {
    const vendor = await getVendorForUser(req.user._id);
    const shipment = await Shipment.findOne({ _id: id, vendorId: vendor._id });
    if (!shipment) throw new ApiError(404, 'Shipment not found', ERROR_CODES.NOT_FOUND);
  }

  const shipment = await shippingService.cancelShipment(id, reason || 'Cancelled by vendor');
  return res.status(200).json(new ApiResponse(200, { shipment }, 'Shipment cancelled'));
});

export const createReturnShipment = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const result = await shippingService.createReturnShipment(id, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Return shipment initiated'));
});

// ════════════════════════════════════════════════════════════════════════════════
// WEBHOOK (Shiprocket → Backend)
// ════════════════════════════════════════════════════════════════════════════════

export const handleShiprocketWebhook = asyncWrapper(async (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.headers['x-webhook-token'] || req.query.token || '';

  // Synchronous security verification
  const expectedSecret = env.SHIPROCKET_WEBHOOK_SECRET;
  if (expectedSecret && expectedSecret !== 'sr_webhook_demo') {
    if (apiKey !== expectedSecret) {
      console.warn('[Shiprocket Webhook] Rejected unauthorized webhook call');
      return res.status(401).json({ success: false, message: 'Invalid webhook security token' });
    }
  }

  // Acknowledge receipt to Shiprocket
  res.status(200).json({ status: 'received' });

  // Process event asynchronously
  shippingService.handleWebhook(req.body, apiKey).catch((err) => {
    console.error('[Shiprocket Webhook] Async error:', err.message);
  });
});
