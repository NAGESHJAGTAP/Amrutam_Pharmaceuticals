import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service.js';
import { SimulatedPaymentGateway } from './simulated-gateway.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';

export class PaymentController {
  /**
   * Handles incoming webhook notifications from the payment provider.
   * Verifies HMAC signature, deduplicates event IDs, and transitions payment state.
   */
  public handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature =
        (req.headers['x-amrutam-signature'] as string) ||
        (req.headers['x-webhook-signature'] as string);

      const rawPayload = JSON.stringify(req.body);
      const isValid = SimulatedPaymentGateway.verifySignature(rawPayload, signature);

      if (!isValid) {
        throw new UnauthorizedError('Invalid webhook signature');
      }

      const result = await paymentService.processWebhookEvent(req.body, req.correlationId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper endpoint for development and testing to simulate payment provider webhook events.
   */
  public simulateWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { paymentReference, eventType, failureReason, refundReason } = req.body;

      const { payload, signature } = SimulatedPaymentGateway.createSimulatedEvent(
        eventType,
        paymentReference,
        600.0,
        'INR',
        { failureReason, refundReason }
      );

      // Verify the generated signature as a sanity check
      const isValid = SimulatedPaymentGateway.verifySignature(JSON.stringify(payload), signature);
      if (!isValid) {
        throw new UnauthorizedError('Simulated signature verification failed');
      }

      const result = await paymentService.processWebhookEvent(payload, req.correlationId);

      res.status(200).json({
        success: true,
        message: 'Simulated webhook processed successfully',
        data: {
          simulatedEvent: payload,
          signature,
          result,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPaymentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentId = req.params.paymentId as string;
      const actorUserId = req.user!.sub;
      const actorRole = req.user!.role;

      const payment = await paymentService.getPaymentById(paymentId, actorUserId, actorRole);

      res.status(200).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPaymentByConsultation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const consultationId = req.params.consultationId as string;
      const actorUserId = req.user!.sub;
      const actorRole = req.user!.role;

      const payment = await paymentService.getPaymentByConsultation(
        consultationId,
        actorUserId,
        actorRole
      );

      res.status(200).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const paymentController = new PaymentController();
