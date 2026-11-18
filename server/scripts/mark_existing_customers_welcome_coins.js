import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fairkart';

async function migrate() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB at', uri);

  // Mark all existing users as welcomeCoinsAwarded: true so they will never receive duplicate welcome coins
  const result = await User.updateMany(
    { welcomeCoinsAwarded: { $ne: true } },
    { $set: { welcomeCoinsAwarded: true, fairCoinReserved: 0 } }
  );

  console.log(`Updated ${result.modifiedCount} existing users with welcomeCoinsAwarded: true`);

  const users = await User.find({ role: 'CUSTOMER' }).select('name email fairCoinBalance fairCoinReserved welcomeCoinsAwarded');
  console.log('Customers count in database:', users.length);

  await mongoose.disconnect();
}

migrate().catch(console.error);
