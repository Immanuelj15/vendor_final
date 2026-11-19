/**
 * Live test script for Delhivery integration
 * Tests connectivity, pincode serviceability, waybill retrieval, and tracking
 */

import { testConnection } from '../src/services/courier/delhiveryClient.js';
import { delhiveryProvider } from '../src/services/courier/delhiveryProvider.js';

async function runLiveDelhiveryTests() {
  console.log('====================================================');
  console.log('🚚 DELHIVERY LIVE PRODUCTION INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  // 1. Connection & Token Verification Test
  total++;
  console.log('1. Testing Delhivery API Connection & Token Validity...');
  try {
    const conn = await testConnection();
    console.log('   Result:', conn);
    if (conn.connected && conn.authenticated) {
      console.log('   ✅ PASS: Delhivery API token successfully authenticated!');
      passed++;
    } else {
      console.error('   ❌ FAIL: Connection returned unauthenticated:', conn.error);
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error during connection test:', err.message);
  }

  // 2. Serviceability Check Test (Delhi PIN 110001 -> Chennai PIN 600001)
  total++;
  console.log('\n2. Testing Delhivery Pincode Serviceability (110001 -> 600001)...');
  try {
    const serv = await delhiveryProvider.getServiceability('110001', '600001', 0.5, 0);
    console.log(`   Serviceable: ${serv.serviceable}`);
    console.log(`   Available Services: ${serv.availableCouriers?.length || 0}`);
    if (serv.availableCouriers?.length > 0) {
      serv.availableCouriers.forEach((c) => {
        console.log(`     - ${c.name}: Rate ₹${c.rate}, ETD: ${c.estimatedDelivery}, COD: ${c.cod}`);
      });
    }
    if (serv.serviceable) {
      console.log('   ✅ PASS: Pincode serviceability successfully retrieved from Delhivery!');
      passed++;
    } else {
      console.error('   ❌ FAIL: Pincode serviceability returned false:', serv.message);
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error checking serviceability:', err.message);
  }

  // 3. Waybill Generation Test
  total++;
  console.log('\n3. Testing Official Delhivery Waybill Generation...');
  try {
    const waybill = await delhiveryProvider.fetchWaybill();
    console.log(`   Generated Delhivery Waybill: ${waybill}`);
    if (waybill) {
      console.log('   ✅ PASS: Waybill generated successfully!');
      passed++;
    } else {
      console.error('   ❌ FAIL: Empty waybill returned');
    }
  } catch (err) {
    console.error('   ❌ FAIL: Error generating waybill:', err.message);
  }

  // 4. Tracking Endpoint Test
  total++;
  console.log('\n4. Testing Delhivery Package Tracking API...');
  try {
    const tracking = await delhiveryProvider.trackByAWB('75642010000011');
    console.log(`   Tracking AWB: ${tracking.awb}`);
    console.log(`   Status: ${tracking.currentStatus}`);
    console.log(`   Events Count: ${tracking.events?.length || 0}`);
    if (tracking.awb) {
      console.log('   ✅ PASS: Tracking API handled successfully!');
      passed++;
    } else {
      console.error('   ❌ FAIL: Tracking returned invalid payload');
    }
  } catch (err) {
    console.error('   ❌ FAIL: Tracking error:', err.message);
  }

  // 5. Shipping Label URL Test
  total++;
  console.log('\n5. Testing Packing Slip / Shipping Label Generation...');
  try {
    const label = await delhiveryProvider.generateLabel('75642010000011');
    console.log(`   Label URL: ${label.labelUrl}`);
    if (label.labelUrl && label.labelUrl.includes('delhivery.com')) {
      console.log('   ✅ PASS: Packing slip URL generated successfully!');
      passed++;
    } else {
      console.error('   ❌ FAIL: Invalid label URL');
    }
  } catch (err) {
    console.error('   ❌ FAIL: Label generation error:', err.message);
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================');
  process.exit(passed === total ? 0 : 1);
}

runLiveDelhiveryTests();
