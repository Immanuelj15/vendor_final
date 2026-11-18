import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Order } from '../src/models/Order.js';
import { Product } from '../src/models/Product.js';
import { Cart } from '../src/models/Cart.js';
import { CoinTransaction } from '../src/models/CoinTransaction.js';
import { fairCoinService } from '../src/services/fairCoinService.js';
import { authService } from '../src/services/authService.js';
import { orderService } from '../src/services/orderService.js';
import { returnService } from '../src/services/returnService.js';
import { FAIR_COIN_CONVERSION } from '../src/constants/coinConstants.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fairkart';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('BAAPOO MART: FAIR COINS 14 SCENARIOS COMPREHENSIVE TEST SUITE');
  console.log('================================================================');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB at', uri);

  // Setup test products
  let testProduct1 = await Product.findOne({ isDeleted: false, status: { $in: ['APPROVED', 'ACTIVE'] }, stock: { $gte: 10 } });
  if (!testProduct1) {
    testProduct1 = await Product.create({
      name: 'Organic Honey 500g',
      slug: `organic-honey-${Date.now()}`,
      price: 250,
      mrp: 300,
      stock: 50,
      status: 'APPROVED',
      isDeleted: false,
    });
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 1: New customer registers and receives exactly 500 coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 1: New customer registers & receives 500 coins ---');
  const uniqueEmail = `test_customer_${Date.now()}@baapoomart.dev`;
  const registerResult = await authService.register({
    name: 'New Test Customer',
    email: uniqueEmail,
    password: 'Password@123',
    role: 'CUSTOMER',
    termsAccepted: true,
  });
  const customer1 = registerResult.user;

  const userAfterReg = await User.findById(customer1._id);
  assert(userAfterReg.fairCoinBalance === 500, `Customer registered and balance is 500 (actual: ${userAfterReg.fairCoinBalance})`);
  assert(userAfterReg.welcomeCoinsAwarded === true, `welcomeCoinsAwarded is true`);

  const welcomeTx = await CoinTransaction.findOne({ userId: customer1._id, type: 'WELCOME' });
  assert(welcomeTx !== null, `WELCOME CoinTransaction exists in ledger`);
  assert(welcomeTx.amount === 500, `WELCOME transaction amount is 500`);
  assert(welcomeTx.rupeeEquivalent === 50, `WELCOME rupee equivalent is ₹50 (at 10 coins = ₹1)`);

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Existing customer does not receive duplicate welcome coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: Existing customer does not receive duplicate welcome coins ---');
  const initialBal = userAfterReg.fairCoinBalance;
  // Attempt to credit welcome reward again
  const duplicateWelcomeTx = await fairCoinService.creditWelcomeReward(customer1._id);
  assert(duplicateWelcomeTx === null, `creditWelcomeReward returned null on second attempt`);

  const userAfterDupeAttempt = await User.findById(customer1._id);
  assert(userAfterDupeAttempt.fairCoinBalance === initialBal, `Balance remained exactly ${initialBal} (no duplicate credit)`);

  const allWelcomeTxs = await CoinTransaction.find({ userId: customer1._id, type: 'WELCOME' });
  assert(allWelcomeTxs.length === 1, `Exactly 1 WELCOME transaction exists in the ledger`);

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Customer buys 1 eligible product and receives 100 coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 3: Customer buys 1 eligible product & receives 100 coins ---');
  const balBeforeBuy1 = userAfterDupeAttempt.fairCoinBalance;
  const orderItems1 = [{ productId: testProduct1._id, quantity: 1, price: testProduct1.price }];
  const orderId1 = new mongoose.Types.ObjectId();
  const orderNum1 = `ORD-TEST-1001-${Date.now()}`;

  const rewardTx1 = await fairCoinService.processPurchaseReward(customer1._id, orderId1, orderNum1, orderItems1);
  assert(rewardTx1 !== null, `Purchase reward transaction created for 1 item`);
  assert(rewardTx1.amount === 100, `Reward amount is 100 coins (1 item * 100)`);
  assert(rewardTx1.rupeeEquivalent === 10, `Reward rupee equivalent is ₹10`);

  const userAfterBuy1 = await User.findById(customer1._id);
  assert(userAfterBuy1.fairCoinBalance === balBeforeBuy1 + 100, `User balance increased by 100 (now ${userAfterBuy1.fairCoinBalance})`);

  // Prevent duplicate reward test
  const dupeRewardTx1 = await fairCoinService.processPurchaseReward(customer1._id, orderId1, orderNum1, orderItems1);
  assert(dupeRewardTx1._id.toString() === rewardTx1._id.toString(), `Repeated call returns same transaction (idempotent, no duplicate coins)`);

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Customer buys 3 eligible products and receives 300 coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 4: Customer buys 3 eligible products & receives 300 coins ---');
  const balBeforeBuy3 = userAfterBuy1.fairCoinBalance;
  const orderItems3 = [
    { productId: testProduct1._id, quantity: 2, price: testProduct1.price },
    { productId: testProduct1._id, quantity: 1, price: testProduct1.price },
  ]; // Total quantity = 3
  const orderId3 = new mongoose.Types.ObjectId();
  const orderNum3 = `ORD-TEST-1002-${Date.now()}`;

  const rewardTx3 = await fairCoinService.processPurchaseReward(customer1._id, orderId3, orderNum3, orderItems3);
  assert(rewardTx3.amount === 300, `Reward amount is 300 coins for 3 eligible units`);
  assert(rewardTx3.rupeeEquivalent === 30, `Reward rupee equivalent is ₹30`);

  const userAfterBuy3 = await User.findById(customer1._id);
  assert(userAfterBuy3.fairCoinBalance === balBeforeBuy3 + 300, `User balance increased by 300 (now ${userAfterBuy3.fairCoinBalance})`);

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Customer redeems 300 coins and receives a ₹30 discount.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 5: Customer redeems 300 coins & receives ₹30 discount ---');
  // Available balance is now 500 + 100 + 300 = 900 coins.
  const balBeforeRedeem = userAfterBuy3.fairCoinBalance;
  const coinsToRedeem = 300;
  const expectedRupeeDiscount = Math.floor(coinsToRedeem / FAIR_COIN_CONVERSION.COINS_PER_RUPEE); // 30
  assert(expectedRupeeDiscount === 30, `Rupee discount for 300 coins is ₹30`);

  // Online reservation during checkout
  await fairCoinService.reserveCoins({ userId: customer1._id, amount: coinsToRedeem });
  const userReserved = await User.findById(customer1._id);
  assert(userReserved.fairCoinReserved === 300, `fairCoinReserved is 300`);
  const walletMid = await fairCoinService.getOrCreateWallet(customer1._id);
  assert(walletMid.available === balBeforeRedeem - 300, `Available balance is reduced by reserved coins (available: ${walletMid.available})`);

  // Payment succeeds and commits redemption
  const orderIdRedeem = new mongoose.Types.ObjectId();
  const orderNumRedeem = `ORD-TEST-1003-${Date.now()}`;
  const redeemTx = await fairCoinService.commitRedemption({
    userId: customer1._id,
    amount: coinsToRedeem,
    orderId: orderIdRedeem,
    orderNumber: orderNumRedeem,
  });

  assert(redeemTx !== null, `commitRedemption created transaction`);
  assert(redeemTx.type === 'REDEEMED', `Transaction type is REDEEMED`);
  assert(redeemTx.amount === 300, `Redeemed coin amount is 300`);
  assert(redeemTx.rupeeEquivalent === 30, `Rupee equivalent discount is ₹30`);

  const userAfterRedeem = await User.findById(customer1._id);
  assert(userAfterRedeem.fairCoinBalance === balBeforeRedeem - 300, `fairCoinBalance permanently debited by 300 (now ${userAfterRedeem.fairCoinBalance})`);
  assert(userAfterRedeem.fairCoinReserved === 0, `fairCoinReserved reset to 0`);

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Customer with 100 coins attempts to redeem 200 coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 6: Customer with 100 coins attempts to redeem 200 coins ---');
  const poorCustomer = await User.create({
    name: 'Poor Customer',
    email: `poor_${Date.now()}@baapoomart.dev`,
    passwordHash: '$2a$10$hashedPasswordPlaceholderForTesting',
    role: 'CUSTOMER',
    fairCoinBalance: 100,
    fairCoinReserved: 0,
    welcomeCoinsAwarded: true,
  });

  let threwInsufficient = false;
  try {
    await fairCoinService.reserveCoins({ userId: poorCustomer._id, amount: 200 });
  } catch (err) {
    threwInsufficient = true;
    assert(err.message.includes('Cannot redeem 200 Fair Coins'), `Error message correctly reports insufficient balance: ${err.message}`);
  }
  assert(threwInsufficient === true, `Exception thrown when attempting to redeem 200 coins with 100 balance`);

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Customer attempts to redeem negative coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 7: Customer attempts to redeem negative coins ---');
  const resNegative = await fairCoinService.reserveCoins({ userId: poorCustomer._id, amount: -50 });
  assert(resNegative === null, `reserveCoins rejected negative coins (-50) safely returning null`);

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Customer payment fails after selecting coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 8: Customer payment fails after selecting coins ---');
  const balBeforeFail = userAfterRedeem.fairCoinBalance;
  // Reserve 150 coins for an order
  await fairCoinService.reserveCoins({ userId: customer1._id, amount: 150 });
  const userDuringFailOrder = await User.findById(customer1._id);
  assert(userDuringFailOrder.fairCoinReserved === 150, `150 coins reserved during order creation`);

  // Payment fails: release reservation
  await fairCoinService.releaseReservedCoins({ userId: customer1._id, amount: 150 });
  const userAfterFailRelease = await User.findById(customer1._id);
  assert(userAfterFailRelease.fairCoinReserved === 0, `Reserved coins released back to 0 on failure`);
  assert(userAfterFailRelease.fairCoinBalance === balBeforeFail, `fairCoinBalance remained completely intact (${balBeforeFail})`);

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Customer retries checkout after payment failure.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 9: Customer retries checkout after payment failure ---');
  const walletRetry = await fairCoinService.getOrCreateWallet(customer1._id);
  assert(walletRetry.available === balBeforeFail, `Full balance is immediately available for retry (${walletRetry.available} coins)`);
  // Successfully re-reserve and commit on retry
  await fairCoinService.reserveCoins({ userId: customer1._id, amount: 150 });
  const retryOrderNum = `ORD-RETRY-${Date.now()}`;
  await fairCoinService.commitRedemption({
    userId: customer1._id,
    amount: 150,
    orderNumber: retryOrderNum,
  });
  const userAfterRetry = await User.findById(customer1._id);
  assert(userAfterRetry.fairCoinBalance === balBeforeFail - 150, `Successful retry deducted 150 coins (now ${userAfterRetry.fairCoinBalance})`);

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Customer places two simultaneous orders using the same coin balance.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 10: Two simultaneous orders using same coin balance ---');
  // Customer currently has userAfterRetry.fairCoinBalance (e.g. 450 coins)
  const currentAvail = userAfterRetry.fairCoinBalance;
  // Order A attempts to reserve 300 coins, Order B attempts to reserve 300 coins simultaneously (total 600 > 450)
  const [resA, resB] = await Promise.allSettled([
    fairCoinService.reserveCoins({ userId: customer1._id, amount: 300 }),
    fairCoinService.reserveCoins({ userId: customer1._id, amount: 300 }),
  ]);

  const successCount = [resA, resB].filter((r) => r.status === 'fulfilled').length;
  const failureCount = [resA, resB].filter((r) => r.status === 'rejected').length;

  assert(successCount === 1, `Exactly 1 order succeeded in reserving coins`);
  assert(failureCount === 1, `Exactly 1 order was safely rejected due to concurrent balance lock`);
  // Clean up the 300 reserved coins
  await fairCoinService.releaseReservedCoins({ userId: customer1._id, amount: 300 });

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Customer cancels an order after earning coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 11: Customer cancels order after earning coins ---');
  const userBeforeCancelEarn = await User.findById(customer1._id);
  const balBeforeEarn = userBeforeCancelEarn.fairCoinBalance;
  const cancelOrderNum = `ORD-CANCEL-EARN-${Date.now()}`;
  const cancelOrderId = new mongoose.Types.ObjectId();

  // Earn 200 coins for 2 products
  await fairCoinService.processPurchaseReward(customer1._id, cancelOrderId, cancelOrderNum, [
    { productId: testProduct1._id, quantity: 2, price: 200 },
  ]);
  const userWithEarn = await User.findById(customer1._id);
  assert(userWithEarn.fairCoinBalance === balBeforeEarn + 200, `Earned 200 coins on order`);

  // Customer cancels the order: reverse the 200 coins
  const reversalTx = await fairCoinService.reversePurchaseReward({
    userId: customer1._id,
    orderId: cancelOrderId,
    orderNumber: cancelOrderNum,
  });

  assert(reversalTx !== null, `Reversal transaction recorded`);
  assert(reversalTx.type === 'REVERSED', `Transaction type is REVERSED`);
  assert(reversalTx.amount === 200, `Reversed amount is 200 coins`);

  const userAfterReversal = await User.findById(customer1._id);
  assert(userAfterReversal.fairCoinBalance === balBeforeEarn, `Balance correctly reverted back to ${balBeforeEarn}`);

  // Idempotent reversal test
  const dupeReversalTx = await fairCoinService.reversePurchaseReward({
    userId: customer1._id,
    orderId: cancelOrderId,
    orderNumber: cancelOrderNum,
  });
  assert(dupeReversalTx._id.toString() === reversalTx._id.toString(), `Reversal is idempotent, does not deduct coins twice`);

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Customer receives a refund after redeeming coins.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 12: Customer receives refund after redeeming coins ---');
  const balBeforeRedeemOrder = userAfterReversal.fairCoinBalance;
  const refundOrderNum = `ORD-REFUND-${Date.now()}`;
  const refundOrderId = new mongoose.Types.ObjectId();

  // Customer redeemed 200 coins for ₹20 discount
  await fairCoinService.commitRedemption({
    userId: customer1._id,
    amount: 200,
    orderId: refundOrderId,
    orderNumber: refundOrderNum,
  });

  const userAfterRedeemOrder = await User.findById(customer1._id);
  assert(userAfterRedeemOrder.fairCoinBalance === balBeforeRedeemOrder - 200, `Balance reduced by 200 coins`);

  // Order is cancelled/refunded: restore the 200 redeemed coins
  const refundCoinsTx = await fairCoinService.refundRedeemedCoins({
    userId: customer1._id,
    orderId: refundOrderId,
    orderNumber: refundOrderNum,
    amount: 200,
  });

  assert(refundCoinsTx !== null, `Refund coin transaction recorded`);
  assert(refundCoinsTx.type === 'REFUNDED', `Transaction type is REFUNDED`);
  assert(refundCoinsTx.amount === 200, `Restored amount is 200 coins`);

  const userAfterRefundCoins = await User.findById(customer1._id);
  assert(userAfterRefundCoins.fairCoinBalance === balBeforeRedeemOrder, `Balance completely restored to ${balBeforeRedeemOrder}`);

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Customer refreshes page and sees correct wallet balance.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 13: Customer refreshes page & sees correct wallet balance ---');
  const walletDynamic = await fairCoinService.getOrCreateWallet(customer1._id);
  const userDb = await User.findById(customer1._id);

  assert(walletDynamic.balance === userDb.fairCoinBalance, `Wallet balance (${walletDynamic.balance}) strictly equals database user balance (${userDb.fairCoinBalance})`);
  assert(walletDynamic.available === userDb.fairCoinBalance - (userDb.fairCoinReserved || 0), `Available balance correctly accounts for any reserved coins`);
  assert(walletDynamic.rupeeValue === Math.round((walletDynamic.balance / 10) * 100) / 100, `Rupee value accurately equals balance / 10`);
  assert(walletDynamic.totalEarned >= walletDynamic.balance, `Lifetime totalEarned is accurately aggregated`);
  assert(walletDynamic.totalRedeemed >= 0, `Lifetime totalRedeemed is accurately aggregated`);
  assert(walletDynamic.totalReversed >= 0, `Lifetime totalReversed is accurately aggregated`);

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Super Admin sees accurate Fair Coins totals & transaction history.
  // ---------------------------------------------------------------------------
  console.log('\n--- SCENARIO 14: Super Admin sees accurate totals & audit history ---');
  const analytics = await fairCoinService.getSuperAdminAnalytics();
  assert(analytics.totalCredited > 0, `Super Admin totalCredited is > 0 (${analytics.totalCredited})`);
  assert(analytics.totalRedeemed > 0, `Super Admin totalRedeemed is > 0 (${analytics.totalRedeemed})`);
  assert(analytics.totalReversed > 0, `Super Admin totalReversed is > 0 (${analytics.totalReversed})`);
  assert(analytics.totalOutstanding > 0, `Super Admin totalOutstanding is > 0 (${analytics.totalOutstanding})`);
  assert(analytics.conversionRate === 10, `Super Admin conversion rate is fixed at 10`);

  // Fetch Super Admin transactions and verify ledger consistency
  const adminTxData = await fairCoinService.getSuperAdminTransactions({ page: 1, limit: 10 });
  assert(adminTxData.transactions.length > 0, `Super Admin retrieved transaction history records`);
  assert(adminTxData.total >= adminTxData.transactions.length, `Super Admin total transactions accurate`);

  // Fetch Super Admin customer balances
  const adminCustData = await fairCoinService.getSuperAdminCustomers({ search: uniqueEmail });
  assert(adminCustData.customers.length === 1, `Super Admin found test customer by unique email in balance sheet`);
  assert(adminCustData.customers[0].balance === userDb.fairCoinBalance, `Super Admin customer balance matches user database balance`);

  console.log('\n================================================================');
  console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified!`);
  console.log('================================================================');

  await mongoose.disconnect();
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
