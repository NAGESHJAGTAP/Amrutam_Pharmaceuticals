export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface ApiErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId?: string;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}
