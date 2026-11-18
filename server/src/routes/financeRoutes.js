import express from 'express';
import { 
  getAdminSettlements, 
  markSettlementPaid, 
  getVendorSettlements, 
  getVendorLedger 
} from '../controllers/financeController.js';
import { marketplacePayoutController } from '../controllers/marketplacePayoutController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Legacy Admin Routes
router.get('/admin/settlements', authorize('ADMIN', 'SUPER_ADMIN'), getAdminSettlements);
router.put('/admin/settlements/:id/pay', authorize('ADMIN', 'SUPER_ADMIN'), markSettlementPaid);

// Legacy Vendor Routes
router.get('/vendor/settlements', authorize('VENDOR'), getVendorSettlements);
router.get('/vendor/ledger', authorize('VENDOR'), getVendorLedger);

// Marketplace Commission & 7-Day Vendor Payout Management Routes
// Super Admin & Admin
router.get('/marketplace/metrics', authorize('ADMIN', 'SUPER_ADMIN'), marketplacePayoutController.getSuperAdminMetrics);
router.get('/marketplace/commissions', authorize('ADMIN', 'SUPER_ADMIN'), marketplacePayoutController.getCommissionTransactions);
router.get('/marketplace/payouts', authorize('ADMIN', 'SUPER_ADMIN'), marketplacePayoutController.getVendorPayouts);
router.post('/marketplace/payouts/:id/release', authorize('ADMIN', 'SUPER_ADMIN'), marketplacePayoutController.releaseVendorPayout);
router.put('/marketplace/commission-rate', authorize('SUPER_ADMIN'), marketplacePayoutController.updateCommissionRate);
router.post('/marketplace/trigger-eligibility', authorize('ADMIN', 'SUPER_ADMIN'), marketplacePayoutController.triggerEligibilityJob);

// Vendor Finance Dashboard
router.get('/marketplace/vendor/dashboard', authorize('VENDOR'), marketplacePayoutController.getVendorFinanceDashboard);

export default router;
