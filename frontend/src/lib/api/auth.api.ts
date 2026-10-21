import { apiClient } from './client';
import { ApiResponse } from '@/types/api.types';
import { User, AuthSuccessData, MfaChallengeData, MfaSetupData } from '@/types/auth.types';

export interface RegisterPatientPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyMfaPayload {
  token: string;
  preAuthToken?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  register: async (payload: RegisterPatientPayload): Promise<ApiResponse<AuthSuccessData>> => {
    const res = await apiClient.post<ApiResponse<AuthSuccessData>>('/auth/register', payload);
    return res.data;
  },

  login: async (payload: LoginPayload): Promise<ApiResponse<AuthSuccessData | MfaChallengeData>> => {
    const res = await apiClient.post<ApiResponse<AuthSuccessData | MfaChallengeData>>('/auth/login', payload);
    return res.data;
  },

  verifyMfaLogin: async (payload: VerifyMfaPayload): Promise<ApiResponse<AuthSuccessData>> => {
    const res = await apiClient.post<ApiResponse<AuthSuccessData>>('/auth/mfa/verify', payload);
    return res.data;
  },

  getMe: async (): Promise<ApiResponse<{ user: User }>> => {
    const res = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return res.data;
  },

  setupMfa: async (): Promise<ApiResponse<MfaSetupData>> => {
    const res = await apiClient.post<ApiResponse<MfaSetupData>>('/auth/mfa/setup');
    return res.data;
  },

  verifyMfaSetup: async (code: string): Promise<ApiResponse<AuthSuccessData>> => {
    const res = await apiClient.post<ApiResponse<AuthSuccessData>>('/auth/mfa/verify', { token: code });
    return res.data;
  },

  changePassword: async (payload: ChangePasswordPayload): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>('/auth/change-password', payload);
    return res.data;
  },

  logout: async (refreshToken: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout', { refreshToken });
    return res.data;
  },
};
