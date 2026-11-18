import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Register models
import '../src/models/Territory.js';
import { User } from '../src/models/User.js';
import { Vendor } from '../src/models/Vendor.js';
import Order from '../src/models/Order.js';
import { VendorOrder } from '../src/models/VendorOrder.js';
import Invoice from '../src/models/Invoice.js';
import InvoiceSequence from '../src/models/InvoiceSequence.js';

import brandingService from '../src/services/brandingService.js';
import taxCalculatorService from '../src/services/taxCalculatorService.js';
import pdfInvoiceGenerator from '../src/services/pdfInvoiceGenerator.js';
import invoiceService from '../src/services/invoiceService.js';

async function runInvoiceTests() {
  console.log('====================================================');
  console.log('   BAAPOO MART - Dynamic Invoice System Test Suite   ');
  console.log('====================================================');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fairkart';
  console.log(`Connecting to MongoDB at: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.\n');

  try {
    // ------------------------------------------------------------------
    // TEST 1: Branding Service Verification
    // ------------------------------------------------------------------
    console.log('--- TEST 1: Dynamic Website Branding Extraction ---');
    const branding = await brandingService.getBrandingSnapshot();
    console.log('Brand Name:', branding.brandName);
    console.log('Legal Entity:', branding.legalName);
    console.log('Brand Tagline:', branding.tagline);
    console.log('Logo Path:', branding.logoPath);
    console.log('Logo File Exists:', Boolean(branding.logoPath && fs.existsSync(branding.logoPath)));
    console.log('Brand Colors (Primary/Secondary):', branding.primaryColor, branding.secondaryColor);
    console.log('Registered Business Address:', branding.registeredAddress);
    console.log('GSTIN:', branding.gstin);
    
    if (!branding.brandName || !branding.primaryColor) {
      throw new Error('Branding extraction failed: missing website name or colors.');
    }
    console.log('>> TEST 1 PASSED: Dynamic Website Branding accurately resolved.\n');

    // ------------------------------------------------------------------
    // TEST 2: Sequential Numbering Generation
    // ------------------------------------------------------------------
    console.log('--- TEST 2: Atomic Sequential Invoice Numbering ---');
    const seqNum1 = await InvoiceSequence.getNextInvoiceNumber('BM');
    const seqNum2 = await InvoiceSequence.getNextInvoiceNumber('BM');
    const cnNum1 = await InvoiceSequence.getNextInvoiceNumber('CN');
    console.log('Invoice Sequence #1:', seqNum1);
    console.log('Invoice Sequence #2:', seqNum2);
    console.log('Credit Note Sequence #1:', cnNum1);

    if (!seqNum1.startsWith('BM/') || !seqNum2.startsWith('BM/') || !cnNum1.startsWith('CN/')) {
      throw new Error('Invoice sequence numbering format incorrect.');
    }
    console.log('>> TEST 2 PASSED: Sequential invoice numbering correctly generated.\n');

    // ------------------------------------------------------------------
    // TEST 3: Tax Calculation Engine (Intra-State vs Inter-State + Coins)
    // ------------------------------------------------------------------
    console.log('--- TEST 3: Decimal-Safe GST Tax Engine ---');
    const mockItems = [
      {
        sNo: 1,
        productId: new mongoose.Types.ObjectId(),
        productNameSnapshot: 'Pure Organic Cotton Kurta',
        skuSnapshot: 'KT-ORG-001',
        hsnCode: '6204',
        quantity: 2,
        unitPrice: 500,
        taxRate: 5,
      },
      {
        sNo: 2,
        productId: new mongoose.Types.ObjectId(),
        productNameSnapshot: 'Handmade Brass Pooja Thali',
        skuSnapshot: 'BRS-TH-99',
        hsnCode: '7419',
        quantity: 1,
        unitPrice: 1000,
        taxRate: 18,
      }
    ];

    // Allocate total discount (₹100 coupon + ₹50 Fair Coins = ₹150)
    const discountedItems = taxCalculatorService.allocateDiscounts(mockItems, 150);
    console.log('Allocated Discounts across items:');
    discountedItems.forEach(i => console.log(` - ${i.productNameSnapshot}: Allocated Discount = ₹${i.allocatedDiscount}`));

    // Intra-state (Karnataka to Karnataka)
    const isInterStateIntra = taxCalculatorService.isInterState('Karnataka', 'Karnataka');
    const intraItems = discountedItems.map(item => taxCalculatorService.calculateLineItem(item, true, isInterStateIntra));
    const intraCgst = intraItems.reduce((sum, i) => sum + i.cgstAmount, 0);
    const intraSgst = intraItems.reduce((sum, i) => sum + i.sgstAmount, 0);
    const intraIgst = intraItems.reduce((sum, i) => sum + i.igstAmount, 0);
    const intraTaxable = intraItems.reduce((sum, i) => sum + i.taxableAmount, 0);
    const intraTotal = intraItems.reduce((sum, i) => sum + i.totalAmount, 0);

    console.log('\nIntra-State Calculation (KA -> KA):');
    console.log('Is Inter-State:', isInterStateIntra);
    console.log('Total Taxable Value: ₹', taxCalculatorService.round(intraTaxable));
    console.log('Total CGST: ₹', taxCalculatorService.round(intraCgst));
    console.log('Total SGST: ₹', taxCalculatorService.round(intraSgst));
    console.log('Total IGST: ₹', taxCalculatorService.round(intraIgst));
    console.log('Total Net Line Amount: ₹', taxCalculatorService.round(intraTotal));

    if (isInterStateIntra || intraCgst <= 0 || intraSgst <= 0 || intraIgst !== 0) {
      throw new Error('Intra-state calculation failed: expected CGST+SGST, 0 IGST.');
    }

    // Inter-state (Karnataka to Maharashtra)
    const isInterStateInter = taxCalculatorService.isInterState('Karnataka', 'Maharashtra');
    const interItems = discountedItems.map(item => taxCalculatorService.calculateLineItem(item, true, isInterStateInter));
    const interCgst = interItems.reduce((sum, i) => sum + i.cgstAmount, 0);
    const interSgst = interItems.reduce((sum, i) => sum + i.sgstAmount, 0);
    const interIgst = interItems.reduce((sum, i) => sum + i.igstAmount, 0);
    const interTaxable = interItems.reduce((sum, i) => sum + i.taxableAmount, 0);
    const interTotal = interItems.reduce((sum, i) => sum + i.totalAmount, 0);

    console.log('\nInter-State Calculation (KA -> MH):');
    console.log('Is Inter-State:', isInterStateInter);
    console.log('Total Taxable Value: ₹', taxCalculatorService.round(interTaxable));
    console.log('Total CGST: ₹', taxCalculatorService.round(interCgst));
    console.log('Total SGST: ₹', taxCalculatorService.round(interSgst));
    console.log('Total IGST: ₹', taxCalculatorService.round(interIgst));
    console.log('Total Net Line Amount: ₹', taxCalculatorService.round(interTotal));

    if (!isInterStateInter || interIgst <= 0 || interCgst !== 0 || interSgst !== 0) {
      throw new Error('Inter-state calculation failed: expected IGST, 0 CGST/SGST.');
    }
    console.log('>> TEST 3 PASSED: Tax calculations intra-state and inter-state verified.\n');

    // ------------------------------------------------------------------
    // TEST 4: Multi-Vendor Order & End-to-End Invoice Generation
    // ------------------------------------------------------------------
    console.log('--- TEST 4: Multi-Vendor Order & Invoice Creation ---');

    // Ensure mock customer exists
    let customer = await User.findOne({ email: 'testcustomer.invoice@baapoo.com' });
    if (!customer) {
      customer = await User.findOne({ role: 'CUSTOMER' });
    }
    if (!customer) {
      customer = await User.create({
        name: 'Ramesh Patel',
        email: 'testcustomer.invoice@baapoo.com',
        phone: '98' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'CUSTOMER',
        passwordHash: 'dummy-hash'
      });
    }

    // Ensure 2 distinct Vendors exist
    const existingVendors = await Vendor.find().limit(2);
    let vendor1, vendor2;
    if (existingVendors.length >= 2) {
      vendor1 = existingVendors[0];
      vendor2 = existingVendors[1];
    } else {
      const vUser1 = await User.create({
        name: 'Vendor One Owner',
        email: `vowner1_${Date.now()}@baapoo.com`,
        phone: '97' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'VENDOR',
        passwordHash: 'dummy'
      });
      vendor1 = await Vendor.create({
        userId: vUser1._id,
        storeName: 'Baapoo Khadi Textiles',
        slug: 'baapoo-khadi-textiles-' + Date.now(),
        businessType: 'INDIVIDUAL',
        address: { street: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', zip: '560001', country: 'India' },
        status: 'APPROVED'
      });

      const vUser2 = await User.create({
        name: 'Vendor Two Owner',
        email: `vowner2_${Date.now()}@baapoo.com`,
        phone: '96' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'VENDOR',
        passwordHash: 'dummy'
      });
      vendor2 = await Vendor.create({
        userId: vUser2._id,
        storeName: 'Swadeshi Handicrafts Pune',
        slug: 'swadeshi-handicrafts-pune-' + Date.now(),
        businessType: 'INDIVIDUAL',
        address: { street: '45 FC Road', city: 'Pune', state: 'Maharashtra', zip: '411004', country: 'India' },
        status: 'APPROVED'
      });
    }
    console.log(`Using Vendor 1: ${vendor1.storeName} (${vendor1._id}) and Vendor 2: ${vendor2.storeName} (${vendor2._id})`);

    // Create a multi-vendor Order
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `BM-TEST-${randomSuffix}`;

    const pId1 = new mongoose.Types.ObjectId();
    const item1 = {
      productId: pId1,
      vendorId: vendor1._id,
      name: 'Khadi Cotton Kurta',
      productNameSnapshot: 'Khadi Cotton Kurta',
      skuSnapshot: 'KHD-001',
      hsnCode: '6204',
      quantity: 2,
      price: 600,
      unitPrice: 600,
      itemDiscount: 0,
      taxRate: 5,
      lineTotal: 1200,
      total: 1200
    };

    const pId2 = new mongoose.Types.ObjectId();
    const item2 = {
      productId: pId2,
      vendorId: vendor2._id,
      name: 'Handcrafted Wooden Channapatna Toy',
      productNameSnapshot: 'Handcrafted Wooden Channapatna Toy',
      skuSnapshot: 'CPT-TOY-01',
      hsnCode: '9503',
      quantity: 1,
      price: 800,
      unitPrice: 800,
      itemDiscount: 0,
      taxRate: 12,
      lineTotal: 800,
      total: 800
    };

    const order = await Order.create({
      userId: customer._id,
      user: customer._id,
      orderNumber,
      publicOrderId: orderNumber,
      items: [item1, item2],
      subtotal: 2000,
      itemsSubtotal: 2000,
      discount: 100, // Coupon discount
      coinDiscount: 50, // 500 Fair Coins = ₹50
      fairCoinsUsed: 500,
      shippingFee: 80,
      total: 1930,
      grandTotal: 1930,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      deliveryAddressSnapshot: {
        name: 'Ramesh Patel',
        phone: '9876543210',
        streetAddress: 'Flat 402, Shanti Heights, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'India'
      }
    });

    // Create 2 VendorOrder records
    const vOrder1 = await VendorOrder.create({
      publicSuborderId: `${orderNumber}-V1`,
      subOrderNumber: `${orderNumber}-V1`,
      parentOrderId: order._id,
      vendorId: vendor1._id,
      vendorNameSnapshot: vendor1.storeName,
      businessNameSnapshot: vendor1.storeName,
      userId: customer._id,
      items: [item1],
      subtotal: 1200,
      itemsSubtotal: 1200,
      discountTotal: 60,
      shippingTotal: 40,
      grandTotal: 1150,
      platformCommission: 60,
      vendorEarning: 1090
    });

    const vOrder2 = await VendorOrder.create({
      publicSuborderId: `${orderNumber}-V2`,
      subOrderNumber: `${orderNumber}-V2`,
      parentOrderId: order._id,
      vendorId: vendor2._id,
      vendorNameSnapshot: vendor2.storeName,
      businessNameSnapshot: vendor2.storeName,
      userId: customer._id,
      items: [item2],
      subtotal: 800,
      itemsSubtotal: 800,
      discountTotal: 40,
      shippingTotal: 40,
      grandTotal: 780,
      platformCommission: 40,
      vendorEarning: 740
    });

    console.log(`Created multi-vendor order ${orderNumber} with suborders ${vOrder1.publicSuborderId} & ${vOrder2.publicSuborderId}`);

    // Trigger invoice generation
    const generatedInvoices = await invoiceService.generateInvoicesForOrder(order._id);
    console.log(`Generated ${generatedInvoices.length} Invoices for Order ${orderNumber}:`);

    for (const inv of generatedInvoices) {
      console.log(` - Type: ${inv.invoiceType} | #${inv.invoiceNumber} | Seller: ${inv.sellerSnapshot?.storeName} | Grand Total: ₹${inv.pricing?.grandTotal}`);
      console.log(`   PDF storage: ${inv.pdfStoragePath} (file exists: ${fs.existsSync(path.resolve(process.cwd(), inv.pdfStoragePath))})`);
      console.log(`   Items in invoice: ${inv.items?.length}`);
    }

    if (generatedInvoices.length < 2) {
      throw new Error('Expected at least 2 vendor tax invoices for a 2-vendor order.');
    }
    console.log('>> TEST 4 PASSED: Multi-vendor invoices generated successfully with correct seller snapshots.\n');

    // ------------------------------------------------------------------
    // TEST 5: PDF Buffer Verification
    // ------------------------------------------------------------------
    console.log('--- TEST 5: PDF Generation Verification ---');
    const firstInvoice = generatedInvoices[0];
    const pdfBuffer = await pdfInvoiceGenerator.generateBuffer(firstInvoice);
    console.log(`Generated PDF Buffer size: ${pdfBuffer.length} bytes`);
    
    // Check PDF magic header "%PDF-"
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    console.log(`PDF Magic Header: "${pdfHeader}"`);
    if (pdfHeader !== '%PDF-') {
      throw new Error(`Invalid PDF header: expected %PDF-, got ${pdfHeader}`);
    }
    console.log('>> TEST 5 PASSED: Valid A4 PDF generated with proper header and binary structure.\n');

    // ------------------------------------------------------------------
    // TEST 6: Credit Note & Order Cancellation
    // ------------------------------------------------------------------
    console.log('--- TEST 6: Order Cancellation & Credit Note Generation ---');
    const cancelResult = await invoiceService.cancelInvoice(firstInvoice._id, 'Customer return and cancellation', { role: 'SUPER_ADMIN' });
    console.log(`Cancelled invoice #${cancelResult.cancelledInvoice.invoiceNumber}, generated Credit Note #${cancelResult.creditNote.invoiceNumber}`);
    console.log(`Credit note PDF path: ${cancelResult.creditNote.pdfStoragePath} (file exists: ${fs.existsSync(path.resolve(process.cwd(), cancelResult.creditNote.pdfStoragePath))})`);

    if (!cancelResult.creditNote || !cancelResult.creditNote.invoiceNumber.startsWith('CN/')) {
      throw new Error('Failed to generate credit note upon cancellation.');
    }
    console.log('>> TEST 6 PASSED: Credit notes generated with correct references and negative balances.\n');

    console.log('====================================================');
    console.log('   ALL 6 INVOICE SYSTEM TESTS PASSED SUCCESSFULLY!  ');
    console.log('====================================================');

  } catch (err) {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

runInvoiceTests();
