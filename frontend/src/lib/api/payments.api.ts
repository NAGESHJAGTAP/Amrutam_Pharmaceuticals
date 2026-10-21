import { apiClient } from './client';
import { ApiResponse } from '@/types/api.types';
import { Payment } from '@/types/clinical.types';

export interface SimulateWebhookPayload {
  paymentReference: string;
  eventType: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
}

export const paymentsApi = {
  getPaymentByConsultation: async (consultationId: string): Promise<ApiResponse<Payment>> => {
    const res = await apiClient.get<ApiResponse<Payment>>(`/payments/consultation/${consultationId}`);
    return res.data;
  },

  getPaymentById: async (paymentId: string): Promise<ApiResponse<Payment>> => {
    const res = await apiClient.get<ApiResponse<Payment>>(`/payments/${paymentId}`);
    return res.data;
  },

  simulateWebhook: async (payload: SimulateWebhookPayload): Promise<ApiResponse<{ received: boolean }>> => {
    const res = await apiClient.post<ApiResponse<{ received: boolean }>>('/payments/simulate-webhook', payload);
    return res.data;
  },
};
