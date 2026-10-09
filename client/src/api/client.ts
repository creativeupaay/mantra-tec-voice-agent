import axios from "axios";
import {
  IAuthResponse,
  IUser,
  ILoginCredentials,
  IRegisterData,
  IForgotPasswordSendOtpResponse,
  IForgotPasswordVerifyOtpResponse,
  IForgotPasswordResetResponse,
} from "../types/api";
import {
  ICallListResponse,
  ICallResponse,
  CallStatus,
} from "../types/call";

export interface ICreditUsage {
  _id: string;
  userId: string | { _id: string; name: string; email: string };
  amount: number;
  description: string;
  type: "usage" | "purchase" | "refund";
  service?:
    | "plivo"
    | "deepgram"
    | "elevenlabs"
    | "cartesia"
    | "openrouter"
    | "gemini"
    | "platform";
  metadata?: {
    duration_seconds?: number;
    duration_minutes?: number;
    tokens_prompt?: number;
    tokens_completion?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    characters?: number;
    estimated_usd?: number;
    billing_unit?: string;
    calculation?: string;
    api?: string;
    rates?: Record<string, number>;
  };
  timestamp: string;
  createdAt: string;
}

export interface ICreditBalanceResponse {
  success: boolean;
  data: {
    credit_balance: number;
  };
}

export interface ICreditUsagesResponse {
  success: boolean;
  data: {
    usages: ICreditUsage[];
    pagination: {
      total: number;
      page: number;
      pages: number;
      limit: number;
    };
    summary: {
      totalAmount: number;
      byService: Record<string, number>;
    };
  };
}

// Production & Local API Base URL Configuration
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request Interceptor: Attach JWT Token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle Global 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear authentication state if token is expired/invalid
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      // Only redirect if not already on the login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// Helper function to build recording stream URL with auth token query param
export function getCallRecordingStreamUrl(callDbId: string): string {
  const token = localStorage.getItem("auth_token");
  const baseUrl = `${API_BASE_URL}/calls/${callDbId}/recording`;
  return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
}

// Auth API Functions
export const authApi = {
  login: async (credentials: ILoginCredentials): Promise<IAuthResponse> => {
    const response = await apiClient.post<IAuthResponse>(
      "/auth/login",
      credentials,
    );
    if (response.data.success && response.data.token) {
      localStorage.setItem("auth_token", response.data.token);
      localStorage.setItem("auth_user", JSON.stringify(response.data.user));
    }
    return response.data;
  },

  register: async (data: IRegisterData): Promise<IAuthResponse> => {
    const response = await apiClient.post<IAuthResponse>(
      "/auth/register",
      data,
    );
    if (response.data.success && response.data.token) {
      localStorage.setItem("auth_token", response.data.token);
      localStorage.setItem("auth_user", JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }
  },

  getCurrentUser: async (): Promise<IUser | null> => {
    const token = localStorage.getItem("auth_token");
    if (!token) return null;

    try {
      const response = await apiClient.get<{
        success: boolean;
        user: IUser;
      }>("/auth/me");
      if (response.data.success) {
        localStorage.setItem(
          "auth_user",
          JSON.stringify(response.data.user),
        );
        return response.data.user;
      }
      return null;
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      return null;
    }
  },

  getStoredUser: (): IUser | null => {
    const userJson = localStorage.getItem("auth_user");
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  },

  getStoredToken: (): string | null => {
    return localStorage.getItem("auth_token");
  },

  isAuthenticated: (): boolean => {
    return Boolean(localStorage.getItem("auth_token"));
  },

  sendForgotPasswordOtp: async (email: string): Promise<IForgotPasswordSendOtpResponse> => {
    const response = await apiClient.post<IForgotPasswordSendOtpResponse>(
      "/auth/forgot-password/send-otp",
      { email }
    );
    return response.data;
  },

  verifyForgotPasswordOtp: async (email: string, otp: string): Promise<IForgotPasswordVerifyOtpResponse> => {
    const response = await apiClient.post<IForgotPasswordVerifyOtpResponse>(
      "/auth/forgot-password/verify-otp",
      { email, otp }
    );
    return response.data;
  },

  resetPasswordWithOtp: async (
    email: string,
    otp: string,
    newPassword: string
  ): Promise<IForgotPasswordResetResponse> => {
    const response = await apiClient.post<IForgotPasswordResetResponse>(
      "/auth/forgot-password/reset-password",
      { email, otp, newPassword }
    );
    return response.data;
  },
};

// Credit API Functions (Admin / Usage)
export const creditApi = {
  getBalance: async (userId?: string): Promise<ICreditBalanceResponse> => {
    const url = userId ? `/analytics/credits/balance/${userId}` : "/analytics/credits/balance";
    const response = await apiClient.get<ICreditBalanceResponse>(url);
    return response.data;
  },

  getUsageHistory: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    service?: string;
  }): Promise<ICreditUsagesResponse> => {
    const response = await apiClient.get<ICreditUsagesResponse>(
      "/analytics/credits/history",
      { params },
    );
    return response.data;
  },

  addCredits: async (data: {
    userId: string;
    amount: number;
    description: string;
  }): Promise<{ success: boolean; data: { new_balance: number } }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: { new_balance: number };
    }>("/analytics/credits/add", data);
    return response.data;
  },
};

// Analytics API Functions
export const analyticsApi = {
  getDashboard: () => apiClient.get<{ success: boolean; data: any }>('/analytics/analytics'),
  getCallAnalytics: () => apiClient.get<{ success: boolean; data: any }>('/analytics/call-analytics'),
  getCreditBalance: (userId?: string) => {
    const url = userId ? `/analytics/credit-balance/${userId}` : "/analytics/credit-balance";
    return apiClient.get<ICreditBalanceResponse>(url);
  },
  getAllCreditUsage: (params?: any) =>
    apiClient.get<ICreditUsagesResponse>('/analytics/credit-usage', { params }),
  addCredits: (data: { userId: string; amount: number; description: string }) =>
    apiClient.post<{ success: boolean; data: { new_balance: number } }>('/analytics/credits/add', data),
};

// Notification types
export interface INotification {
  _id: string
  userId?: string
  title: string
  message: string
  category: string
  severity: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  link?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// Notification API Functions
export const notificationApi = {
  getNotifications: () =>
    apiClient.get<{ success: boolean; data: { notifications: INotification[]; unreadCount: number } }>('/notifications'),
  getAll: () =>
    apiClient.get<{ success: boolean; data: { notifications: INotification[]; unreadCount: number } }>('/notifications'),
  markAsRead: (id: string) =>
    apiClient.patch<{ success: boolean }>(`/notifications/${id}/read`),
  markAllAsRead: () =>
    apiClient.post<{ success: boolean }>('/notifications/read-all'),
  deleteNotification: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/notifications/${id}`),
  deleteAllNotifications: () =>
    apiClient.delete<{ success: boolean }>('/notifications/clear-all'),
};

// Calls API Functions
export const callApi = {
  getAll: async (params?: Record<string, any>): Promise<ICallListResponse> => {
    const response = await apiClient.get<ICallListResponse>("/calls", { params });
    return response.data;
  },

  getById: async (id: string): Promise<ICallResponse> => {
    const response = await apiClient.get<ICallResponse>(`/calls/${id}`);
    return response.data;
  },

  updateStatus: async (
    id: string,
    status: CallStatus,
  ): Promise<ICallResponse> => {
    const response = await apiClient.patch<ICallResponse>(
      `/calls/${id}/status`,
      { status },
    );
    return response.data;
  },

  updateReviewed: async (
    id: string,
    is_reviewed: boolean,
  ): Promise<ICallResponse> => {
    const response = await apiClient.patch<ICallResponse>(
      `/calls/${id}/reviewed`,
      { is_reviewed },
    );
    return response.data;
  },

  batchUpdateReviewed: async (
    call_ids: string[],
    is_reviewed: boolean,
  ): Promise<{ success: boolean; message: string; modifiedCount?: number }> => {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
      modifiedCount?: number;
    }>('/calls/batch-reviewed', { call_ids, is_reviewed });
    return response.data;
  },

  getRecordingBlob: (id: string) =>
    apiClient.get<Blob>(`/calls/${id}/recording`, { responseType: "blob" }),

  getRecordingStreamUrl: getCallRecordingStreamUrl,
};

// Agent endpoints
export const agentApi = {
  getAll: () =>
    apiClient.get<{ success: boolean; data: { _id: string; name: string }[] }>(
      "/agents",
    ),
  getById: (id: string) =>
    apiClient.get<{ success: boolean; data: { _id: string; name: string } }>(
      `/agents/${id}`,
    ),
  create: (data: { name: string; description: string }) =>
    apiClient.post("/agents", data),
  update: (id: string, data: { name: string; description: string }) =>
    apiClient.put(`/agents/${id}`, data),
  delete: (id: string) => apiClient.delete(`/agents/${id}`),
};

// Session endpoints
export const sessionApi = {
  getAll: () =>
    apiClient.get<{
      success: boolean;
      data: { _id: string; status: string }[];
    }>("/sessions"),
  getById: (id: string) =>
    apiClient.get<{ success: boolean; data: { _id: string } }>(
      `/sessions/${id}`,
    ),
  create: (data: { agentId: string }) => apiClient.post("/sessions", data),
  endSession: (id: string) => apiClient.patch(`/sessions/${id}/end`),
};

// Settings endpoints
export const settingsApi = {
  get: () => apiClient.get<{ success: boolean; data: any }>('/settings'),
  update: (data: any) => apiClient.put<{ success: boolean; message: string; data: any }>('/settings', data),
  sendTestEmail: (data: { emails: string[] }) =>
    apiClient.post<{ success: boolean; message: string }>('/settings/test-email', data),
};

export default apiClient;
