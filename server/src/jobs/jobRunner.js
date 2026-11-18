import { runSubscriptionExpiryJob } from './subscriptionExpiryJob.js';
import { runFailedSettlementJob } from './failedSettlementJob.js';
import { runMarketplacePayoutEligibilityJob } from './marketplacePayoutEligibilityJob.js';

let isSubscriptionExpiryRunning = false;
let isFailedSettlementRunning = false;
let isPayoutEligibilityRunning = false;

export const startJobs = () => {
  console.log('Initializing scheduled background jobs...');

  // Run 7-day marketplace payout eligibility check immediately on boot, then every 30 minutes
  setTimeout(async () => {
    try {
      await runMarketplacePayoutEligibilityJob();
    } catch (e) {
      console.error('[7-Day Payout Job Boot Error]:', e);
    }
  }, 10000);

  setInterval(async () => {
    if (isPayoutEligibilityRunning) return;
    isPayoutEligibilityRunning = true;
    try {
      await runMarketplacePayoutEligibilityJob();
    } finally {
      isPayoutEligibilityRunning = false;
    }
  }, 30 * 60 * 1000);

  // Run subscription expiry sync every 12 hours
  setInterval(async () => {
    if (isSubscriptionExpiryRunning) {
      console.log('Subscription expiry job is already running. Skipping.');
      return;
    }
    isSubscriptionExpiryRunning = true;
    try {
      await runSubscriptionExpiryJob();
    } finally {
      isSubscriptionExpiryRunning = false;
    }
  }, 12 * 60 * 60 * 1000);

  // Run failed settlement monitor every 12 hours
  setInterval(async () => {
    if (isFailedSettlementRunning) {
      console.log('Failed settlement job is already running. Skipping.');
      return;
    }
    isFailedSettlementRunning = true;
    try {
      await runFailedSettlementJob();
    } finally {
      isFailedSettlementRunning = false;
    }
  }, 12 * 60 * 60 * 1000);
};

// Immediate manual trigger for integration tests
export const triggerJobsManually = async () => {
  console.log('Triggering background jobs manually...');
  await runMarketplacePayoutEligibilityJob();
  await runSubscriptionExpiryJob();
  await runFailedSettlementJob();
};
export { runSubscriptionExpiryJob, runFailedSettlementJob, runMarketplacePayoutEligibilityJob };
