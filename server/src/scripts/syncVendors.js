import mongoose from 'mongoose';
import '../models/Vendor.js';
import '../models/VendorSubscription.js';
import { Vendor } from '../models/Vendor.js';
import { VendorSubscription } from '../models/VendorSubscription.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/fairkart');
  console.log('Connected to MongoDB');

  const subs = await VendorSubscription.find({
    subscriptionStatus: { $in: ['Active', 'ACTIVE'] },
  });

  for (const s of subs) {
    const res = await Vendor.findByIdAndUpdate(
      s.vendorId,
      {
        $set: {
          isPaid: true,
          paymentStatus: 'PAID',
          status: 'APPROVED',
          paidAmount: s.planPriceSnapshot || 999,
          paymentDate: s.createdAt || new Date(),
          subscriptionId: s._id,
          subscriptionPlan: s.planNameSnapshot || '',
          subscriptionExpiry: s.expiryDate,
        },
      },
      { new: true }
    );
    console.log('Synchronized vendor:', res?.storeName, 'isPaid:', res?.isPaid, 'status:', res?.status);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
