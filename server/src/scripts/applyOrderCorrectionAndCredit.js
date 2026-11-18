import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Vendor } from '../models/Vendor.js';
import { platformCommissionService } from '../services/platformCommissionService.js';
import { allocateLineItem } from '../controllers/salesAnalyticsController.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/fairkart');
  console.log('Connected to MongoDB');

  const order = await Order.findOne({ orderNumber: 'FK1793286496752371' })
    .populate('userId', 'name email phone')
    .populate('items.vendorId', 'storeName slug phone email');

  if (!order) {
    console.error('Order FK1793286496752371 not found');
    process.exit(1);
  }

  // Update item taxSnapshot to 0
  await Order.updateOne(
    { _id: order._id, 'items._id': order.items[0]._id },
    { $set: { 'items.$.taxSnapshot': 0 } }
  );
  console.log('Updated order item taxSnapshot to 0');

  // Trigger immediate earnings distribution to vendor
  await platformCommissionService.creditOrderEarningsImmediately(order._id);
  console.log('Immediate order earnings distributed!');

  // Verify vendor balance
  const vendor = await Vendor.findById(order.items[0].vendorId._id || order.items[0].vendorId);
  console.log('Vendor updated balance:', {
    storeName: vendor.storeName,
    balance: vendor.balance,
    totalSales: vendor.totalSales
  });

  // Re-fetch order and check line item allocation
  const updatedOrder = await Order.findById(order._id)
    .populate('userId', 'name email phone')
    .populate('items.vendorId', 'storeName slug phone email')
    .lean();

  const allocated = allocateLineItem(updatedOrder, updatedOrder.items[0]);
  console.log('Allocated line item for Sales Report:', {
    productName: allocated.productName,
    unitPrice: allocated.unitPrice,
    lineTotal: allocated.lineTotal,
    discount: allocated.discount,
    tax: allocated.tax,
    shipping: allocated.shipping,
    finalAmount: allocated.finalAmount
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
