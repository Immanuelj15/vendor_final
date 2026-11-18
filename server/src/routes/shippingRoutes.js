/**
 * Shipping Routes — Production Shiprocket Integration
 */

import express from 'express';
import {
  // Vendor addresses
  getVendorShippingAddresses,
  addVendorShippingAddress,
  updateVendorShippingAddress,
  deleteVendorShippingAddress,
  registerVendorShippingAddress,
  // Serviceability & Courier options
  checkServiceability,
  getShipmentCourierOptions,
  publicServiceabilityCheck,
  // Shipments
  createShipment,
  adminCreateShipment,
  assignAWB,
  requestPickup,
  generateLabel,
  generateManifest,
  getShipmentTracking,
  getOrderShipments,
  getVendorShipments,
  // Admin
  adminGetShipments,
  adminGetShippingStats,
  adminGetShipmentDetail,
  adminCancelShipment,
  adminRetryShipment,
  adminGetShippingExceptions,
  checkShiprocketConnection,
  // Cancellation & Returns
  cancelShipment,
  createReturnShipment,
  // Webhook
  handleShiprocketWebhook,
} from '../controllers/shippingController.js';

import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Webhook (PUBLIC — Shiprocket authenticates via x-api-key header) ──────────
router.post('/webhook/shiprocket', handleShiprocketWebhook);

// ─── Public Serviceability Check (for checkout page) ─────────────────────────
router.get('/serviceability', publicServiceabilityCheck);

// ─── Authenticated Routes ─────────────────────────────────────────────────────
router.use(authenticate);

// ─── VENDOR: Pickup Addresses ─────────────────────────────────────────────────
router.get('/vendor/addresses', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), getVendorShippingAddresses);
router.post('/vendor/addresses', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), addVendorShippingAddress);
router.put('/vendor/addresses/:id', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), updateVendorShippingAddress);
router.delete('/vendor/addresses/:id', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), deleteVendorShippingAddress);
router.post('/vendor/addresses/:id/register', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), registerVendorShippingAddress);

// ─── VENDOR: Serviceability & Couriers ────────────────────────────────────────
router.get('/vendor/serviceability/:suborderId', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), checkServiceability);
router.get('/vendor/shipments/:id/couriers', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), getShipmentCourierOptions);

// ─── VENDOR: Shipment Operations ─────────────────────────────────────────────
router.get('/vendor/shipments', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), getVendorShipments);
router.post('/vendor/shipments', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), createShipment);
router.post('/vendor/shipments/:id/awb', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), assignAWB);
router.post('/vendor/shipments/:id/pickup', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), requestPickup);
router.get('/vendor/shipments/:id/label', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), generateLabel);
router.get('/vendor/shipments/:id/tracking', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN', 'CUSTOMER'), getShipmentTracking);
router.post('/vendor/shipments/:id/cancel', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), cancelShipment);
router.post('/vendor/shipments/:id/return', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), createReturnShipment);

// ─── CUSTOMER: Order Tracking ─────────────────────────────────────────────────
router.get('/customer/orders/:orderId/shipments', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN'), getOrderShipments);
router.get('/customer/shipments/:id/tracking', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN'), getShipmentTracking);

// ─── SUPER ADMIN: Full Shipping Management ────────────────────────────────────
router.get('/admin/connection-status', authorize('SUPER_ADMIN'), checkShiprocketConnection);
router.get('/admin/stats', authorize('SUPER_ADMIN'), adminGetShippingStats);
router.get('/admin/shipments', authorize('SUPER_ADMIN'), adminGetShipments);
router.post('/admin/shipments', authorize('SUPER_ADMIN'), adminCreateShipment);
router.get('/admin/shipments/:id', authorize('SUPER_ADMIN'), adminGetShipmentDetail);
router.post('/admin/shipments/:id/awb', authorize('SUPER_ADMIN'), assignAWB);
router.post('/admin/shipments/:id/pickup', authorize('SUPER_ADMIN'), requestPickup);
router.get('/admin/shipments/:id/label', authorize('SUPER_ADMIN'), generateLabel);
router.post('/admin/shipments/:id/manifest', authorize('SUPER_ADMIN'), generateManifest);
router.post('/admin/shipments/manifest', authorize('SUPER_ADMIN'), generateManifest);
router.post('/admin/manifest', authorize('SUPER_ADMIN'), generateManifest);
router.post('/admin/shipments/:id/cancel', authorize('SUPER_ADMIN'), adminCancelShipment);
router.post('/admin/shipments/:id/retry', authorize('SUPER_ADMIN'), adminRetryShipment);
router.get('/admin/exceptions', authorize('SUPER_ADMIN'), adminGetShippingExceptions);

export default router;
