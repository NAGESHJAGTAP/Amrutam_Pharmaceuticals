import { PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/app-error.js';
import { WebhookEventPayload } from './simulated-gateway.js';
import { logger } from '../../common/logging/logger.js';

export class PaymentService {
  /**
   * Processes incoming webhook events idempotently under PostgreSQL row locks.
   * State Machine:
   *   PENDING   -> COMPLETED (on payment.succeeded)
   *   PENDING   -> FAILED    (on payment.failed)
   *   COMPLETED -> REFUNDED  (on payment.refunded)
   * Duplicate event IDs are safely deduplicated via the database WebhookEvent table.
   */
  public async processWebhookEvent(payload: WebhookEventPayload, correlationId?: string) {
    const { eventId, eventType, data } = payload;
    const { paymentReference, providerReference } = data;

    // 1. Fast-path deduplication check
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      logger.info(
        { eventId, eventType, paymentReference },
        'Duplicate webhook event detected; returning cached success without side effects'
      );
      const payment = await prisma.payment.findUnique({
        where: { paymentReference },
      });
      return {
        duplicate: true,
        message: 'Webhook event already processed',
        payment: payment ? this.sanitizePayment(payment) : null,
      };
    }

    // 2. Interactive transactional update under row-level lock
    return await prisma.$transaction(
      async (tx) => {
        // Double-check inside transaction to eliminate race conditions
        const inTxExisting = await tx.webhookEvent.findUnique({
          where: { eventId },
        });
        if (inTxExisting) {
          const payment = await tx.payment.findUnique({
            where: { paymentReference },
          });
          return {
            duplicate: true,
            message: 'Webhook event already processed',
            payment: payment ? this.sanitizePayment(payment) : null,
          };
        }

        // Row-level lock on Payment record
        const lockedPayments: any[] = await tx.$queryRaw`
          SELECT * FROM "payments"
          WHERE "paymentReference" = ${paymentReference}
          FOR UPDATE;
        `;

        if (!lockedPayments || lockedPayments.length === 0) {
          throw new NotFoundError(`Payment with reference ${paymentReference}`);
        }

        const currentPayment = lockedPayments[0];
        const currentStatus = currentPayment.status as PaymentStatus;
        let newStatus: PaymentStatus;

        switch (eventType) {
          case 'payment.succeeded': {
            if (currentStatus === PaymentStatus.COMPLETED) {
              // Idempotent hit: already in target state
              newStatus = PaymentStatus.COMPLETED;
            } else if (currentStatus === PaymentStatus.PENDING) {
              newStatus = PaymentStatus.COMPLETED;
            } else {
              throw new ConflictError(
                `Invalid payment state transition: cannot mark a ${currentStatus} payment as COMPLETED`
              );
            }
            break;
          }

          case 'payment.failed': {
            if (currentStatus === PaymentStatus.FAILED) {
              newStatus = PaymentStatus.FAILED;
            } else if (currentStatus === PaymentStatus.PENDING) {
              newStatus = PaymentStatus.FAILED;
            } else {
              throw new ConflictError(
                `Invalid payment state transition: cannot mark a ${currentStatus} payment as FAILED`
              );
            }
            break;
          }

          case 'payment.refunded': {
            if (currentStatus === PaymentStatus.REFUNDED) {
              newStatus = PaymentStatus.REFUNDED;
            } else if (currentStatus === PaymentStatus.COMPLETED) {
              newStatus = PaymentStatus.REFUNDED;
            } else {
              throw new ConflictError(
                `Invalid payment state transition: cannot refund a payment in ${currentStatus} state. Only COMPLETED payments can be refunded.`
              );
            }
            break;
          }

          default:
            throw new BadRequestError(`Unsupported webhook event type: ${eventType}`);
        }

        // Apply state transition
        const updatedPayment = await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            status: newStatus,
            ...(providerReference && { providerReference }),
            rawResponse: payload as any,
          },
        });

        // Persist processed event to prevent future duplicate processing
        await tx.webhookEvent.create({
          data: {
            eventId,
            provider: currentPayment.provider,
            eventType,
            payload: payload as any,
          },
        });

        // Audit Logging
        await tx.auditLog.create({
          data: {
            action: `PAYMENT_${newStatus}`,
            entityType: 'Payment',
            entityId: currentPayment.id,
            details: {
              paymentReference,
              previousStatus: currentStatus,
              newStatus,
              eventId,
              eventType,
            },
            correlationId,
          },
        });

        // Transactional Outbox Event
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Payment',
            aggregateId: currentPayment.id,
            eventType,
            payload: {
              paymentId: currentPayment.id,
              paymentReference,
              amount: Number(currentPayment.amount),
              currency: currentPayment.currency,
              status: newStatus,
            },
            status: 'PENDING',
          },
        });

        logger.info(
          {
            paymentId: currentPayment.id,
            paymentReference,
            previousStatus: currentStatus,
            newStatus,
            eventId,
          },
          'Payment state transitioned successfully under row lock'
        );

        return {
          duplicate: false,
          message: `Payment transitioned to ${newStatus}`,
          payment: this.sanitizePayment(updatedPayment),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      }
    );
  }

  /**
   * Retrieves payment details by ID with strict access control.
   */
  public async getPaymentById(paymentId: string, actorUserId: string, actorRole: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        consultation: {
          include: {
            doctor: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    const isPatient = payment.consultation.patientId === actorUserId;
    const isDoctor = payment.consultation.doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this payment');
    }

    return this.sanitizePayment(payment);
  }

  /**
   * Retrieves payment details for a specific consultation.
   */
  public async getPaymentByConsultation(
    consultationId: string,
    actorUserId: string,
    actorRole: string
  ) {
    const payment = await prisma.payment.findUnique({
      where: { consultationId },
      include: {
        consultation: {
          include: {
            doctor: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment for this consultation');
    }

    const isPatient = payment.consultation.patientId === actorUserId;
    const isDoctor = payment.consultation.doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this payment');
    }

    return this.sanitizePayment(payment);
  }

  /**
   * Sanitizes payment object to prevent sensitive internal gateway details or secrets from leaking.
   */
  public sanitizePayment(payment: any) {
    return {
      id: payment.id,
      consultationId: payment.consultationId,
      paymentReference: payment.paymentReference,
      providerReference: payment.providerReference || null,
      provider: payment.provider,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

export const paymentService = new PaymentService();
