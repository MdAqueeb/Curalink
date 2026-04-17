import { apiClient } from "./client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: { token: string; user: AuthUser };
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    apiClient.post<AuthResponse>("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>("/auth/login", data),

  logout: () => apiClient.post("/auth/logout"),

  getMe: () =>
    apiClient.get<{ success: boolean; data: AuthUser }>("/auth/me"),
};
