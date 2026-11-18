/**
 * Shiprocket Pickup Location Service
 *
 * Manages the registration and synchronization of vendor pickup locations
 * with Shiprocket. Each vendor must have a registered pickup location in
 * Shiprocket before shipments can be created.
 */

import { VendorShippingAddress } from '../models/VendorShippingAddress.js';
import { Vendor } from '../models/Vendor.js';
import { ShippingException } from '../models/ShippingException.js';
import { shiprocketProvider } from './courier/shiprocketProvider.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';
import { env } from '../config/env.js';

/**
 * Generate a unique, Shiprocket-compliant pickup location name for a vendor.
 * Shiprocket rules: Alphanumeric, underscores, hyphens only. No spaces. Max 36 chars.
 */
export function buildPickupLocationName(vendorId, storeName) {
  const safeStore = (storeName || 'Vendor')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 18)
    .replace(/^_+|_+$/g, '');

  const suffix = vendorId ? vendorId.toString().slice(-8) : '00000000';
  return `${safeStore || 'Vendor'}_${suffix}`.substring(0, 36);
}

export const shiprocketPickupService = {

  /**
   * Check whether Shiprocket credentials are configured.
   */
  isConfigured() {
    return !!(env.SHIPROCKET_EMAIL && (env.SHIPROCKET_PASSWORD || env.SHIPROCKET_API_KEY));
  },

  /**
   * Ensure a vendor has a registered pickup location in Shiprocket.
   * If not registered, registers it and stores the pickupLocationName on the address record.
   *
   * @param {string} vendorId - Vendor ObjectId
   * @param {object} vendorAddress - VendorShippingAddress document
   * @returns {Promise<string>} pickupLocationName string
   */
  async ensurePickupLocation(vendorId, vendorAddress) {
    // If already registered and verified, return existing name
    if (vendorAddress.shiprocketPickupName && vendorAddress.shiprocketRegistrationStatus === 'REGISTERED') {
      return vendorAddress.shiprocketPickupName;
    }

    if (!this.isConfigured()) {
      throw new ApiError(503, 'Shiprocket integration is not configured in server environment', ERROR_CODES.BAD_REQUEST);
    }

    // Fetch vendor for store name
    const vendor = await Vendor.findById(vendorId);
    const pickupName = vendorAddress.shiprocketPickupName || buildPickupLocationName(vendorId, vendor?.storeName || 'Vendor');

    // Check if location already exists in Shiprocket account (e.g. added via dashboard)
    try {
      const existingLocations = await shiprocketProvider.listPickupLocations();
      if (Array.isArray(existingLocations) && existingLocations.length > 0) {
        // Look for exact match by name, business name, or pincode, or fallback to first location
        const matched = existingLocations.find((loc) => {
          const locName = (loc.pickup_location || '').toLowerCase();
          return (
            locName === pickupName.toLowerCase() ||
            locName === (vendorAddress.businessName || '').toLowerCase() ||
            locName === (vendorAddress.contactName || '').toLowerCase() ||
            String(loc.pin_code) === String(vendorAddress.pincode)
          );
        }) || (existingLocations.length === 1 ? existingLocations[0] : null);

        if (matched && matched.pickup_location) {
          vendorAddress.shiprocketPickupName = matched.pickup_location;
          vendorAddress.shiprocketRegistrationStatus = 'REGISTERED';
          vendorAddress.shiprocketRegisteredAt = new Date();
          await vendorAddress.save();
          console.log(`[Shiprocket Pickup] Linked existing Shiprocket pickup location "${matched.pickup_location}" for vendor ${vendorId}`);
          return matched.pickup_location;
        }
      }
    } catch (listErr) {
      console.warn('[Shiprocket Pickup] Could not list existing locations:', listErr.message);
    }

    // Extract state and city cleanly
    const stateName =
      (typeof vendorAddress.state === 'object' && vendorAddress.state?.name) ||
      vendorAddress.stateName ||
      'State';

    const cityName =
      (typeof vendorAddress.district === 'object' && vendorAddress.district?.name) ||
      vendorAddress.cityName ||
      vendorAddress.city ||
      'City';

    try {
      const result = await shiprocketProvider.addPickupLocation({
        pickupLocationName: pickupName,
        name: vendorAddress.contactName || vendor?.storeName || 'Vendor Dispatch',
        email: vendorAddress.email || vendor?.email || env.SHIPROCKET_EMAIL,
        phone: vendorAddress.phone || vendor?.phone || '9999999999',
        address: vendorAddress.addressLine1,
        address2: vendorAddress.addressLine2 || '',
        city: cityName,
        state: stateName,
        country: 'India',
        pinCode: vendorAddress.pincode,
      });

      if (result.success || (result.message && result.message.toLowerCase().includes('already'))) {
        vendorAddress.shiprocketPickupName = pickupName;
        vendorAddress.shiprocketRegistrationStatus = 'REGISTERED';
        vendorAddress.shiprocketRegisteredAt = new Date();
        await vendorAddress.save();
        console.log(`[Shiprocket Pickup] Successfully registered location "${pickupName}" for vendor ${vendorId}`);
        return pickupName;
      }

      throw new Error(result.message || 'Pickup registration was not acknowledged by Shiprocket');
    } catch (err) {
      console.error(`[Shiprocket Pickup] Registration failed for vendor ${vendorId}:`, err.message);

      await ShippingException.create({
        shipmentId: null,
        provider: 'SHIPROCKET',
        errorCode: err.statusCode ? String(err.statusCode) : 'PICKUP_REGISTRATION_FAILED',
        errorMessage: err.message || 'Failed to register pickup location',
        requestReference: `vendor:${vendorId}`,
      }).catch(() => {});

      // If location already existed in Shiprocket, we can link it
      if (err.message && err.message.toLowerCase().includes('already')) {
        vendorAddress.shiprocketPickupName = pickupName;
        vendorAddress.shiprocketRegistrationStatus = 'REGISTERED';
        vendorAddress.shiprocketRegisteredAt = new Date();
        await vendorAddress.save();
        return pickupName;
      }

      // If API User does not have company settings permissions in Shiprocket
      if (err.message && (err.message.includes('Unauthorized') || err.message.includes('permission') || err.message.includes('403'))) {
        throw new ApiError(
          403,
          'Shiprocket API users cannot create company pickup addresses via API. Please add your pickup address directly in your Shiprocket Dashboard (Settings → Pickup Addresses → Add Pickup Location). It will automatically sync once added!',
          ERROR_CODES.FORBIDDEN
        );
      }

      throw new ApiError(
        502,
        `Shiprocket pickup location registration failed: ${err.message}`,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  },

  /**
   * List all registered pickup locations directly from Shiprocket account.
   */
  async listShiprocketLocations() {
    return shiprocketProvider.listPickupLocations();
  },

  /**
   * Sync all default active vendor addresses with Shiprocket.
   */
  async syncAllVendorPickupLocations() {
    const addresses = await VendorShippingAddress.find({
      isDefault: true,
      status: 'ACTIVE',
      shiprocketRegistrationStatus: { $ne: 'REGISTERED' },
    }).populate('state district area');

    const results = [];
    for (const addr of addresses) {
      try {
        const name = await this.ensurePickupLocation(addr.vendorId, addr);
        results.push({ vendorId: addr.vendorId, pickupName: name, success: true });
      } catch (e) {
        results.push({ vendorId: addr.vendorId, error: e.message, success: false });
      }
    }
    return results;
  },

  /**
   * Get vendor's default pickup address with full validation.
   */
  async getDefaultPickupAddress(vendorId) {
    let address = await VendorShippingAddress.findOne({
      vendorId,
      isDefault: true,
      status: 'ACTIVE',
    }).populate('state district area');

    // Fallback: If no address is marked default, select most recent active address and make it default
    if (!address) {
      address = await VendorShippingAddress.findOne({
        vendorId,
        status: 'ACTIVE',
      }).sort({ createdAt: -1 }).populate('state district area');

      if (address) {
        address.isDefault = true;
        await address.save();
      }
    }

    if (!address) {
      throw new ApiError(
        400,
        'Vendor does not have a pickup address configured. Please set up a pickup address in the Vendor Dashboard before creating shipments.',
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (!address.pincode || !/^\d{6}$/.test(address.pincode)) {
      throw new ApiError(
        400,
        'Vendor pickup address has an invalid or missing 6-digit PIN code. Please update your pickup address.',
        ERROR_CODES.BAD_REQUEST
      );
    }

    return address;
  },
};

export default shiprocketPickupService;
