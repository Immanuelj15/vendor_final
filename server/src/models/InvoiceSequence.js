import mongoose from 'mongoose';

const invoiceSequenceSchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: true,
      index: true,
      comment: 'Financial year string, e.g. 2026-27',
    },
    prefix: {
      type: String,
      default: 'BM',
      comment: 'Brand prefix, e.g. BM for BAAPOO MART',
    },
    lastSequenceNumber: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

invoiceSequenceSchema.index({ financialYear: 1, prefix: 1 }, { unique: true });

/**
 * Atomically increment and get the next sequential invoice number
 * Format: BM/2026-27/000001
 */
invoiceSequenceSchema.statics.getNextInvoiceNumber = async function (prefix = 'BM', customDate = new Date()) {
  const d = new Date(customDate);
  const month = d.getMonth() + 1; // 1-12
  const fullYear = d.getFullYear();

  // Indian financial year runs from April 1 (Month 4) to March 31 of next year
  let startYear, endYear;
  if (month >= 4) {
    startYear = fullYear;
    endYear = (fullYear + 1).toString().slice(-2);
  } else {
    startYear = fullYear - 1;
    endYear = fullYear.toString().slice(-2);
  }
  const financialYear = `${startYear}-${endYear}`;

  const record = await this.findOneAndUpdate(
    { financialYear, prefix },
    { $inc: { lastSequenceNumber: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const paddedSeq = record.lastSequenceNumber.toString().padStart(6, '0');
  return `${prefix}/${financialYear}/${paddedSeq}`;
};

export const InvoiceSequence = mongoose.model('InvoiceSequence', invoiceSequenceSchema);
export default InvoiceSequence;

