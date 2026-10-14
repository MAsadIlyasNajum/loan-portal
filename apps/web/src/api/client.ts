import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { authStorage } from './auth-storage';

export const API_BASE_URL: string = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env['VITE_API_URL'] || '/api';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env['VITE_API_URL'] || '/api';
  }
  return '/api';
})();

let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    unauthorizedHandler = null;
  };
}

function attachToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = authStorage.getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(attachToken);

apiClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export function request<T>(config: AxiosRequestConfig): Promise<T> {
  return apiClient.request<T>(config).then((response) => response.data);
}
