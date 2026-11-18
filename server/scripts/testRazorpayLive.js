import 'dotenv/config';
import Razorpay from 'razorpay';

async function testRazorpay() {
  console.log('Testing Razorpay Credentials...');
  console.log('Key ID:', process.env.RAZORPAY_KEY_ID);

  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await rzp.orders.create({
      amount: 50000, // 500.00 INR
      currency: 'INR',
      receipt: `test_${Date.now()}`,
      notes: { test: 'FairKart Live Test' }
    });
    console.log('✅ SUCCESS! Razorpay Order Created:');
    console.log({
      orderId: order.id,
      amount: order.amount / 100 + ' INR',
      currency: order.currency,
      status: order.status,
    });
  } catch (err) {
    console.error('❌ Razorpay Error:', err);
  }
}

testRazorpay();
