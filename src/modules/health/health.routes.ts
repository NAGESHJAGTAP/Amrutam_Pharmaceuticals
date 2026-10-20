import { Router } from 'express';
import { healthController } from './health.controller.js';

const router = Router();

router.get('/healthz', healthController.getLiveness);
router.get('/readyz', healthController.getReadiness);
router.get('/metrics', healthController.getMetrics);

export const healthRoutes = router;

