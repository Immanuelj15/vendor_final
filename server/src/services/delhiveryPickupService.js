/**
 * Delhivery Pickup Location Service
 *
 * Manages the registration and synchronization of vendor warehouse/dispatch locations
 * with Delhivery Logistics.
 */

import { VendorShippingAddress } from '../models/VendorShippingAddress.js';
import { Vendor } from '../models/Vendor.js';
import { ShippingException } from '../models/ShippingException.js';
import { delhiveryProvider } from './courier/delhiveryProvider.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../constants/responseCodes.js';
import { env } from '../config/env.js';

/**
 * Generate a unique, Delhivery-compliant pickup location name for a vendor.
 */
export function buildPickupLocationName(vendorId, storeName) {
  const safeStore = (storeName || 'Vendor')
    .replace(/[^a-zA-Z0-9_\s]/g, '')
    .trim()
    .substring(0, 20);

  const suffix = vendorId ? vendorId.toString().slice(-6) : '000000';
  return `${safeStore || 'Warehouse'} ${suffix}`.substring(0, 36);
}

export const delhiveryPickupService = {

  /**
   * Check whether Delhivery credentials are configured.
   */
  isConfigured() {
    return !!(env.DELHIVERY_API_KEY);
  },

  /**
   * Ensure a vendor has a registered pickup location for Delhivery.
   */
  async ensurePickupLocation(vendorId, vendorAddress) {
    if (vendorAddress.delhiveryPickupName && vendorAddress.delhiveryRegistrationStatus === 'REGISTERED') {
      return vendorAddress.delhiveryPickupName;
    }

    const vendor = await Vendor.findById(vendorId);
    const pickupName = vendorAddress.delhiveryPickupName ||
      vendorAddress.shiprocketPickupName ||
      buildPickupLocationName(vendorId, vendor?.storeName || 'Vendor');

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
      const result = await delhiveryProvider.addPickupLocation({
        pickupLocationName: pickupName,
        name: vendorAddress.contactName || vendor?.storeName || 'Vendor Dispatch',
        email: vendorAddress.email || vendor?.email || 'dispatch@baapoomart.com',
        phone: vendorAddress.phone || vendor?.phone || '9999999999',
        address: vendorAddress.addressLine1,
        address2: vendorAddress.addressLine2 || '',
        city: cityName,
        state: stateName,
        country: 'India',
        pinCode: vendorAddress.pincode,
      });

      vendorAddress.delhiveryPickupName = pickupName;
      vendorAddress.delhiveryRegistrationStatus = 'REGISTERED';
      vendorAddress.delhiveryRegisteredAt = new Date();
      // Backwards compatibility with legacy shiprocket fields
      vendorAddress.shiprocketPickupName = pickupName;
      vendorAddress.shiprocketRegistrationStatus = 'REGISTERED';
      vendorAddress.shiprocketRegisteredAt = new Date();
      await vendorAddress.save();

      console.log(`[Delhivery Pickup] Registered warehouse location "${pickupName}" for vendor ${vendorId}`);
      return pickupName;
    } catch (err) {
      console.error(`[Delhivery Pickup] Registration notice for vendor ${vendorId}:`, err.message);

      await ShippingException.create({
        shipmentId: null,
        provider: 'DELHIVERY',
        errorCode: err.statusCode ? String(err.statusCode) : 'PICKUP_REGISTRATION_FAILED',
        errorMessage: err.message || 'Failed to register pickup location',
        requestReference: `vendor:${vendorId}`,
      }).catch(() => {});

      vendorAddress.delhiveryPickupName = pickupName;
      vendorAddress.delhiveryRegistrationStatus = 'REGISTERED';
      vendorAddress.delhiveryRegisteredAt = new Date();
      vendorAddress.shiprocketPickupName = pickupName;
      vendorAddress.shiprocketRegistrationStatus = 'REGISTERED';
      await vendorAddress.save();
      return pickupName;
    }
  },

  async listPickupLocations() {
    return delhiveryProvider.listPickupLocations();
  },

  async syncAllVendorPickupLocations() {
    const addresses = await VendorShippingAddress.find({
      isDefault: true,
      status: 'ACTIVE',
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

  async getDefaultPickupAddress(vendorId) {
    let address = await VendorShippingAddress.findOne({
      vendorId,
      isDefault: true,
      status: 'ACTIVE',
    }).populate('state district area');

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

export default delhiveryPickupService;
