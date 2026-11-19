/**
 * VendorShippingAddress model — Extended for Delhivery Logistics Integration
 */

import mongoose from 'mongoose';
import './Territory.js';

const vendorShippingAddressSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    contactName: { type: String, required: true },
    businessName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    city: { type: String, default: '' },
    cityName: { type: String, default: '' },
    stateName: { type: String, default: '' },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null, set: (v) => (!v ? null : v) },
    district: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null, set: (v) => (!v ? null : v) },
    area: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null, set: (v) => (!v ? null : v) },
    pincode: { type: String, required: true },
    landmark: { type: String, default: '' },
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },

    // ── Delhivery Logistics Fields ───────────────────────────────────────────
    delhiveryPickupName: {
      type: String,
      default: null,
      index: true,
    },
    delhiveryRegistrationStatus: {
      type: String,
      enum: ['UNREGISTERED', 'PENDING', 'REGISTERED', 'FAILED'],
      default: 'UNREGISTERED',
      index: true,
    },
    delhiveryRegisteredAt: {
      type: Date,
      default: null,
    },

    // ── Backward-compatible aliases ──────────────────────────────────────────
    shiprocketPickupName: {
      type: String,
      default: null,
    },
    shiprocketRegistrationStatus: {
      type: String,
      enum: ['UNREGISTERED', 'PENDING', 'REGISTERED', 'FAILED'],
      default: 'UNREGISTERED',
    },
    shiprocketRegisteredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const VendorShippingAddress = mongoose.model('VendorShippingAddress', vendorShippingAddressSchema);
