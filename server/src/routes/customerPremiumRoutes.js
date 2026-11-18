import express from 'express';
import { getPlans, subscribe, verifyPayment, getStatus, getHistory, downloadInvoice } from '../controllers/customerPremiumController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public / Guest can view plans
router.get('/plans', getPlans);

router.use(authenticate);

router.post('/subscribe', subscribe);
router.post('/verify-payment', verifyPayment);
router.get('/', getStatus);
router.get('/history', getHistory);

// PDF Invoice downloads
router.get('/download-invoice/:subscriptionId', downloadInvoice);
router.get('/invoices/:id/pdf', downloadInvoice);
router.get('/:id/invoice/pdf', downloadInvoice);
router.get('/:id/invoice', downloadInvoice);

export default router;

