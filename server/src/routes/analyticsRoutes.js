import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analyticsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Protect analytics routes with JWT auth
router.use(authMiddleware);

// Student dashboard KPI metrics
router.get('/dashboard', getDashboardAnalytics);

export default router;
