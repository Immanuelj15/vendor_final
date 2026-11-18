import express from 'express';
import {
  getActiveCustomerPlans,
  getCustomerSubscription,
  checkoutCustomerSubscription,
  getCustomerSubscriptionHistory,
  downloadCustomerSubscriptionInvoice
} from '../controllers/subscriptionPlanController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public: view active subscription plans
router.get('/active', getActiveCustomerPlans);
router.get('/plans', getActiveCustomerPlans);

// Protected: customer subscription management
router.use(authenticate);

router.get('/', getCustomerSubscription);
router.post('/checkout', checkoutCustomerSubscription);
router.post('/subscribe', checkoutCustomerSubscription);
router.get('/history', getCustomerSubscriptionHistory);

// Download Customer Subscription Invoice PDF (with 18% GST breakdown)
router.get('/download-invoice/:subscriptionId', downloadCustomerSubscriptionInvoice);
router.get('/invoices/:id/pdf', downloadCustomerSubscriptionInvoice);
router.get('/:id/invoice/pdf', downloadCustomerSubscriptionInvoice);
router.get('/:id/invoice', downloadCustomerSubscriptionInvoice);

export default router;
