import 'dotenv/config';
import shiprocketProvider from '../src/services/courier/shiprocketProvider.js';
import { srGet, srPost } from '../src/services/courier/shiprocketClient.js';

async function testPickup() {
  console.log('Testing list pickup locations...');
  try {
    const list = await shiprocketProvider.listPickupLocations();
    console.log('List pickup locations success:', list);
  } catch (e) {
    console.error('List pickup locations error:', e.message);
  }

  console.log('\nTesting add pickup location...');
  try {
    const res = await shiprocketProvider.addPickupLocation({
      pickupLocationName: 'JayShree_Warehouse',
      name: 'Deeksha',
      email: 'deekshasekar19@gmail.com',
      phone: '7639723438',
      address: '6/2818-9A Mahalakshmi Nagar',
      address2: 'Kovilpatti',
      city: 'Kovilpatti',
      state: 'Tamil Nadu',
      country: 'India',
      pinCode: '628502',
    });
    console.log('Add pickup location success:', res);
  } catch (e) {
    console.error('Add pickup location error:', e.message);
    if (e.response) {
      console.error('Response data:', e.response.data);
    }
  }
}

testPickup();

