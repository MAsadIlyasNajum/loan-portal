export type UserRole = 'CUSTOMER' | 'ADMIN';

export type ApplicationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
}

export interface LoginResult {
  readonly accessToken: string;
  readonly user: AuthenticatedUser;
}

export interface RegisterResult {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
}

export interface LoanPurpose {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isActive: boolean;
}

export interface LoanApplication {
  readonly id: string;
  readonly fullName: string;
  readonly nric: string;
  readonly phone: string;
  readonly email: string;
  readonly monthlyIncome: number;
  readonly requestedAmount: number;
  readonly tenureMonths: number;
  readonly purposeId: string;
  readonly status: ApplicationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateLoanApplication {
  readonly fullName: string;
  readonly nric: string;
  readonly phone: string;
  readonly email: string;
  readonly monthlyIncome: number;
  readonly loanAmount: number;
  readonly tenureMonths: number;
  readonly purposeId: string;
}

export interface ApiError {
  readonly statusCode: number;
  readonly message: string | string[];
  readonly error?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'message' in value
  );
}

export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (Array.isArray(error.message)) {
      return error.message.join('; ');
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELLED';
}
