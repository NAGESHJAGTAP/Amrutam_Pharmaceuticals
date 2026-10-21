import { apiClient } from './client';
import { ApiResponse } from '@/types/api.types';
import { Doctor, AvailabilitySlot } from '@/types/clinical.types';

export interface DoctorSearchParams {
  specialty?: string;
  limit?: number;
  page?: number;
}

export const doctorsApi = {
  searchDoctors: async (params?: DoctorSearchParams): Promise<ApiResponse<Doctor[]>> => {
    const res = await apiClient.get<any>('/doctors', { params });
    const doctorList = Array.isArray(res.data?.data)
      ? res.data.data
      : res.data?.data?.doctors || [];
    return {
      ...res.data,
      data: doctorList,
    };
  },

  getDoctorById: async (doctorId: string): Promise<ApiResponse<Doctor>> => {
    const res = await apiClient.get<ApiResponse<Doctor>>(`/doctors/${doctorId}`);
    return res.data;
  },

  getDoctorSlots: async (doctorId: string, startDate?: string, endDate?: string): Promise<ApiResponse<AvailabilitySlot[]>> => {
    const res = await apiClient.get<ApiResponse<AvailabilitySlot[]>>('/availability/slots', {
      params: { doctorId, startDate, endDate },
    });
    return res.data;
  },

  createSlot: async (startTime: string, endTime: string): Promise<ApiResponse<AvailabilitySlot>> => {
    const res = await apiClient.post<ApiResponse<AvailabilitySlot>>('/availability/slots', {
      startTime,
      endTime,
    });
    return res.data;
  },

  cancelSlot: async (slotId: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/availability/slots/${slotId}`);
    return res.data;
  },
};
