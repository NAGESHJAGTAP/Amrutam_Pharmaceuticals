import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorPayload } from '@/types/api.types';

// Storage keys
const ACCESS_TOKEN_KEY = 'carebridge_access_token';
const REFRESH_TOKEN_KEY = 'carebridge_refresh_token';

export const getStoredAccessToken = (): string | null => 
  localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem('amrutam_access_token');
export const getStoredRefreshToken = (): string | null => 
  localStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem('amrutam_refresh_token');

export const setStoredTokens = (accessToken: string, refreshToken: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearStoredTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('amrutam_access_token');
  localStorage.removeItem('amrutam_refresh_token');
};

// Generate UUID for correlation tracking
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: inject tokens and correlation IDs
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Set correlation & request tracking headers
  const correlationId = generateUUID();
  if (config.headers) {
    config.headers['X-Correlation-ID'] = correlationId;
    config.headers['X-Request-ID'] = generateUUID();
  }

  return config;
});

// Refresh token concurrency management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: handle 401 token expiry with silent refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login') && !originalRequest.url?.includes('/auth/refresh')) {
      const refreshToken = getStoredRefreshToken();

      if (!refreshToken) {
        clearStoredTokens();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        const newTokens = refreshResponse.data?.data?.tokens;

        if (newTokens?.accessToken && newTokens?.refreshToken) {
          setStoredTokens(newTokens.accessToken, newTokens.refreshToken);
          apiClient.defaults.headers.common.Authorization = `Bearer ${newTokens.accessToken}`;
          processQueue(null, newTokens.accessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error('Refresh response missing token pair');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearStoredTokens();
        window.dispatchEvent(new Event('carebridge_session_expired'));
        window.dispatchEvent(new Event('amrutam_session_expired'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Format human-friendly API error message
export const formatApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    if (data?.error?.message) {
      return data.error.message;
    }
    if (error.response?.status === 409) {
      return 'The requested appointment slot was already reserved by another patient. Please choose an alternate slot.';
    }
    if (error.response?.status === 429) {
      return 'Too many requests. Please wait a few moments before trying again.';
    }
    if (error.response?.status === 403) {
      return 'You do not have authorization to perform this clinical action.';
    }
    if (error.message) {
      return error.message;
    }
  }
  return 'A network or system error occurred. Please verify your connection.';
};
