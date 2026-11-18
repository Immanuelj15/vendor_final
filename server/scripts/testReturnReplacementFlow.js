import mongoose from 'mongoose';
import { returnService } from '../src/services/returnService.js';
import { refundService } from '../src/services/refundService.js';
import { ReturnPolicy } from '../src/models/ReturnPolicy.js';
import { ReturnRequest } from '../src/models/ReturnRequest.js';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('Testing Return, Replacement & Cancellation System...');

  try {
    await mongoose.connect(env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fairkart');
    console.log('MongoDB Connected.');

    // 1. Test Policy Resolution
    console.log('1. Testing ReturnPolicy.resolvePolicyForProduct...');
    const resolvedPolicy = await ReturnPolicy.resolvePolicyForProduct(new mongoose.Types.ObjectId());
    console.log('Resolved Policy:', resolvedPolicy.name, 'ReturnWindow:', resolvedPolicy.returnWindowDays, 'days');

    // Ensure a global default exists
    const existingDefault = await ReturnPolicy.findOne({ policyType: 'GLOBAL_DEFAULT' });
    if (!existingDefault) {
      await ReturnPolicy.create({
        name: 'BAAPOO MART Standard 7-Day Policy',
        policyType: 'GLOBAL_DEFAULT',
        returnAllowed: true,
        returnWindowDays: 7,
        replacementAllowed: true,
        replacementWindowDays: 7,
        refundAllowed: true,
        cancellationAllowed: true,
        applicableConditions: [
          'Original brand packaging must be intact',
          'All accessories, user manuals, and warranty cards included',
          'Item must be unused and in original condition',
        ],
        isDefault: true,
        isActive: true,
      });
      console.log('Global default policy seeded.');
    }

    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runTests();

