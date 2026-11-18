import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fairkart';

async function backfillInvoices() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const { VendorSubscription } = await import('../src/models/VendorSubscription.js');
  const { VendorSubscriptionInvoice } = await import('../src/models/VendorSubscriptionInvoice.js');
  const { vendorSubscriptionInvoiceService } = await import('../src/services/vendorSubscriptionInvoiceService.js');

  const subscriptions = await VendorSubscription.find().sort({ createdAt: 1 });
  console.log(`Found ${subscriptions.length} vendor subscriptions.`);

  let createdCount = 0;
  for (const sub of subscriptions) {
    const existing = await VendorSubscriptionInvoice.findOne({ subscriptionId: sub._id });
    if (!existing) {
      try {
        const inv = await vendorSubscriptionInvoiceService.generateSubscriptionInvoice(sub._id);
        console.log(`[GENERATED] Sub ${sub._id} (${sub.planNameSnapshot}) -> Invoice ${inv.invoiceNumber}`);
        createdCount++;
      } catch (err) {
        console.warn(`[SKIPPED] Sub ${sub._id}:`, err.message);
      }
    } else {
      console.log(`[EXISTS] Sub ${sub._id} -> Invoice ${existing.invoiceNumber}`);
    }
  }

  console.log(`\nBackfill completed! Created ${createdCount} missing subscription invoices.`);
  await mongoose.disconnect();
}

backfillInvoices().catch(console.error);

