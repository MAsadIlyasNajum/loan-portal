import { request } from './client';
import type { CreateLoanApplication, LoanApplication } from './types';

export interface ListOptions {
  readonly status?: string;
}

export function listApplications(
  options?: ListOptions,
): Promise<LoanApplication[]> {
  const params: Record<string, string> = {};
  if (options?.status) {
    params.status = options.status;
  }
  return request<LoanApplication[]>({
    method: 'GET',
    url: '/loans',
    params,
  });
}

export function getApplication(id: string): Promise<LoanApplication> {
  return request<LoanApplication>({
    method: 'GET',
    url: `/loans/${encodeURIComponent(id)}`,
  });
}

export function createApplication(
  payload: CreateLoanApplication,
): Promise<LoanApplication> {
  return request<LoanApplication>({
    method: 'POST',
    url: '/loans',
    data: payload,
  });
}
