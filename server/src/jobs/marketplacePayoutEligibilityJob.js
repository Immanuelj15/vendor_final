import { marketplaceCommissionService } from '../services/marketplaceCommissionService.js';

export const runMarketplacePayoutEligibilityJob = async () => {
  try {
    console.log('[7-Day Payout Job] Checking for vendor payouts eligible for transition from HOLD to ELIGIBLE...');
    const result = await marketplaceCommissionService.processSevenDayEligibility(new Date());
    console.log(`[7-Day Payout Job] Completed. Processed: ${result.processedCount} payout(s) marked ELIGIBLE.`);
    return result;
  } catch (error) {
    console.error('[7-Day Payout Job] Error processing 7-day payout eligibility:', error);
    throw error;
  }
};
