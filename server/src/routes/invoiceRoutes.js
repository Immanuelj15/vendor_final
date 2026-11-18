import express from 'express';
import {
  getOrderInvoices,
  getInvoiceDetail,
  downloadInvoicePdf,
  getVendorInvoices,
  getAdminInvoices,
  getAdminInvoiceStats,
  cancelInvoice,
} from '../controllers/invoiceController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

// ─── Customer & Shared Invoices ───────────────────────────────────────────────
router.get('/order/:orderId', getOrderInvoices);
router.get('/:id/pdf', downloadInvoicePdf);
router.get('/:id/download', downloadInvoicePdf);
router.get('/:id', getInvoiceDetail);

// ─── Vendor Invoices ──────────────────────────────────────────────────────────
router.get('/vendor/my-invoices', authorize('VENDOR'), getVendorInvoices);

// ─── Super Admin Invoices ─────────────────────────────────────────────────────
router.get('/admin/stats', authorize('SUPER_ADMIN'), getAdminInvoiceStats);
router.get('/admin/all', authorize('SUPER_ADMIN'), getAdminInvoices);
router.post('/:id/cancel', authorize('SUPER_ADMIN'), cancelInvoice);

export default router;

