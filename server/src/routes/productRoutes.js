import express from 'express';
import {
  getProducts,
  getProductBySlug,
  getFeaturedProducts,
  getNewArrivals,
  getBestSelling,
  getTopRated,
  getHomeShowcase,
} from '../controllers/productController.js';

import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { createVendorProduct } from '../controllers/vendorController.js';

const router = express.Router();

router.get('/home-showcase', getHomeShowcase);
router.get('/', getProducts);
router.post('/', authenticate, authorize('VENDOR', 'ADMIN', 'SUPER_ADMIN'), createVendorProduct);
router.get('/featured', getFeaturedProducts);
router.get('/new-arrivals', getNewArrivals);
router.get('/best-selling', getBestSelling);
router.get('/top-rated', getTopRated);
router.get('/:slug', getProductBySlug);

export default router;
