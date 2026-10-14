import { request } from './client';
import type { LoanPurpose } from './types';

export function listLoanPurposes(): Promise<LoanPurpose[]> {
  return request<LoanPurpose[]>({
    method: 'GET',
    url: '/loan-purposes',
  });
}
