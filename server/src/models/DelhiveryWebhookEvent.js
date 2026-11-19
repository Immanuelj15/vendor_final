/**
 * Delhivery Webhook Event model
 * Stores incoming webhook callback events from Delhivery for tracking and delivery events.
 */

import mongoose from 'mongoose';

const delhiveryWebhookEventSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    waybill: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      default: '',
      index: true,
    },
    status: {
      type: String,
      default: '',
    },
    statusType: {
      type: String,
      default: '',
    },
    statusDateTime: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
    instructions: {
      type: String,
      default: '',
    },
    rawPayload: {
      type: Object,
      required: true,
    },
    processingStatus: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'SKIPPED'],
      default: 'RECEIVED',
      index: true,
    },
    processingError: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

export const DelhiveryWebhookEvent = mongoose.model('DelhiveryWebhookEvent', delhiveryWebhookEventSchema);
export default DelhiveryWebhookEvent;
