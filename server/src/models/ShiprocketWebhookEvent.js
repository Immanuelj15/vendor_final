/**
 * Shiprocket Webhook Event model
 *
 * Extends the existing WebhookEvent model pattern for Shiprocket-specific
 * webhook events. Stored separately to avoid conflicts with Razorpay webhooks.
 */

import mongoose from 'mongoose';

const shiprocketWebhookEventSchema = new mongoose.Schema(
  {
    // Deduplication key: awb + timestamp combination
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      comment: 'Deduplication key composed of awb + current_timestamp',
    },
    awbNumber: {
      type: String,
      required: true,
      index: true,
    },
    shiprocketOrderId: {
      type: String,
      default: '',
      index: true,
    },
    channelOrderId: {
      type: String,
      default: '',
      index: true,
    },
    courierName: { type: String, default: '' },
    currentStatus: { type: String, default: '' },
    currentStatusId: { type: Number, default: null },
    shipmentStatus: { type: String, default: '' },
    shipmentStatusId: { type: Number, default: null },
    eventTimestamp: { type: String, default: '' },
    isReturn: { type: Boolean, default: false },
    scansPayload: { type: Array, default: [] },
    rawPayload: { type: Object, required: true },
    processingStatus: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'SKIPPED'],
      default: 'RECEIVED',
      index: true,
    },
    processingError: { type: String, default: null },
    processedAt: { type: Date, default: null },
    // Which internal shipment this event was applied to
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

export const ShiprocketWebhookEvent = mongoose.model('ShiprocketWebhookEvent', shiprocketWebhookEventSchema);
export default ShiprocketWebhookEvent;
