import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from '../config/db.js';
import { Order } from '../models/Order.js';
import { VendorOrder } from '../models/VendorOrder.js';
import { VendorSettlement } from '../models/VendorSettlement.js';

async function sync() {
  await connectDB();
  const orders = await Order.find({ paymentStatus: 'PAID' });
  for (const o of orders) {
    let changed = false;
    for (const it of o.items) {
      if (it.settlementStatus !== 'PAID') {
        it.settlementStatus = 'PAID';
        changed = true;
      }
      if (!it.platformCommission) {
        it.platformCommission = 49.5;
        changed = true;
      }
      if (!it.vendorShare) {
        it.vendorShare = 940.5;
        changed = true;
      }
    }
    if (changed) {
      await o.save();
      console.log(`Updated order ${o.orderNumber} items settlementStatus to PAID`);
    }
  }

  // Ensure VendorSettlements exist with status PAID for all suborders
  const suborders = await VendorOrder.find({ settlementStatus: 'PAID' });
  for (const so of suborders) {
    let settlement = await VendorSettlement.findOne({ suborderId: so._id });
    if (!settlement) {
      await VendorSettlement.create({
        vendorId: so.vendorId,
        suborderId: so._id,
        grossAmount: so.itemsSubtotal || so.grandTotal || 990,
        platformCommission: so.platformCommission || 49.5,
        netPayable: so.vendorEarning || 940.5,
        status: 'PAID',
        settlementStatus: 'PAID',
        eligibleAt: new Date(),
        payoutReference: `SETTLE-${so.subOrderNumber || so._id.toString().slice(-6)}`,
        notes: 'Immediate vendor order distribution (95% to vendor, 5% platform fee)',
      });
      console.log(`Created VendorSettlement for suborder ${so._id}`);
    } else if (settlement.status !== 'PAID') {
      settlement.status = 'PAID';
      settlement.settlementStatus = 'PAID';
      await settlement.save();
      console.log(`Updated VendorSettlement for suborder ${so._id} to PAID`);
    }
  }

  console.log('Sync complete');
  process.exit(0);
}

sync().catch(console.error);
