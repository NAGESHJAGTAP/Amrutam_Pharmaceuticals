import { apiClient } from './client';
import { ApiResponse } from '@/types/api.types';
import { Prescription, Medication } from '@/types/clinical.types';

export interface CreatePrescriptionPayload {
  consultationId: string;
  diagnosis?: string;
  advice?: string;
  instructions?: string;
  medications: Medication[];
}

export const prescriptionsApi = {
  createPrescription: async (payload: CreatePrescriptionPayload): Promise<ApiResponse<Prescription>> => {
    const body = {
      ...payload,
      diagnosis: payload.diagnosis || 'Clinical Ayurvedic Assessment & Care Plan',
      advice: payload.advice || payload.instructions || '',
      instructions: payload.instructions || payload.advice || '',
    };
    const res = await apiClient.post<any>('/prescriptions', body);
    const raw = res.data;
    const unwrapped = raw?.data?.prescription || raw?.data || raw;
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  getPrescriptionById: async (prescriptionId: string): Promise<ApiResponse<Prescription>> => {
    const res = await apiClient.get<any>(`/prescriptions/${prescriptionId}`);
    const raw = res.data;
    const unwrapped = raw?.data?.prescription || raw?.data || raw;
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  getPrescriptionsByConsultation: async (consultationId: string): Promise<ApiResponse<Prescription[]>> => {
    const res = await apiClient.get<any>(`/prescriptions/consultation/${consultationId}`);
    const raw = res.data;
    let list: Prescription[] = [];
    if (Array.isArray(raw?.data)) {
      list = raw.data;
    } else if (raw?.data?.prescriptions && Array.isArray(raw.data.prescriptions)) {
      list = raw.data.prescriptions;
    } else if (raw?.data?.prescription) {
      list = [raw.data.prescription];
    } else if (Array.isArray(raw)) {
      list = raw;
    }
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: list,
    };
  },

  updatePrescription: async (
    prescriptionId: string,
    payload: Partial<CreatePrescriptionPayload>
  ): Promise<ApiResponse<Prescription>> => {
    const body = {
      ...payload,
      ...(payload.instructions && !payload.advice ? { advice: payload.instructions } : {}),
    };
    const res = await apiClient.patch<any>(`/prescriptions/${prescriptionId}`, body);
    const raw = res.data;
    const unwrapped = raw?.data?.prescription || raw?.data || raw;
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },

  finalizePrescription: async (prescriptionId: string): Promise<ApiResponse<Prescription>> => {
    const res = await apiClient.post<any>(`/prescriptions/${prescriptionId}/finalize`);
    const raw = res.data;
    const unwrapped = raw?.data?.prescription || raw?.data || raw;
    return {
      success: raw?.success ?? true,
      message: raw?.message,
      data: unwrapped,
    };
  },
};
