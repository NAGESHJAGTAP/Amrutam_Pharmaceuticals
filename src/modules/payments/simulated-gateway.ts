import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export interface WebhookEventPayload {
  eventId: string;
  eventType: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  timestamp: string;
  data: {
    paymentReference: string;
    providerReference: string;
    amount: number;
    currency: string;
    failureReason?: string;
    refundReason?: string;
  };
}

/**
 * Simulated Payment Provider for development and automated testing.
 * Implements HMAC-SHA256 signature generation and timing-safe verification.
 */
export class SimulatedPaymentGateway {
  /**
   * Computes HMAC-SHA256 signature for a webhook payload string.
   */
  public static generateSignature(payloadString: string, secret = env.PAYMENT_WEBHOOK_SECRET): string {
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  /**
   * Verifies an incoming signature using timing-safe comparison to prevent timing side-channel attacks.
   */
  public static verifySignature(
    payloadString: string,
    providedSignature: string | undefined,
    secret = env.PAYMENT_WEBHOOK_SECRET
  ): boolean {
    if (!providedSignature) return false;

    const expectedSignature = this.generateSignature(payloadString, secret);
    const providedBuffer = Buffer.from(providedSignature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  }

  /**
   * Constructs a standard signed simulated webhook payload.
   */
  public static createSimulatedEvent(
    eventType: 'payment.succeeded' | 'payment.failed' | 'payment.refunded',
    paymentReference: string,
    amount: number,
    currency = 'INR',
    extra?: { failureReason?: string; refundReason?: string; eventId?: string }
  ): { payload: WebhookEventPayload; signature: string } {
    const eventId = extra?.eventId || `evt_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const providerReference = `SIM-TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const payload: WebhookEventPayload = {
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
      data: {
        paymentReference,
        providerReference,
        amount,
        currency,
        failureReason: extra?.failureReason,
        refundReason: extra?.refundReason,
      },
    };

    const payloadString = JSON.stringify(payload);
    const signature = this.generateSignature(payloadString);

    return { payload, signature };
  }
}
