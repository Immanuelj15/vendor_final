import mongoose from 'mongoose';
import { vendorService } from '../services/vendorService.js';
import { productService } from '../services/productService.js';
import { Vendor } from '../models/Vendor.js';
import { User } from '../models/User.js';

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/fairkart');
  console.log('Connected to MongoDB');

  const vendorUser = await User.findOne({ email: 'imman@gmail.com' });
  if (!vendorUser) {
    console.error('Vendor user not found');
    process.exit(1);
  }

  console.log('Testing checkVendorEligibility for', vendorUser.email);
  const eligibleVendor = await vendorService.checkVendorEligibility(vendorUser._id);
  console.log('SUCCESS: checkVendorEligibility passed! Vendor:', {
    id: eligibleVendor._id,
    storeName: eligibleVendor.storeName,
    isPaid: eligibleVendor.isPaid,
    paymentStatus: eligibleVendor.paymentStatus,
    status: eligibleVendor.status,
    subscriptionPlan: eligibleVendor.subscriptionPlan
  });

  const dashboardData = await vendorService.getVendorDashboard(eligibleVendor._id);
  console.log('SUCCESS: getVendorDashboard returned activeSubscription:', {
    hasActiveSub: Boolean(dashboardData.activeSubscription),
    subPlan: dashboardData.activeSubscription?.planNameSnapshot || dashboardData.activeSubscription?.planId?.name,
    expiry: dashboardData.activeSubscription?.expiryDate
  });

  process.exit(0);
}

test().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
