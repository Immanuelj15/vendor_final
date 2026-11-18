import express from 'express';
import { vendorSubscriptionInvoiceController } from '../controllers/vendorSubscriptionInvoiceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Super Admin analytics & listing
router.get(
  '/admin/stats',
  authorize('ADMIN', 'SUPER_ADMIN'),
  vendorSubscriptionInvoiceController.getAdminSubscriptionInvoiceStats
);

router.get(
  '/admin/all',
  authorize('ADMIN', 'SUPER_ADMIN'),
  vendorSubscriptionInvoiceController.getAdminSubscriptionInvoices
);

// Vendor: View own subscription invoices
router.get(
  '/my-invoices',
  authorize('VENDOR'),
  vendorSubscriptionInvoiceController.getMySubscriptionInvoices
);

// Stream / Download PDF (Protected: Vendor owner or Admin)
router.get('/:id/pdf', vendorSubscriptionInvoiceController.downloadSubscriptionInvoicePdf);

// Single Invoice details
router.get('/:id', vendorSubscriptionInvoiceController.getSubscriptionInvoiceById);

export default router;

