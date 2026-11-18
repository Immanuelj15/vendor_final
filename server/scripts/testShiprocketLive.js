import 'dotenv/config';
import shiprocketClient from '../src/services/courier/shiprocketClient.js';
import shiprocketProvider from '../src/services/courier/shiprocketProvider.js';

async function main() {
  console.log('Testing Shiprocket Live Connection...');
  console.log('Email configured:', process.env.SHIPROCKET_EMAIL || 'none');
  
  try {
    const conn = await shiprocketClient.testConnection();
    console.log('Connection Test Result:', JSON.stringify(conn, null, 2));

    if (conn.authenticated) {
      console.log('\n--- Testing Pickup Locations Listing ---');
      const pickups = await shiprocketProvider.listPickupLocations();
      console.log('Registered Pickups count:', pickups.length);
      console.log('Pickups:', JSON.stringify(pickups.slice(0, 3), null, 2));

      console.log('\n--- Testing Real Courier Serviceability ---');
      const s = await shiprocketProvider.getServiceability('110020', '560103', 0.5, 0);
      console.log('Serviceability result:', JSON.stringify({
        serviceable: s.serviceable,
        couriersCount: s.availableCouriers?.length,
        topCourier: s.recommendedCourier
      }, null, 2));
    }
  } catch (err) {
    console.error('Test error:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  }
}

main();

