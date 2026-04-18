import axios from "axios";

const baseURL = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const url: string = error.config?.url ?? "";
    if (error.response?.status === 401 && !url.startsWith("/auth")) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
