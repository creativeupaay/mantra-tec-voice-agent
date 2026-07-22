import axios from "axios";
import {
  IAuthResponse,
  IUser,
  ILoginCredentials,
  IRegisterData,
} from "../types/api";
import {
  ICallListResponse,
  ICallResponse,
  ICallRecordingResponse,
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
    tokens_prompt?: number;
    tokens_completion?: number;
    [key: string]: any;
  };
  createdAt: string;
}

export interface ICallAnalytics {
  kpis: {
    totalCalls: number;
    resolvedCount: number;
    escalatedCount: number;
    missedCount: number;
    liveCount: number;
    redFlagCount: number;
    avgDurationSeconds: number;
  };
  callVolume: { date: string; count: number }[];
  statusBreakdown: { name: string; value: number }[];
  intentBreakdown: { intent: string; count: number }[];
  recentRedFlags: {
    _id: string;
    call_id: string;
    caller_name?: string;
    phone_number: string;
    call_summary?: string;
    detected_intent?: string;
    status: string;
    timestamp: string;
  }[];
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8001/api/v1";

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          const { token } = response.data as {
            success: boolean;
            token: string;
          };
          localStorage.setItem("token", token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// Auth endpoints
export const authApi = {
  register: (data: IRegisterData) =>
    apiClient.post<IAuthResponse>("/auth/register", data),

  login: (data: ILoginCredentials) =>
    apiClient.post<IAuthResponse>("/auth/login", data),

  getProfile: () =>
    apiClient.get<{ success: boolean; user: IUser }>("/auth/profile"),
};

// Analytics endpoints
export const analyticsApi = {
  getDashboard: () =>
    apiClient.get<{
      success: boolean;
      data: {
        totalUsers: number;
        totalAgents: number;
        totalSessions: number;
        totalCreditsUsed: number;
        monthlyStats: {
          _id: { year: number; month: number; day: number };
          totalUsed: number;
        }[];
      };
    }>("/analytics/analytics"),

  getCreditBalance: () =>
    apiClient.get<{ success: boolean; data: { creditBalance: number } }>(
      "/analytics/credit-balance",
    ),

  getAllCreditUsage: () =>
    apiClient.get<{ success: boolean; data: ICreditUsage[] }>(
      "/analytics/credit-usage",
    ),

  getCallAnalytics: () =>
    apiClient.get<{ success: boolean; data: ICallAnalytics }>(
      "/analytics/call-analytics",
    ),
};

// Call endpoints
export const callApi = {
  getAll: () => apiClient.get<ICallListResponse>("/calls"),

  getById: (id: string) => apiClient.get<ICallResponse>("/calls/" + id),

  getRecording: (id: string) =>
    apiClient.get<ICallRecordingResponse>("/calls/" + id + "/recording"),
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

export default apiClient;
