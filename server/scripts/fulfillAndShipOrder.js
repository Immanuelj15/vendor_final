/**
 * Helper script to verify an order and generate a live Delhivery Shipment & AWB
 */

import mongoose from 'mongoose';
import '../src/config/env.js';
import { Order } from '../src/models/Order.js';
import { Product } from '../src/models/Product.js';
import { Vendor } from '../src/models/Vendor.js';
import { VendorOrder } from '../src/models/VendorOrder.js';
import { Shipment } from '../src/models/Shipment.js';
import { VendorShippingAddress } from '../src/models/VendorShippingAddress.js';
import { shippingService } from '../src/services/shippingService.js';
import { delhiveryProvider } from '../src/services/courier/delhiveryProvider.js';

async function processOrderForDelhivery(orderId) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.');

  const order = await Order.findById(orderId);
  if (!order) {
    console.error('Order not found:', orderId);
    process.exit(1);
  }

  console.log(`Processing Order #${order.orderNumber} (${order._id})...`);

  // 1. Mark order payment as PAID
  order.paymentStatus = 'PAID';
  order.orderStatus = 'IN_TRANSIT';
  await order.save();
  console.log('Payment status set to PAID.');

  // 2. Find or create vendor suborder
  let suborder = await VendorOrder.findOne({ parentOrderId: order._id });
  if (!suborder) {
    const item = order.items[0];
    const product = await Product.findById(item.productId);
    const vendorId = product?.vendorId || (await Vendor.findOne())?._id;
    const vendor = await Vendor.findById(vendorId);

    const totalAmt = order.itemsSubtotal || order.grandTotal || 999;
    const commRate = 5;
    const commAmt = Math.round(totalAmt * 0.05 * 100) / 100;
    const earning = totalAmt - commAmt;

    const suborderNum = `${order.orderNumber}-01`;
    const newSuborders = await VendorOrder.create([
      {
        publicSuborderId: suborderNum,
        subOrderNumber: suborderNum,
        parentOrderId: order._id,
        vendorId: vendor._id,
        vendorNameSnapshot: vendor?.storeName || 'Baapoo Mart Vendor',
        businessNameSnapshot: vendor?.businessName || 'Baapoo Mart Business',
        userId: order.userId,
        items: order.items,
        subtotal: totalAmt,
        itemsSubtotal: totalAmt,
        grandTotal: totalAmt,
        commissionRate: commRate,
        platformCommission: commAmt,
        vendorEarning: earning,
        status: 'READY_TO_SHIP',
        settlementStatus: 'PENDING_DELIVERY',
      },
    ]);
    suborder = newSuborders[0];
    console.log(`Created Vendor Suborder: ${suborder._id} (READY_TO_SHIP)`);
  } else {
    suborder.status = 'READY_TO_SHIP';
    await suborder.save();
    console.log(`Updated existing suborder to READY_TO_SHIP: ${suborder._id}`);
  }

  // 2b. Ensure vendor has a default pickup address
  let vendorAddr = await VendorShippingAddress.findOne({ vendorId: suborder.vendorId, status: 'ACTIVE' });
  if (!vendorAddr) {
    const vendor = await Vendor.findById(suborder.vendorId);
    vendorAddr = await VendorShippingAddress.create({
      vendorId: suborder.vendorId,
      contactName: vendor?.storeName || 'Primary Dispatch',
      businessName: vendor?.businessName || vendor?.storeName || 'Baapoo Mart Vendor Store',
      phone: vendor?.phone || '9876543210',
      email: vendor?.email || 'vendor@baapoomart.com',
      addressLine1: 'Warehouse Plot 12, Industrial Area',
      city: 'Chennai',
      cityName: 'Chennai',
      stateName: 'Tamil Nadu',
      pincode: '600001',
      isDefault: true,
      status: 'ACTIVE',
      delhiveryRegistrationStatus: 'REGISTERED',
      delhiveryPickupName: 'Primary Warehouse',
    });
    console.log(`Created default Vendor Pickup Address for Delhivery (${vendorAddr._id}).`);
  } else if (!vendorAddr.isDefault) {
    vendorAddr.isDefault = true;
    await vendorAddr.save();
  }

  // 3. Create Delhivery Shipment and Assign AWB
  let shipment = await Shipment.findOne({ suborderId: suborder._id });
  if (!shipment) {
    console.log('Creating live Delhivery shipment...');
    shipment = await shippingService.createShipment(suborder._id, suborder.vendorId);
  }

  // Ensure AWB is assigned
  if (!shipment.awbNumber || shipment.awbNumber === '') {
    const waybill = await delhiveryProvider.fetchWaybill();
    shipment.awbNumber = waybill;
    shipment.delhiveryWaybill = waybill;
    shipment.trackingUrl = `https://www.delhivery.com/track/package/${waybill}`;
    shipment.labelUrl = `https://track.delhivery.com/api/p/packing_slip?wbns=${waybill}`;
    shipment.status = 'IN_TRANSIT';
    await shipment.save();
  } else {
    shipment.status = 'IN_TRANSIT';
    await shipment.save();
  }

  console.log('\n======================================================');
  console.log('🎉 DELHIVERY SHIPMENT SUCCESSFULLY CREATED & LINKED!');
  console.log('======================================================');
  console.log(`Order Number:     ${order.orderNumber}`);
  console.log(`Courier Partner:  ${shipment.courierName || 'Delhivery Express'}`);
  console.log(`Delhivery AWB:    ${shipment.awbNumber}`);
  console.log(`Shipment Status:  ${shipment.status}`);
  console.log(`Live Tracking:    ${shipment.trackingUrl}`);
  console.log(`Packing Slip:     ${shipment.labelUrl}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

const targetOrderId = process.argv[2] || '6aff07395d53df9e32c304bd';
processOrderForDelhivery(targetOrderId);
