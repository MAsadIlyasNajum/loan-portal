import { apiClient, request } from './client';
import type { LoginResult, RegisterResult } from './types';

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
}

export async function register(
  payload: RegisterRequest,
): Promise<RegisterResult> {
  return request<RegisterResult>({
    method: 'POST',
    url: '/auth/register',
    data: payload,
  });
}

export async function login(payload: LoginRequest): Promise<LoginResult> {
  return request<LoginResult>({
    method: 'POST',
    url: '/auth/login',
    data: payload,
  });
}

export function authenticatedClient() {
  return apiClient;
}
