import { INotificationProvider } from './notification-provider.interface.js';
import { mockNotificationProvider } from './mock-notification.provider.js';
import { NotificationJobPayload } from './notification.types.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../common/logging/logger.js';

export class NotificationService {
  private provider: INotificationProvider;

  constructor(provider: INotificationProvider = mockNotificationProvider) {
    this.provider = provider;
  }

  /**
   * Sets the active notification provider (useful for switching to real SMS/Email providers).
   */
  public setProvider(provider: INotificationProvider) {
    this.provider = provider;
  }

  public getProvider(): INotificationProvider {
    return this.provider;
  }

  /**
   * Dispatches a validated notification payload through the active provider.
   */
  public async dispatchNotification(payload: NotificationJobPayload) {
    logger.debug({ eventType: payload.eventType, recipientId: payload.recipientId }, 'Dispatching notification');
    return await this.provider.send(payload);
  }

  /**
   * Formats and constructs safe notification payloads for consultation booking.
   */
  public async buildBookingNotifications(consultationId: string, eventId: string): Promise<NotificationJobPayload[]> {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { user: { include: { profile: true } } } },
      },
    });

    if (!consultation) return [];

    const patientName = consultation.patient.profile
      ? `${consultation.patient.profile.firstName} ${consultation.patient.profile.lastName}`
      : 'Patient';
    const doctorName = consultation.doctor.user.profile
      ? `Dr. ${consultation.doctor.user.profile.firstName} ${consultation.doctor.user.profile.lastName}`
      : 'Dr. Practitioner';

    const formattedTime = new Date(consultation.startTime).toUTCString();

    return [
      // Notification to Patient
      {
        eventId,
        eventType: 'consultation.booked',
        recipientId: consultation.patientId,
        recipientEmail: consultation.patient.email,
        recipientPhone: consultation.patient.phone || undefined,
        recipientName: patientName,
        channel: 'EMAIL',
        subject: `Consultation Confirmed: ${doctorName}`,
        message: `Hello ${patientName}, your consultation appointment with ${doctorName} has been confirmed for ${formattedTime}. Consultation Number: ${consultation.consultationNumber}.`,
      },
      // Notification to Doctor
      {
        eventId,
        eventType: 'consultation.booked',
        recipientId: consultation.doctor.userId,
        recipientEmail: consultation.doctor.user.email,
        recipientPhone: consultation.doctor.user.phone || undefined,
        recipientName: doctorName,
        channel: 'EMAIL',
        subject: `New Consultation Booked: ${patientName}`,
        message: `Hello ${doctorName}, you have a new appointment with patient ${patientName} on ${formattedTime}.`,
      },
    ];
  }

  /**
   * Formats safe notification payloads for consultation cancellation.
   */
  public async buildCancellationNotifications(
    consultationId: string,
    eventId: string,
    reason?: string
  ): Promise<NotificationJobPayload[]> {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { user: { include: { profile: true } } } },
      },
    });

    if (!consultation) return [];

    const patientName = consultation.patient.profile
      ? `${consultation.patient.profile.firstName} ${consultation.patient.profile.lastName}`
      : 'Patient';
    const doctorName = consultation.doctor.user.profile
      ? `Dr. ${consultation.doctor.user.profile.firstName} ${consultation.doctor.user.profile.lastName}`
      : 'Dr. Practitioner';

    const reasonText = reason ? ` Reason: ${reason}.` : '';

    return [
      {
        eventId,
        eventType: 'consultation.cancelled',
        recipientId: consultation.patientId,
        recipientEmail: consultation.patient.email,
        recipientPhone: consultation.patient.phone || undefined,
        recipientName: patientName,
        channel: 'EMAIL',
        subject: `Consultation Cancelled (${consultation.consultationNumber})`,
        message: `Hello ${patientName}, your consultation (${consultation.consultationNumber}) with ${doctorName} has been cancelled.${reasonText}`,
      },
      {
        eventId,
        eventType: 'consultation.cancelled',
        recipientId: consultation.doctor.userId,
        recipientEmail: consultation.doctor.user.email,
        recipientPhone: consultation.doctor.user.phone || undefined,
        recipientName: doctorName,
        channel: 'EMAIL',
        subject: `Consultation Cancelled (${consultation.consultationNumber})`,
        message: `Hello ${doctorName}, appointment (${consultation.consultationNumber}) with ${patientName} has been cancelled.${reasonText}`,
      },
    ];
  }

  /**
   * Formats safe notification for finalized prescription (Zero PHI in notification message).
   */
  public async buildPrescriptionNotification(
    prescriptionId: string,
    eventId: string
  ): Promise<NotificationJobPayload | null> {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: { include: { profile: true } },
        doctor: { include: { user: { include: { profile: true } } } },
        consultation: true,
      },
    });

    if (!prescription) return null;

    const patientName = prescription.patient.profile
      ? `${prescription.patient.profile.firstName} ${prescription.patient.profile.lastName}`
      : 'Patient';
    const doctorName = prescription.doctor.user.profile
      ? `Dr. ${prescription.doctor.user.profile.firstName} ${prescription.doctor.user.profile.lastName}`
      : 'Dr. Practitioner';

    return {
      eventId,
      eventType: 'prescription.finalized',
      recipientId: prescription.patientId,
      recipientEmail: prescription.patient.email,
      recipientPhone: prescription.patient.phone || undefined,
      recipientName: patientName,
      channel: 'EMAIL',
      subject: `Prescription Available - Consultation #${prescription.consultation.consultationNumber}`,
      // Strictly avoiding diagnoses or medication names in email notifications for privacy compliance
      message: `Hello ${patientName}, ${doctorName} has finalized your medical prescription for consultation #${prescription.consultation.consultationNumber}. You can now view and download it securely by logging into your Amrutam patient portal.`,
    };
  }

  /**
   * Formats safe notification for payment receipt or refund.
   */
  public async buildPaymentNotification(
    paymentId: string,
    eventId: string,
    type: 'COMPLETED' | 'REFUNDED'
  ): Promise<NotificationJobPayload | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        consultation: {
          include: {
            patient: { include: { profile: true } },
          },
        },
      },
    });

    if (!payment) return null;

    const patient = payment.consultation.patient;
    const patientName = patient.profile
      ? `${patient.profile.firstName} ${patient.profile.lastName}`
      : 'Patient';

    if (type === 'COMPLETED') {
      return {
        eventId,
        eventType: 'payment.completed',
        recipientId: patient.id,
        recipientEmail: patient.email,
        recipientPhone: patient.phone || undefined,
        recipientName: patientName,
        channel: 'EMAIL',
        subject: `Payment Receipt: ${payment.currency} ${Number(payment.amount)}`,
        message: `Hello ${patientName}, your payment of ${payment.currency} ${Number(payment.amount)} for consultation #${payment.consultation.consultationNumber} was received successfully. Reference: ${payment.paymentReference}.`,
      };
    } else {
      return {
        eventId,
        eventType: 'payment.refunded',
        recipientId: patient.id,
        recipientEmail: patient.email,
        recipientPhone: patient.phone || undefined,
        recipientName: patientName,
        channel: 'EMAIL',
        subject: `Refund Processed: ${payment.currency} ${Number(payment.amount)}`,
        message: `Hello ${patientName}, a refund of ${payment.currency} ${Number(payment.amount)} for consultation #${payment.consultation.consultationNumber} has been processed back to your original payment method. Reference: ${payment.paymentReference}.`,
      };
    }
  }
}

export const notificationService = new NotificationService();
