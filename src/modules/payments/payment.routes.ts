import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import {
  webhookEventSchema,
  simulateWebhookSchema,
  getPaymentByIdSchema,
  getPaymentByConsultationSchema,
} from './payment.schema.js';

const router = Router();

// Payment gateway webhook receiver (Signature verification enforced in controller)
router.post('/webhook', validate(webhookEventSchema), paymentController.handleWebhook);

// Development & testing simulated webhook trigger
router.post('/simulate-webhook', validate(simulateWebhookSchema), paymentController.simulateWebhook);

// Look up payment details by payment ID (Patient owner, Doctor, Admin)
router.get('/:paymentId', authenticate, validate(getPaymentByIdSchema), paymentController.getPaymentById);

// Look up payment details by consultation ID (Patient owner, Doctor, Admin)
router.get(
  '/consultation/:consultationId',
  authenticate,
  validate(getPaymentByConsultationSchema),
  paymentController.getPaymentByConsultation
);

export const paymentRoutes = router;
