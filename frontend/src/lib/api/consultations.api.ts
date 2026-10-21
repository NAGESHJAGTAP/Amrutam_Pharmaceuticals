import { apiClient, generateUUID } from './client';
import { ApiResponse } from '@/types/api.types';
import { Consultation } from '@/types/clinical.types';

export interface BookConsultationPayload {
  doctorId: string;
  slotId: string;
  feeAmount: number;
}

export interface ListBookingsParams {
  status?: string;
  page?: number;
  limit?: number;
}

export const consultationsApi = {
  bookConsultation: async (
    payload: BookConsultationPayload,
    idempotencyKey?: string
  ): Promise<ApiResponse<Consultation>> => {
    const key = idempotencyKey || generateUUID();
    const res = await apiClient.post<any>('/consultations/book', payload, {
      headers: {
        'Idempotency-Key': key,
      },
    });
    const raw = res.data;
    const unwrapped = raw?.data?.consultation || raw?.data || raw;
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  getMyBookings: async (params?: ListBookingsParams): Promise<ApiResponse<Consultation[]>> => {
    const res = await apiClient.get<any>('/consultations/my-bookings', { params });
    const raw = res.data;
    const unwrapped = Array.isArray(raw?.data) ? raw.data : raw?.data?.consultations || raw?.data || [];
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  getDoctorSchedule: async (params?: ListBookingsParams): Promise<ApiResponse<Consultation[]>> => {
    const res = await apiClient.get<any>('/consultations/doctor-schedule', { params });
    const raw = res.data;
    const unwrapped = Array.isArray(raw?.data) ? raw.data : raw?.data?.consultations || raw?.data || [];
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  getAllConsultations: async (params?: ListBookingsParams): Promise<ApiResponse<Consultation[]>> => {
    const res = await apiClient.get<any>('/consultations/admin/all', { params });
    const raw = res.data;
    const unwrapped = Array.isArray(raw?.data) ? raw.data : raw?.data?.consultations || raw?.data || [];
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  getConsultationById: async (consultationId: string): Promise<ApiResponse<Consultation>> => {
    const res = await apiClient.get<any>(`/consultations/${consultationId}`);
    const raw = res.data;
    const unwrapped = raw?.data?.consultation || raw?.data || raw;
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  cancelConsultation: async (
    consultationId: string,
    reason?: string,
    idempotencyKey?: string
  ): Promise<ApiResponse<Consultation>> => {
    const key = idempotencyKey || generateUUID();
    const res = await apiClient.post<ApiResponse<Consultation>>(
      `/consultations/${consultationId}/cancel`,
      { reason: reason || 'Patient requested cancellation' },
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );
    return res.data;
  },

  initiateCall: async (consultationId: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.post<any>(`/consultations/${consultationId}/call/initiate`);
    return res.data;
  },

  getActiveCall: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get<any>('/consultations/active-call');
    return res.data;
  },

  respondToCall: async (consultationId: string, action: 'ACCEPT' | 'REJECT'): Promise<ApiResponse<any>> => {
    const res = await apiClient.post<any>(`/consultations/${consultationId}/call/respond`, { action });
    return res.data;
  },
};
