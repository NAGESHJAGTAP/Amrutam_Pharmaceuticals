import crypto from 'node:crypto';
import { INotificationProvider, NotificationDeliveryResult } from './notification-provider.interface.js';
import { NotificationJobPayload } from './notification.types.js';
import { logger } from '../../common/logging/logger.js';

/**
 * Local development and testing notification provider.
 * Safely simulates delivery without sending real external emails or SMS.
 * Records safe metadata and ensures zero leakage of PHI, passwords, or tokens.
 */
export class MockNotificationProvider implements INotificationProvider {
  private delivered: Array<NotificationJobPayload & { messageId: string; deliveredAt: Date }> = [];

  public async send(payload: NotificationJobPayload): Promise<NotificationDeliveryResult> {
    const messageId = `mock_msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const deliveredAt = new Date();

    // Mask recipient email for safe structured logging
    const maskedEmail = payload.recipientEmail
      ? payload.recipientEmail.replace(/^(.)(.*)(@.*)$/, (_, a, _b, c) => `${a}***${c}`)
      : undefined;

    logger.info(
      {
        channel: payload.channel,
        eventType: payload.eventType,
        recipientId: payload.recipientId,
        recipientEmail: maskedEmail,
        subject: payload.subject,
        messageId,
      },
      'Simulated notification dispatched successfully'
    );

    this.delivered.push({
      ...payload,
      messageId,
      deliveredAt,
    });

    return {
      success: true,
      messageId,
      deliveredAt,
      channel: payload.channel,
    };
  }

  /**
   * Returns list of delivered notifications for testing verification.
   */
  public getDelivered() {
    return [...this.delivered];
  }

  /**
   * Clears delivery history between test runs.
   */
  public clear() {
    this.delivered = [];
  }
}

export const mockNotificationProvider = new MockNotificationProvider();
