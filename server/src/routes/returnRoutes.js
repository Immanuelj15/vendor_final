import express from 'express';
import {
  checkEligibility,
  submitRequest,
  getMyRequests,
  getVendorRequests,
  vendorApprove,
  vendorReject,
  updateInspection,
  getAdminRequests,
  adminOverride,
  adminProcessRefund,
  getRequestById,
  cancelOrder,
  requestReturn,
  updateReturnStatus,
} from '../controllers/returnController.js';
import { returnPolicyController } from '../controllers/returnPolicyController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticate);

// ── Customer Endpoints ─────────────────────────────────────────────────────
router.get('/eligibility/:orderId', checkEligibility);
router.post('/request', submitRequest);
router.get('/my', getMyRequests);
router.get('/my-requests', getMyRequests);

// ── Return Policy Management ───────────────────────────────────────────────
router.get('/policies', returnPolicyController.getPolicies);
router.get('/policies/:id', returnPolicyController.getPolicyById);
router.post('/policies', authorize('ADMIN', 'SUPER_ADMIN'), returnPolicyController.createPolicy);
router.put('/policies/:id', authorize('ADMIN', 'SUPER_ADMIN'), returnPolicyController.updatePolicy);
router.delete('/policies/:id', authorize('ADMIN', 'SUPER_ADMIN'), returnPolicyController.deletePolicy);

// ── Vendor Actions ─────────────────────────────────────────────────────────
router.get('/vendor', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), getVendorRequests);
router.post('/vendor/:id/approve', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), vendorApprove);
router.post('/vendor/:id/reject', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), vendorReject);
router.post('/vendor/:id/inspection', authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), updateInspection);

// ── Super Admin Actions ────────────────────────────────────────────────────
router.get('/admin', authorize('ADMIN', 'SUPER_ADMIN'), getAdminRequests);
router.post('/admin/:id/override', authorize('ADMIN', 'SUPER_ADMIN'), adminOverride);
router.post('/admin/:id/refund', authorize('ADMIN', 'SUPER_ADMIN'), adminProcessRefund);
router.put('/admin/:id/status', authorize('ADMIN', 'SUPER_ADMIN'), updateReturnStatus);

// ── Legacy Routes ──────────────────────────────────────────────────────────
router.post('/orders/:id/cancel', cancelOrder);
router.post('/orders/:id/return', requestReturn);

// Single item lookup
router.get('/:id', getRequestById);

export default router;
