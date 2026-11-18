import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fairkart';
const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@fairkart.dev';
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Password@123';
const ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin';

async function resetToFreshMarketplace() {
  console.log('========================================================');
  console.log('  RESETTING TO CLEAN FRESH MARKETPLACE STATE');
  console.log('========================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Collections to completely clear
  const collectionsToWipe = [
    'vendors',
    'vendorbusinesses',
    'vendoraddresses',
    'vendorbankaccounts',
    'vendordocuments',
    'vendorstatushistories',
    'products',
    'productvariants',
    'stocktransactions',
    'orders',
    'vendororders',
    'fulfillments',
    'suborderstatushistories',
    'payments',
    'paymenttransactions',
    'webhookevents',
    'commissions',
    'vendorreferralcommissions',
    'vendorsettlements',
    'vendorwithdrawals',
    'vendorledgers',
    'platformledgers',
    'wallets',
    'wallettransactions',
    'cointransactions',
    'carts',
    'wishlists',
    'returnrequests',
    'customershopattributions',
    'referralrelationships',
    'auditlogs',
    'notifications',
    'spinrewards',
    'coupons',
    'campaigns',
    'deliveryassignments',
    'kycdocuments',
    'shopkeepers',
    'shops',
    'franchises',
    'subscriptions',
    'customersubscriptions',
    'referrals',
    'vendoractivities',
    'franchisehistories',
    'spinhistories',
    'spinattempts',
    'customerprofiles',
    'userlegalconsents',
    'emaillogs',
    'datadeletionrequests',
  ];

  console.log('\nWiping transactional, catalog, order, and vendor data...');
  for (const colName of collectionsToWipe) {
    try {
      const exists = await db.listCollections({ name: colName }).hasNext();
      if (exists) {
        const result = await db.collection(colName).deleteMany({});
        console.log(`  ✓ Cleared collection '${colName}': deleted ${result.deletedCount} documents`);
      }
    } catch (err) {
      console.warn(`  ! Could not clear '${colName}':`, err.message);
    }
  }

  // 2. Remove all non-Super-Admin users and test superadmins
  console.log('\nCleaning users (preserving primary Super Admin only)...');
  const deleteUsersResult = await db.collection('users').deleteMany({
    email: { $ne: ADMIN_EMAIL.toLowerCase().trim() }
  });
  console.log(`  ✓ Deleted ${deleteUsersResult.deletedCount} non-primary users.`);

  // 3. Ensure Super Admin account is guaranteed and ready
  console.log('\nEnsuring Super Admin account is ready...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);

  const superAdmin = await db.collection('users').findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase().trim() },
    {
      $set: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL.toLowerCase().trim(),
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        referralCode: 'SUPER100',
        fairCoinBalance: 0,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log(`  ✓ Super Admin active: ${superAdmin.email}`);

  // 4. Ensure default active Categories exist so vendor can immediately add products
  const categoryCount = await db.collection('categories').countDocuments();
  if (categoryCount === 0) {
    console.log('\nSeeding standard product categories...');
    const defaultCategories = [
      { name: 'Ayurveda & Wellness', normalizedName: 'ayurveda & wellness', slug: 'ayurveda-wellness', status: 'ACTIVE', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Handloom & Textiles', normalizedName: 'handloom & textiles', slug: 'handloom-textiles', status: 'ACTIVE', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Organic Foods & Spices', normalizedName: 'organic foods & spices', slug: 'organic-foods-spices', status: 'ACTIVE', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Handicrafts & Art', normalizedName: 'handicrafts & art', slug: 'handicrafts-art', status: 'ACTIVE', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Eco-Friendly Home', normalizedName: 'eco-friendly home', slug: 'eco-friendly-home', status: 'ACTIVE', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ];
    await db.collection('categories').insertMany(defaultCategories);
    console.log(`  ✓ Seeded ${defaultCategories.length} default categories.`);
  } else {
    console.log(`\nPreserved ${categoryCount} existing product categories.`);
  }

  console.log('\n========================================================');
  console.log('  CLEAN SLATE COMPLETE: READY FOR YOUR MANUAL TESTING');
  console.log('========================================================');
  console.log('\nSuper Admin Login:');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  URL:      http://localhost:5173/login (or /super-admin/login)\n`);

  await mongoose.disconnect();
}

resetToFreshMarketplace().catch(console.error);
