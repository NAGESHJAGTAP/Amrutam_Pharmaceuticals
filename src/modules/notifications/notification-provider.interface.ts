import { NotificationJobPayload } from './notification.types.js';

export interface NotificationDeliveryResult {
  success: boolean;
  messageId: string;
  deliveredAt: Date;
  channel: string;
}

/**
 * Pluggable notification provider contract (SMS, Email, Push).
 */
export interface INotificationProvider {
  send(payload: NotificationJobPayload): Promise<NotificationDeliveryResult>;
}
